import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askBrowserDocument, askSavedDocument } from "@/app/(app)/documents/actions";
import { runSavedQuestion } from "@/lib/documents/saved-question";
import { NOT_SAID_ANSWER, readStoredAnswer } from "@/lib/engine/answers";
import { normalizeText } from "@/lib/extraction/normalize";
import { loadFixture, type FixtureQuestion } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import { UNANSWERED, answerPayload, curlyQuotes, scriptedClient } from "../support/model-payloads";

// The server side of the question box. A document kept in the browser goes
// through the real action, the real engine and the real OpenRouter client;
// only the network is faked, by a fetch that answers as OpenRouter would. A
// saved document's run is checked through runSavedQuestion, which the action
// calls after loading the text under row-level security (there is no Supabase
// project to load it from here).

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const fee = sidecar.questions.find((q): q is Extract<FixtureQuestion, { answerable: true }> => q.answerable)!;
const DOC = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

let requests: unknown[] = [];
function answerWith(...contents: unknown[]) {
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(init.body as string));
    const content = contents.shift();
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }] }), { status: 200 });
  });
}

beforeEach(() => {
  requests = [];
  vi.stubEnv("OPENROUTER_API_KEY", "test-key-not-real");
  vi.stubEnv("OPENROUTER_MODEL", "model-named-by-env");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("asking about a document kept in the browser", () => {
  it("returns the answer with a citation that matches the stored text, and saves nothing", async () => {
    answerWith(answerPayload(fee));
    const result = await askBrowserDocument(contract, fee.question);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.asked.id).toBeNull();
    expect(result.asked.question).toBe(fee.question);
    expect(readStoredAnswer(result.asked.result, contract)).toMatchObject({ kind: "answered", text: fee.answer, citation: { text: fee.sentence } });
    expectCitationsVerbatim(result.asked, contract);
  });

  it("asks the model through the pinned provider with a strict JSON schema, and the question in the request", async () => {
    answerWith(answerPayload(fee));
    await askBrowserDocument(contract, fee.question);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      model: "model-named-by-env",
      provider: { order: ["fireworks"], allow_fallbacks: false, require_parameters: true },
      reasoning: { effort: "low" },
      response_format: { type: "json_schema", json_schema: { name: "answer", strict: true } },
    });
    expect(JSON.stringify(requests[0])).toContain(fee.question);
  });

  it("normalises the text again, so offsets match the canonical text and not what the browser sent", async () => {
    answerWith(answerPayload(fee));
    const sent = curlyQuotes(contract).replace(/\n/g, "\r\n");
    const result = await askBrowserDocument(sent, fee.question);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expectCitationsVerbatim(result.asked, normalizeText(sent));
  });

  it("returns the document doesn't say when the model can't cite", async () => {
    answerWith({ document_answers: true, answer: "Ninety days.", sentence: null });
    const result = await askBrowserDocument(contract, "How long is the notice period?");
    expect(result.ok && result.asked.result).toEqual(NOT_SAID_ANSWER);
  });

  it("returns a wording failure, with no answer in it, when both tries hedge", async () => {
    const hedged = { ...answerPayload(fee), answer: "Perhaps $42,000 per year." };
    answerWith(hedged, hedged);
    expect(await askBrowserDocument(contract, fee.question)).toEqual({ ok: false, reason: "wording-failed" });
    expect(requests).toHaveLength(2);
  });

  it("refuses an empty or overlong question, and text that isn't a document, without calling the model", async () => {
    answerWith(UNANSWERED);
    expect(await askBrowserDocument(contract, "   ")).toEqual({ ok: false, reason: "question-empty" });
    expect(await askBrowserDocument(contract, "x".repeat(501))).toEqual({ ok: false, reason: "question-too-long" });
    expect(await askBrowserDocument(42, fee.question)).toEqual({ ok: false, reason: "invalid" });
    expect(requests).toHaveLength(0);
  });

  it("says the model isn't set up, and calls nothing, when the key is missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    answerWith(answerPayload(fee));
    expect(await askBrowserDocument(contract, fee.question)).toEqual({ ok: false, reason: "model-off" });
    expect(requests).toHaveLength(0);
  });

  it("returns only the answer: no diagnostics, key or model id", async () => {
    answerWith(answerPayload(fee));
    const serialised = JSON.stringify(await askBrowserDocument(contract, fee.question));
    expect(serialised).not.toContain("test-key-not-real");
    expect(serialised).not.toContain("model-named-by-env");
    expect(serialised).not.toContain("diagnostics");
    expect(serialised).not.toContain("notSaid");
  });
});

describe("asking about a saved document", () => {
  it("says accounts aren't set up when Supabase isn't configured", async () => {
    answerWith(answerPayload(fee));
    expect(await askSavedDocument(DOC, fee.question)).toEqual({ ok: false, reason: "accounts-off" });
    expect(requests).toHaveLength(0);
  });

  it("saves the question as asked with the checked answer", async () => {
    const result = await runSavedQuestion({ documentId: DOC, body: contract, question: ` ${fee.question} `, client: scriptedClient(answerPayload(fee)) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.insert).toEqual({ document_id: DOC, question: fee.question, result: result.run.answer });
    expect(result.run.answer).toMatchObject({ kind: "answered", text: fee.answer });
    expectCitationsVerbatim(result.run.insert, contract);
  });

  it("saves the document doesn't say as the answer when the model can't cite the text", async () => {
    const result = await runSavedQuestion({
      documentId: DOC,
      body: contract,
      question: fee.question,
      client: scriptedClient({ ...answerPayload(fee), sentence: "The Subscription Fee is $40,000 per year, payable annually in advance." }),
    });
    expect(result.ok && result.run.insert.result).toEqual(NOT_SAID_ANSWER);
  });

  it("saves nothing when the wording fails twice", async () => {
    const hedged = { ...answerPayload(fee), answer: "Possibly $42,000 per year." };
    const result = await runSavedQuestion({ documentId: DOC, body: contract, question: fee.question, client: scriptedClient(hedged, hedged) });
    expect(result).toMatchObject({ ok: false, reason: "wording-failed" });
    expect("run" in result).toBe(false);
  });
});
