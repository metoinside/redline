// The red lines form, read on the server. Nothing the browser sends is
// trusted: the clause type, the kind of limit and the figure are checked here
// with the same rules as the engine's red-line shape and the table's check
// constraints.

import { parseLimit } from "@/lib/engine/red-lines";
import { NUMERIC_LIMIT_KIND, isClauseType, type NumericLimitKind, type RedLine } from "@/lib/engine/types";

export { rowValues } from "./rows";

/**
 * The form's fields: clauseType (one of the five), limitKind ("not_allowed",
 * or "limit" for the figure-limit its clause type takes) and limitValue (a
 * whole number, commas and a leading "$" allowed).
 */
export type RedLineInput =
  | { ok: true; redLine: RedLine }
  | { ok: false; error: "clause-type" | "limit-kind" }
  | { ok: false; error: "value"; kind: NumericLimitKind };

const field = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
};

export function readRedLineInput(data: FormData): RedLineInput {
  const clauseType = field(data, "clauseType");
  if (!isClauseType(clauseType)) return { ok: false, error: "clause-type" };

  const limitKind = field(data, "limitKind");
  if (limitKind === "not_allowed") return { ok: true, redLine: { clauseType, limit: { kind: "not_allowed" } } };
  if (limitKind !== "limit") return { ok: false, error: "limit-kind" };

  const kind = NUMERIC_LIMIT_KIND[clauseType];
  const raw = field(data, "limitValue").replace(/^\$\s*/, "").replace(/,/g, "");
  const value = /^\d{1,12}$/.test(raw) ? Number(raw) : NaN;
  const limit = parseLimit(clauseType, { kind, value });
  if (!limit) return { ok: false, error: "value", kind };
  return { ok: true, redLine: { clauseType, limit } };
}
