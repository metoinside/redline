// A saved document's analysis history, as the library shows it (#11). Each
// analyses row becomes one entry: when it ran, the red lines it ran with, and
// what it found. Nothing stored is taken on trust:
//  - the red lines come from the row's own snapshot (analyses.red_lines),
//    never from the buyer's current red_lines rows, so an old run shows what
//    it was based on after the red lines change;
//  - whether the run was clean, and how many flags it has in each tier, are
//    worked out again by checkStoredAnalysis against the document text and
//    that snapshot. A stored tier, breach or "clean" is never read;
//  - a run that fails the re-check (saved by an earlier version, unreadable,
//    a snapshot that isn't valid, or wording that fails the check) is marked
//    as needing a re-run, and no result is given for it.
//
// Safe to import in the browser.

import { checkStoredAnalysis } from "@/lib/engine/stored";
import { parseRedLines } from "@/lib/engine/red-lines";
import type { RedLine } from "@/lib/engine/types";

/** An analyses row as the library selects it. */
export type AnalysisRow = { id: string; created_at: string; result: unknown; red_lines: unknown };

export type HistoryResult =
  /** The clean-result rule held: nothing to negotiate and no outside-terms notice. */
  | { kind: "clean" }
  /** Not clean: the flags in each tier that passed the re-check, and the outside-terms notices. */
  | { kind: "flags"; negotiate: number; know: number; outsideTerms: number }
  /**
   * The run can't be shown. outdated: saved by an earlier version of Redline.
   * failed: it didn't pass the checks Redline runs on every saved analysis.
   */
  | { kind: "needs-rerun"; reason: "outdated" | "failed" };

export type HistoryEntry = {
  id: string;
  /** The run date, as an ISO string. */
  ranAt: string;
  /** The run's own red-line snapshot, or null when the snapshot isn't a valid list of red lines. */
  redLines: RedLine[] | null;
  result: HistoryResult;
};

/** Every run of a document, newest first, each checked again against `body` and its own snapshot. */
export function analysisHistory(rows: readonly AnalysisRow[], body: string): HistoryEntry[] {
  return [...rows]
    .map((row) => ({ row, time: Date.parse(row.created_at) }))
    .sort((a, b) => b.time - a.time || (a.row.id < b.row.id ? 1 : -1))
    .map(({ row }) => historyEntry(row, body));
}

function historyEntry(row: AnalysisRow, body: string): HistoryEntry {
  const ranAt = new Date(row.created_at).toISOString();
  const check = checkStoredAnalysis(row.result, body, row.red_lines);
  if (!check.ok) {
    return {
      id: row.id,
      ranAt,
      redLines: parseRedLines(row.red_lines),
      result: { kind: "needs-rerun", reason: check.reason === "outdated" ? "outdated" : "failed" },
    };
  }
  const { analysis } = check;
  const result: HistoryResult = analysis.outcome.clean
    ? { kind: "clean" }
    : {
        kind: "flags",
        negotiate: analysis.flags.filter((f) => f.tier === "negotiate").length,
        know: analysis.flags.filter((f) => f.tier === "know").length,
        outsideTerms: analysis.outsideTerms.length,
      };
  return { id: row.id, ranAt, redLines: check.redLines, result };
}
