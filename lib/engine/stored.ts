// Reading a saved analysis back. A stored result is JSON from the database,
// or from the server to the browser; before any of it is shown, its shape is
// checked and every citation is checked again against the document text it
// will be shown beside. A flag that fails is left out (ADR 0001).
//
// Safe to import in the browser.

import { citationMatches } from "./citations";
import { ANALYSIS_SCHEMA_VERSION, isClauseType, type Analysis, type Citation, type Flag } from "./types";

function readCitation(value: unknown): Citation | null {
  if (typeof value !== "object" || value === null) return null;
  const { text, start, end } = value as Record<string, unknown>;
  if (typeof text !== "string" || typeof start !== "number" || typeof end !== "number") return null;
  return { text, start, end };
}

function readFlag(value: unknown, storedText: string): Flag | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || !isClauseType(raw.clauseType)) return null;
  const citation = readCitation(raw.citation);
  if (!citation || !citationMatches(storedText, citation)) return null;
  // Keep any fields a later version added; they are shown only by code that knows them.
  return { ...(raw as object), id: raw.id, clauseType: raw.clauseType, citation } as Flag;
}

/** The analysis to show beside `storedText`, or null when `value` isn't an analysis this version can read. */
export function readStoredAnalysis(value: unknown, storedText: string): Analysis | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== ANALYSIS_SCHEMA_VERSION || !Array.isArray(raw.flags)) return null;
  const flags = raw.flags.map((f) => readFlag(f, storedText)).filter((f): f is Flag => f !== null);
  return { ...(raw as object), schemaVersion: ANALYSIS_SCHEMA_VERSION, flags } as Analysis;
}
