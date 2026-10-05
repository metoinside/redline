import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyseBrowserDocument, analyseSavedDocument } from "@/app/(app)/documents/actions";
import { normalizeText } from "@/lib/extraction/normalize";
import { loadFixture } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import { analysisPayload, curlyQuotes } from "../support/model-payloads";

// The server entry for a document kept in the browser: the real action, the
// real engine and the real OpenRouter client. Only the network is faked, by a
// fetch that answers as OpenRouter would.

const { text: contract, sidecar } = loadFixture("adhesion-contract");

let calls = 0;
function answerWith(status: number, content: unknown) {
  vi.stubGlobal("fetch", async () => {
    calls++;
    const body = status === 200 ? { choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }] } : { error: { message: "nope" } };
    return new Response(JSON.stringify(body), { status });
  });
}

beforeEach(() => {
  calls = 0;
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

describe("analysing a document kept in the browser", () => {
  it("returns the auto-renewal flags with citations that match the stored text", async () => {
    answerWith(200, analysisPayload(sidecar));
    const result = await analyseBrowserDocument(contract);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.analysis.flags.map((f) => f.clauseType)).toEqual(["auto_renewal", "auto_renewal"]);
    expectCitationsVerbatim(result.run.analysis, contract);
    expect(Number.isNaN(Date.parse(result.run.ranAt))).toBe(false);
  });

  it("normalises the text again, so offsets match the canonical text and not what the browser sent", async () => {
    answerWith(200, analysisPayload(sidecar));
    const sent = curlyQuotes(contract).replace(/\n/g, "\r\n");
    const result = await analyseBrowserDocument(sent);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.analysis.flags).toHaveLength(2);
    expectCitationsVerbatim(result.run.analysis, normalizeText(sent));
  });

  it("returns only the analysis: no diagnostics, raw model answer, key or model id", async () => {
    answerWith(200, analysisPayload(sidecar));
    const serialised = JSON.stringify(await analyseBrowserDocument(contract));
    expect(serialised).not.toContain("test-key-not-real");
    expect(serialised).not.toContain("model-named-by-env");
    expect(serialised).not.toContain("droppedByReason");
    expect(serialised).not.toContain("multi_year_term");
  });

  it("says the model isn't set up, and calls nothing, when the key is missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    answerWith(200, analysisPayload(sidecar));
    expect(await analyseBrowserDocument(contract)).toEqual({ ok: false, reason: "model-off" });
    expect(calls).toBe(0);
  });

  it("returns a plain failure when the model service fails or answers in the wrong shape", async () => {
    answerWith(500, null);
    expect(await analyseBrowserDocument(contract)).toEqual({ ok: false, reason: "model-failed" });
    answerWith(200, { not: "clauses" });
    expect(await analyseBrowserDocument(contract)).toEqual({ ok: false, reason: "model-failed" });
  });

  it("refuses text that isn't a document before calling the model", async () => {
    answerWith(200, analysisPayload(sidecar));
    expect(await analyseBrowserDocument(42)).toEqual({ ok: false, reason: "invalid" });
    expect(await analyseBrowserDocument("   ")).toEqual({ ok: false, reason: "invalid" });
    expect(calls).toBe(0);
  });
});

describe("analysing a saved document", () => {
  it("needs accounts on this server", async () => {
    expect(await analyseSavedDocument("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toEqual({ ok: false, reason: "accounts-off" });
  });
});
