// The red_lines table's rows (supabase/migrations/20261006150000_red_lines.sql)
// and the engine's RedLine shape, each way. A row that doesn't make a valid
// red line is never turned into one quietly: the reader says so.

import { parseRedLine } from "@/lib/engine/red-lines";
import type { RedLine } from "@/lib/engine/types";

/** The columns every read of red_lines selects. */
export const RED_LINE_COLUMNS = "id, clause_type, limit_kind, limit_value, created_at, updated_at";

export type RedLineRow = {
  id: string;
  clause_type: string;
  limit_kind: string;
  limit_value: number | null;
  created_at?: string;
  updated_at?: string;
};

/** The table values for a red line: what an insert or update writes. */
export type RedLineValues = Pick<RedLineRow, "clause_type" | "limit_kind" | "limit_value">;

/** A red line from a row, or null when the row isn't a valid one. */
export function redLineFromRow(row: unknown): RedLine | null {
  if (typeof row !== "object" || row === null) return null;
  const { id, clause_type, limit_kind, limit_value } = row as Record<string, unknown>;
  if (typeof id !== "string") return null;
  const limit = limit_kind === "not_allowed" && limit_value === null ? { kind: limit_kind } : { kind: limit_kind, value: limit_value };
  return parseRedLine({ id, clauseType: clause_type, limit });
}

/** Every row as a red line, or null when the list isn't a list or any row is invalid. */
export function redLinesFromRows(rows: unknown): RedLine[] | null {
  if (!Array.isArray(rows)) return null;
  const lines = rows.map(redLineFromRow);
  return lines.every((l): l is RedLine => l !== null) ? lines : null;
}

export function rowValues({ clauseType, limit }: RedLine): RedLineValues {
  return { clause_type: clauseType, limit_kind: limit.kind, limit_value: limit.kind === "not_allowed" ? null : limit.value };
}
