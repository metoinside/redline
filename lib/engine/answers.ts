// The question box's rules that hold on both sides of the wire: what counts
// as a question, and how a saved answer is read back. A stored answer is JSON
// from the database, or from the server to the browser, so none of it is
// taken on trust. Before it is shown:
//  - its shape is checked;
//  - its citation is checked again against the document text it will be shown
//    beside. One that no longer matches is shown as "the document doesn't
//    say", never as the old answer (ADR 0001);
//  - its wording is checked again (ADR 0005). An answer that fails is not
//    shown at all.
//
// Safe to import in the browser: it reads nothing and calls nothing.

import { citationMatches } from "./citations";
import { ANSWER_SCHEMA_VERSION, type Answer, type Citation, type QuestionProblem } from "./types";
import { findWordingDefects } from "./wording";

/** What the question box says when the document doesn't answer the question (PRD §3 item 7). Kept word for word. */
export const NOT_SAID = "the document doesn't say";

/** The longest question the box takes, in characters, after its spacing is tidied. */
export const MAX_QUESTION_CHARS = 500;

export const NOT_SAID_ANSWER: Answer = { schemaVersion: ANSWER_SCHEMA_VERSION, kind: "not-said" };

export type QuestionCheck = { ok: true; question: string } | { ok: false; problem: QuestionProblem };

/** The question with its spacing tidied (runs of whitespace become one space), or why it can't be asked. */
export function checkQuestion(raw: unknown): QuestionCheck {
  if (typeof raw !== "string") return { ok: false, problem: "empty" };
  // Checked before tidying too, so an oversized request costs nothing.
  if (raw.length > MAX_QUESTION_CHARS * 4) return { ok: false, problem: "too-long" };
  const question = raw.replace(/\s+/g, " ").trim();
  if (question === "") return { ok: false, problem: "empty" };
  if (question.length > MAX_QUESTION_CHARS) return { ok: false, problem: "too-long" };
  return { ok: true, question };
}

function readCitation(value: unknown): Citation | null {
  if (typeof value !== "object" || value === null) return null;
  const { text, start, end } = value as Record<string, unknown>;
  if (typeof text !== "string" || typeof start !== "number" || typeof end !== "number") return null;
  return { text, start, end };
}

/** The pieces of an answer the wording check reads. Never the citation: those are the document's own words. */
export function answerPieces(text: string): { field: string; text: string }[] {
  return [{ field: "answer", text }];
}

/**
 * The answer to show beside `storedText`: the saved answer when its citation
 * still matches the text at its offsets, "the document doesn't say" when it
 * doesn't, or null when the saved value is not an answer this version can
 * read or its wording fails the check.
 */
export function readStoredAnswer(value: unknown, storedText: string): Answer | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== ANSWER_SCHEMA_VERSION) return null;
  if (raw.kind === "not-said") return NOT_SAID_ANSWER;
  if (raw.kind !== "answered") return null;
  if (typeof raw.text !== "string" || raw.text.trim() === "") return null;
  const citation = readCitation(raw.citation);
  if (!citation) return null;
  if (findWordingDefects(answerPieces(raw.text)).length > 0) return null;
  if (!citationMatches(storedText, citation)) return NOT_SAID_ANSWER;
  return { schemaVersion: ANSWER_SCHEMA_VERSION, kind: "answered", text: raw.text, citation };
}
