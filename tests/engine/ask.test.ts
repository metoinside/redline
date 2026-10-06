import { describe, expect, it } from "vitest";
import { ANSWER_TASK, MAX_ATTEMPTS, ask } from "@/lib/engine/ask";
import { MAX_QUESTION_CHARS, NOT_SAID, readStoredAnswer } from "@/lib/engine/answers";
import { ModelOutputError } from "@/lib/engine/model";
import type { Answer } from "@/lib/engine/types";
import { FIXTURE_NAMES, loadFixture, type FixtureQuestion } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import { FABRICATED_SENTENCES, UNANSWERED, answerPayload, changeWord, curlyQuotes, messySpacing, scriptedClient } from "../support/model-payloads";

// The question box (PRD §3 item 7, §4 check 11; spec user stories 33-36).
// ask() makes one model call and then decides in code what the buyer sees:
// the model's answer only when its sentence is found word for word in the
// stored text, and otherwise "the document doesn't say". The scripted client
// stands in for the model; the citation check and the wording check run for real.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const answerable = (questions: FixtureQuestion[]) =>
  questions.filter((q): q is Extract<FixtureQuestion, { answerable: true }> => q.answerable);
const unanswerable = (questions: FixtureQuestion[]) => questions.filter((q) => !q.answerable);

const feeQuestion = answerable(sidecar.questions)[0];
const SUSPENSION =
  "If any undisputed amount remains unpaid for more than forty-five (45) days after its due date, Provider may suspend Customer's access to the Services until the amount is paid in full.";

async function answerOf(payloads: unknown[], question: string = feeQuestion.question, text = contract) {
  const client = scriptedClient(...payloads);
  const result = await ask({ text, question, client });
  return { result, client };
}

function expectAnswered(result: Awaited<ReturnType<typeof ask>>): Extract<Answer, { kind: "answered" }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("not ok");
  expect(result.answer.kind).toBe("answered");
  if (result.answer.kind !== "answered") throw new Error("not answered");
  return result.answer;
}

function expectNotSaid(result: Awaited<ReturnType<typeof ask>>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("not ok");
  expect(result.answer).toEqual({ schemaVersion: 1, kind: "not-said" });
}

describe.each(FIXTURE_NAMES)("questions about %s", (name) => {
  const { text, sidecar: fixture } = loadFixture(name);

  it.each(answerable(fixture.questions).map((q) => [q.question, q] as const))(
    "answers %j with its answer and a citation that matches the text",
    async (_, question) => {
      const { result } = await answerOf([answerPayload(question)], question.question, text);
      const answer = expectAnswered(result);
      expect(answer.text).toBe(question.answer);
      expect(answer.citation.text).toBe(question.sentence);
      expect(expectCitationsVerbatim(result, text)).toHaveLength(1);
    },
  );

  it.each(unanswerable(fixture.questions).map((q) => [q.question, q] as const))(
    "says the document doesn't say for %j",
    async (_, question) => {
      const { result } = await answerOf([answerPayload(question)], question.question, text);
      expectNotSaid(result);
      expect(expectCitationsVerbatim(result, text)).toHaveLength(0);
    },
  );
});

describe("an answer is shown only with a citation found in the document", () => {
  it("replaces an answer whose citation has one word changed with the document doesn't say", async () => {
    const altered = changeWord(feeQuestion.sentence, "$42,000", "$40,000");
    const { result } = await answerOf([{ document_answers: true, answer: "$40,000 per year.", sentence: altered }]);
    expectNotSaid(result);
    expect(JSON.stringify(result)).not.toContain("$40,000");
  });

  it("replaces an answer citing a sentence the document doesn't contain", async () => {
    const { result } = await answerOf(
      [{ document_answers: true, answer: "A $25,000 fee.", sentence: FABRICATED_SENTENCES.early_termination_fee }],
      "Is there a termination fee?",
    );
    expectNotSaid(result);
    expect(JSON.stringify(result)).not.toContain("25,000");
  });

  it("returns the document doesn't say when the model gives no citation", async () => {
    for (const sentence of [null, "", "   "]) {
      const { result } = await answerOf([{ document_answers: true, answer: "$42,000 per year.", sentence }]);
      expectNotSaid(result);
    }
  });

  it("returns the document doesn't say when the citation is too short to check", async () => {
    const { result } = await answerOf(
      [{ document_answers: true, answer: "Delaware law.", sentence: "Delaware" }],
      "Which state's law governs this agreement?",
    );
    expectNotSaid(result);
  });

  it("returns the document doesn't say when the model marks the question unanswerable, even with an answer and a real sentence", async () => {
    const { result } = await answerOf([{ document_answers: false, answer: "$42,000 per year.", sentence: feeQuestion.sentence }]);
    expectNotSaid(result);
  });

  it("returns the document doesn't say when the model marks it answered but gives no answer", async () => {
    const { result } = await answerOf([{ document_answers: true, answer: "  ", sentence: feeQuestion.sentence }]);
    expectNotSaid(result);
  });

  it("checks the citation with the same normalisation as flags: curly quotes and messy spacing still match", async () => {
    const question = answerable(sidecar.questions).find((q) => q.sentence.includes("'"))!;
    for (const sentence of [curlyQuotes(question.sentence), messySpacing(question.sentence)]) {
      const { result } = await answerOf([{ ...answerPayload(question), sentence }], question.question);
      const answer = expectAnswered(result);
      expect(answer.citation.text).toBe(question.sentence);
      expectCitationsVerbatim(result, contract);
    }
  });

  it("leaves the document's own words alone: a cited sentence that says \"may\" is not a wording defect", async () => {
    const { result, client } = await answerOf(
      [{ document_answers: true, answer: "Provider can suspend your access once an undisputed amount is 45 days overdue.", sentence: SUSPENSION }],
      "What happens if I pay late?",
    );
    const answer = expectAnswered(result);
    expect(answer.citation.text).toBe(SUSPENSION);
    expect(client.requests).toHaveLength(1);
  });
});

describe("the wording check on answers", () => {
  const hedged = { ...answerPayload(feeQuestion), answer: "It might be $42,000 per year." };
  const compared = { ...answerPayload(feeQuestion), answer: "$42,000 per year, which is below market." };

  it.each([
    ["hedging", hedged],
    ["a market comparison", compared],
  ])("asks once more when the answer uses %s, and shows the plain retry", async (_, first) => {
    const { result, client } = await answerOf([first, answerPayload(feeQuestion)]);
    const answer = expectAnswered(result);
    expect(answer.text).toBe(feeQuestion.answer);
    expect(client.requests).toHaveLength(MAX_ATTEMPTS);
    if (!result.ok) return;
    expect(result.diagnostics.wording.map((a) => a.defects.length > 0)).toEqual([true, false]);
  });

  it("returns a wording failure, never an answer or the document doesn't say, when the retry still hedges", async () => {
    const { result, client } = await answerOf([hedged, compared]);
    expect(result).toMatchObject({ ok: false, reason: "wording-failed" });
    if (result.ok || result.reason !== "wording-failed") return;
    expect(result.attempts.map((a) => a.defects.map((d) => d.term))).toEqual([["might"], ["below market"]]);
    expect(JSON.stringify(result)).not.toContain("$42,000");
    expect(JSON.stringify(result)).not.toContain(NOT_SAID);
    expect(client.requests).toHaveLength(MAX_ATTEMPTS);
  });

  it("returns the document doesn't say when the retry finds no answer", async () => {
    const { result } = await answerOf([hedged, UNANSWERED]);
    expectNotSaid(result);
  });

  it("does not retry an answer that will not be shown", async () => {
    const altered = changeWord(feeQuestion.sentence, "$42,000", "$40,000");
    const { result, client } = await answerOf([{ document_answers: true, answer: "It might be $40,000.", sentence: altered }]);
    expectNotSaid(result);
    expect(client.requests).toHaveLength(1);
  });
});

describe("the model request", () => {
  it("sends the question and the document in one answer call with a strict schema", async () => {
    const { client } = await answerOf([answerPayload(feeQuestion)]);
    expect(client.requests).toHaveLength(1);
    const [request] = client.requests;
    expect(request.task).toBe(ANSWER_TASK);
    const sent = request.messages.map((m) => m.content).join("\n");
    expect(sent).toContain(feeQuestion.question);
    expect(sent).toContain(contract);
    expect(request.schema).toMatchObject({
      type: "object",
      required: ["document_answers", "answer", "sentence"],
      additionalProperties: false,
    });
  });

  it("sends the question as the buyer typed it, with its spacing tidied", async () => {
    const { client, result } = await answerOf([answerPayload(feeQuestion)], `  ${feeQuestion.question.replace(/ /g, "   ")}\n`);
    expect(client.requests[0].messages.map((m) => m.content).join("\n")).toContain(feeQuestion.question);
    expect(result.ok && result.question).toBe(feeQuestion.question);
  });

  it("refuses an empty or overlong question without calling the model", async () => {
    for (const [question, problem] of [
      ["", "empty"],
      [" \n\t ", "empty"],
      ["x".repeat(MAX_QUESTION_CHARS + 1), "too-long"],
      [42, "empty"],
    ] as const) {
      const client = scriptedClient(answerPayload(feeQuestion));
      const result = await ask({ text: contract, question: question as string, client });
      expect(result).toEqual({ ok: false, reason: "invalid-question", problem });
      expect(client.requests).toHaveLength(0);
    }
    const client = scriptedClient(answerPayload(feeQuestion));
    expect((await ask({ text: contract, question: "x".repeat(MAX_QUESTION_CHARS), client })).ok).toBe(true);
  });

  it("throws a model output error for a reply that is not in the requested shape", async () => {
    for (const reply of [null, "an answer", { answer: "$42,000" }, { document_answers: "yes", answer: null, sentence: null }]) {
      await expect(answerOf([reply])).rejects.toBeInstanceOf(ModelOutputError);
    }
  });

  it("needs the stored text in canonical form", async () => {
    await expect(answerOf([answerPayload(feeQuestion)], feeQuestion.question, contract.replace(/\n/g, "\r\n"))).rejects.toThrow(/canonical/);
  });
});

describe("reading a saved answer back", () => {
  it("shows a saved answer whose citation still matches the document", async () => {
    const { result } = await answerOf([answerPayload(feeQuestion)]);
    if (!result.ok) throw new Error("not ok");
    const stored = JSON.parse(JSON.stringify(result.answer));
    expect(readStoredAnswer(stored, contract)).toEqual(result.answer);
  });

  it("shows the document doesn't say for a saved answer whose citation no longer matches", async () => {
    const { result } = await answerOf([answerPayload(feeQuestion)]);
    if (!result.ok || result.answer.kind !== "answered") throw new Error("not answered");
    const moved = { ...result.answer, citation: { ...result.answer.citation, start: result.answer.citation.start + 1 } };
    expect(readStoredAnswer(moved, contract)).toEqual({ schemaVersion: 1, kind: "not-said" });
    const edited = contract.replace("$42,000", "$40,000");
    expect(readStoredAnswer(result.answer, edited)).toEqual({ schemaVersion: 1, kind: "not-said" });
  });

  it("reads a saved the document doesn't say as it is", () => {
    expect(readStoredAnswer({ schemaVersion: 1, kind: "not-said" }, contract)).toEqual({ schemaVersion: 1, kind: "not-said" });
  });

  it("refuses a saved answer that is malformed or fails the wording check", async () => {
    const { result } = await answerOf([answerPayload(feeQuestion)]);
    if (!result.ok || result.answer.kind !== "answered") throw new Error("not answered");
    for (const bad of [null, [], { kind: "answered" }, { ...result.answer, schemaVersion: 2 }, { ...result.answer, text: "" }, { ...result.answer, text: "It could be $42,000." }]) {
      expect(readStoredAnswer(bad, contract)).toBeNull();
    }
  });
});
