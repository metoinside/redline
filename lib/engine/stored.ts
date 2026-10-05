// Reading a saved analysis back. A stored result is JSON from the database,
// or from the server to the browser, so none of it is taken on trust. Before
// any of it is shown:
//  - its shape is checked, and a flag that is malformed is left out;
//  - every citation is checked again against the document text it will be
//    shown beside, and a flag that fails is left out (ADR 0001);
//  - every exposure fragment is checked again against its citation, the money
//    amount is read again from the fragment, and the tier and order are worked
//    out again from what survived (ADR 0003, 0005);
//  - the wording check runs again over every statement and reading. If any
//    defect is found, nothing from the analysis is shown: a confident, checked
//    result or none.
//
// An analysis saved before schema version 2 (#4: auto-renewal only, with no
// tier, exposure or readings) is not shown. It is reported as outdated so the
// buyer can run it again: showing its flags without tiers would rank a
// $48,000 renewal no higher than a benign one.
//
// Safe to import in the browser.

import { citationMatches } from "./citations";
import { checkExposure, parseMoneyAmount } from "./exposure";
import { assignTier, rankFlags } from "./tiers";
import { ANALYSIS_SCHEMA_VERSION, isClauseType, type Analysis, type Citation, type Flag, type Readings } from "./types";
import { findWordingDefects } from "./wording";

export type StoredAnalysisCheck =
  | { ok: true; analysis: Analysis }
  /**
   * outdated: saved by an earlier version, and needs a re-run.
   * wording: generated text failed the wording check.
   * unreadable: not an analysis this version can read.
   */
  | { ok: false; reason: "outdated" | "wording" | "unreadable" };

function readCitation(value: unknown): Citation | null {
  if (typeof value !== "object" || value === null) return null;
  const { text, start, end } = value as Record<string, unknown>;
  if (typeof text !== "string" || typeof start !== "number" || typeof end !== "number") return null;
  return { text, start, end };
}

function readReadings(value: unknown): Readings | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) return null;
  if (!value.every((r) => typeof r === "string" && r.trim() !== "")) return null;
  return value.length === 1 ? [value[0] as string] : [value[0] as string, value[1] as string];
}

function readFlag(value: unknown, storedText: string): Flag | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || !isClauseType(raw.clauseType)) return null;
  const citation = readCitation(raw.citation);
  if (!citation || !citationMatches(storedText, citation)) return null;
  if (typeof raw.statement !== "string" || raw.statement.trim() === "") return null;
  const readings = readReadings(raw.readings);
  if (!readings) return null;
  if (typeof raw.exposure !== "object" || raw.exposure === null || Array.isArray(raw.exposure)) return null;

  const { exposure } = checkExposure(raw.exposure as Record<string, unknown>, citation.text);
  const moneyAmount = exposure.money ? parseMoneyAmount(exposure.money) : null;
  // No red-line breaches are stored yet (#10 adds them), so none is passed.
  const tier = assignTier({ exposure, readings }, []);
  return { id: raw.id, clauseType: raw.clauseType, citation, tier, statement: raw.statement, exposure, moneyAmount, readings };
}

/** Checks a saved analysis against the text it will be shown beside, and says why when it can't be shown. */
export function checkStoredAnalysis(value: unknown, storedText: string): StoredAnalysisCheck {
  if (typeof value !== "object" || value === null) return { ok: false, reason: "unreadable" };
  const raw = value as Record<string, unknown>;
  const version = raw.schemaVersion;
  if (typeof version === "number" && Number.isInteger(version) && version >= 1 && version < ANALYSIS_SCHEMA_VERSION) {
    return { ok: false, reason: "outdated" };
  }
  if (version !== ANALYSIS_SCHEMA_VERSION || !Array.isArray(raw.flags)) return { ok: false, reason: "unreadable" };

  const flags = raw.flags.map((f) => readFlag(f, storedText)).filter((f): f is Flag => f !== null);
  const defects = findWordingDefects(
    flags.flatMap((f) => [
      { field: `${f.id} statement`, text: f.statement },
      ...f.readings.map((r, i) => ({ field: `${f.id} reading ${i + 1}`, text: r })),
    ]),
  );
  if (defects.length > 0) return { ok: false, reason: "wording" };

  return { ok: true, analysis: { schemaVersion: ANALYSIS_SCHEMA_VERSION, flags: rankFlags(flags) } };
}

/** The analysis to show beside `storedText`, or null when it can't be shown (see checkStoredAnalysis for why). */
export function readStoredAnalysis(value: unknown, storedText: string): Analysis | null {
  const check = checkStoredAnalysis(value, storedText);
  return check.ok ? check.analysis : null;
}
