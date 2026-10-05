// One analysis run of a saved document, assembled on the server: the buyer's
// current red lines (rows from red_lines, loaded under row-level security),
// the engine run with them, and the analyses row that records the run with a
// snapshot of those red lines (analyses.red_lines). The server action
// (app/(app)/documents/actions.ts) loads the rows and saves the row; this
// file decides what goes into the run and what is saved with it.
//
// If any red line row can't be read, nothing runs: an analysis that quietly
// left out one of the buyer's red lines could miss a breach.

import { analyse } from "@/lib/engine/analyse";
import type { ModelClient } from "@/lib/engine/model";
import type { Analysis, AnalysisDiagnostics, RedLine } from "@/lib/engine/types";
import { redLinesFromRows } from "@/lib/red-lines/rows";

export type SavedRunInput = {
  documentId: string;
  /** The stored document text, in canonical form. */
  body: string;
  /** The buyer's red_lines rows, as the table returns them. */
  redLineRows: unknown;
  client: ModelClient;
};

export type SavedRun = {
  analysis: Analysis;
  diagnostics: AnalysisDiagnostics;
  /** The red lines the run used, in the order the buyer added them. */
  redLines: RedLine[];
  /** The analyses row to insert: the result and the snapshot it ran with. */
  insert: { document_id: string; result: Analysis; red_lines: RedLine[] };
};

export async function runSavedAnalysis({
  documentId,
  body,
  redLineRows,
  client,
}: SavedRunInput): Promise<{ ok: true; run: SavedRun } | { ok: false; reason: "red-lines-unreadable" }> {
  const redLines = redLinesFromRows(redLineRows);
  if (!redLines) return { ok: false, reason: "red-lines-unreadable" };
  const { analysis, diagnostics } = await analyse({ text: body, redLines, client });
  return {
    ok: true,
    run: { analysis, diagnostics, redLines, insert: { document_id: documentId, result: analysis, red_lines: redLines } },
  };
}
