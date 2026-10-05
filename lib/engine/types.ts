// The analysis engine's data shapes (spec, "Data shapes"). Safe to import
// anywhere, the browser included: types and constants only.
//
// An Analysis is stored as JSON (analyses.result) and read back by later
// versions of the app, so every field a later ticket adds is optional on the
// stored shape or comes with a new schemaVersion. Tickets #5-#10 add to Flag:
// tier, exposure, readings, redLineBreached, counterOffer; and to Analysis:
// summary, noticeObligations, outsideTerms, clean.

/** The renewal-and-exit family (ADR 0004): the only clause types that can become flags. */
export type ClauseType = "auto_renewal" | "notice_window" | "early_termination_fee" | "rollover" | "multi_year_term";

export const CLAUSE_TYPES: readonly ClauseType[] = [
  "auto_renewal",
  "notice_window",
  "early_termination_fee",
  "rollover",
  "multi_year_term",
];

export function isClauseType(value: unknown): value is ClauseType {
  return typeof value === "string" && (CLAUSE_TYPES as readonly string[]).includes(value);
}

/**
 * The exact sentence a flag or claim comes from (ADR 0001). `start` and `end`
 * are offsets into the stored document text, in UTF-16 code units as
 * String.prototype.slice counts them: text.slice(start, end) === this.text.
 */
export interface Citation {
  text: string;
  start: number;
  end: number;
}

/** A clause from the renewal-and-exit family marked as a risk to the buyer, with its citation. */
export interface Flag {
  /** Unique within its analysis ("f1", "f2", ...), in document order. */
  id: string;
  clauseType: ClauseType;
  citation: Citation;
}

/** A term the buyer will not accept (#10 fills these in). An input to every analysis. */
export interface RedLine {
  clauseType: ClauseType;
  /** The limit in the buyer's words, such as "no notice window longer than 60 days". */
  limit: string;
}

export const ANALYSIS_SCHEMA_VERSION = 1;

/** What the buyer sees for one analysis run. */
export interface Analysis {
  schemaVersion: typeof ANALYSIS_SCHEMA_VERSION;
  /** Every flag that passed the citation check, in document order. */
  flags: Flag[];
}

/** Why the engine left out an item the model returned. */
export type DropReason =
  /** Not an object with a clause type and a sentence. */
  | "malformed"
  /** A clause type outside the renewal-and-exit family. */
  | "unknown_clause_type"
  /** In the family, but not one this version shows yet (see ALLOWED_CLAUSE_TYPES). */
  | "clause_type_not_in_scope"
  /** Too short to stand as a citation, even if it is in the text. */
  | "quote_too_short"
  /** Not found word for word in the stored text after normalisation. */
  | "citation_not_found"
  /** The same clause type and citation as an item already kept. */
  | "duplicate";

export interface DroppedItem {
  /** Position in the model's list, from 0. */
  index: number;
  reason: DropReason;
  /** The clause type as the model wrote it, when it wrote a string. */
  clauseType: string | null;
  /** The quote as the model wrote it, when it wrote a string. */
  quote: string | null;
}

/** How an analysis run went. Printed by the smoke script; never shown to the buyer. */
export interface AnalysisDiagnostics {
  /** Items the model returned. */
  returned: number;
  /** Items that became flags. */
  kept: number;
  dropped: DroppedItem[];
  droppedByReason: Partial<Record<DropReason, number>>;
}

export interface AnalyseResult {
  analysis: Analysis;
  diagnostics: AnalysisDiagnostics;
}
