// One question about a saved document, assembled on the server: the engine's
// ask() run on the stored text, and the questions row that records what the
// buyer saw. The server action (app/(app)/documents/actions.ts) loads the
// text under row-level security and saves the row; this file decides what is
// asked and what is saved. A wording failure or a refused question saves
// nothing: there is no answer to keep.

import { ask } from "@/lib/engine/ask";
import type { ModelClient } from "@/lib/engine/model";
import type { Answer, AskDiagnostics, AskResult } from "@/lib/engine/types";

export type SavedQuestionInput = {
  documentId: string;
  /** The stored document text, in canonical form. */
  body: string;
  /** The question as the buyer typed it. */
  question: unknown;
  client: ModelClient;
};

export type SavedQuestion = {
  question: string;
  answer: Answer;
  diagnostics: AskDiagnostics;
  /** The questions row to insert: the question as asked and the answer shown. */
  insert: { document_id: string; question: string; result: Answer };
};

export async function runSavedQuestion({
  documentId,
  body,
  question,
  client,
}: SavedQuestionInput): Promise<{ ok: true; run: SavedQuestion } | Exclude<AskResult, { ok: true }>> {
  const result = await ask({ text: body, question, client });
  if (!result.ok) return result;
  return {
    ok: true,
    run: {
      question: result.question,
      answer: result.answer,
      diagnostics: result.diagnostics,
      insert: { document_id: documentId, question: result.question, result: result.answer },
    },
  };
}
