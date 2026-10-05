// The analysis engine's data shapes (spec, "Data shapes"). Safe to import
// anywhere, the browser included: types and constants only.
//
// An Analysis is stored as JSON (analyses.result) and read back by later
// versions of the app, so every field a later ticket adds is optional on the
// stored shape or comes with a new schemaVersion. #5 added tier, statement,
// exposure, moneyAmount and readings to Flag (schema version 2). Tickets
// #6-#10 add to Flag: redLineBreached, counterOffer; and to Analysis: summary,
// noticeObligations, outsideTerms, clean.

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

/**
 * A flag's severity, named for what the buyer should do (ADR 0003). Never a
 * score and never high/medium/low.
 */
export type Tier = "negotiate" | "know";

/** The tiers in the order they are shown. */
export const TIERS: readonly Tier[] = ["negotiate", "know"];

/**
 * What a clause costs the buyer, according to the document. Each part is an
 * exact fragment of the flag's citation (the document's own words), present
 * only when the citation states it. Money and lock-in parts always contain a
 * figure.
 */
export interface Exposure {
  /** The money committed, such as "$48,000 per year", or a formula for it. */
  money?: string;
  /** How long the buyer is locked in, such as "thirty-six (36) months". */
  lockIn?: string;
  /** How hard it is to get out, such as a notice period or a termination fee. */
  exitDifficulty?: string;
}

export type ExposurePart = keyof Exposure;

export const EXPOSURE_PARTS: readonly ExposurePart[] = ["money", "lockIn", "exitDifficulty"];

/** How the cited sentence reads: one reading, or exactly two when it can genuinely be read two ways (ADR 0005). */
export type Readings = [string] | [string, string];

/** A clause from the renewal-and-exit family marked as a risk to the buyer, with its citation. */
export interface Flag {
  /** Unique within its analysis ("f1", "f2", ...), numbered in document order. */
  id: string;
  clauseType: ClauseType;
  citation: Citation;
  /** Worked out in code from the checked exposure, the readings and any red-line breach. */
  tier: Tier;
  /** What the cited sentence does, in plain words. Passed the wording check. */
  statement: string;
  exposure: Exposure;
  /** The largest sum read in code from exposure.money, or null when it states none. Used to order flags. */
  moneyAmount: number | null;
  readings: Readings;
}

/**
 * A flag's clause breaching one of the buyer's red lines. #10 works these out
 * from the buyer's red lines; the tier rule takes them as an input.
 */
export interface RedLineBreach {
  redLine: RedLine;
}

/** A term the buyer will not accept (#10 fills these in). An input to every analysis. */
export interface RedLine {
  clauseType: ClauseType;
  /** The limit in the buyer's words, such as "no notice window longer than 60 days". */
  limit: string;
}

export const ANALYSIS_SCHEMA_VERSION = 2;

/** What the buyer sees for one analysis run. */
export interface Analysis {
  schemaVersion: typeof ANALYSIS_SCHEMA_VERSION;
  /**
   * Every flag that passed the checks, in ranked order: Negotiate before
   * signing first, then Know before signing; within a tier by moneyAmount,
   * highest first, then flags with no sum in document order.
   */
  flags: Flag[];
}

/** Why the engine left out an item the model returned. */
export type DropReason =
  /** Not an object with a clause type, a sentence, a statement and one or two readings. */
  | "malformed"
  /** A clause type outside the renewal-and-exit family. */
  | "unknown_clause_type"
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

/** Why the engine left out one part of a kept flag's exposure. */
export type ExposureDropReason =
  /** Not a string. */
  | "malformed"
  /** Not an exact substring of the flag's citation after normalisation. */
  | "not_in_citation"
  /** A money or lock-in part with no figure in it. */
  | "no_figure";

export interface DroppedExposure {
  /** Position of the clause in the model's list, from 0. */
  index: number;
  part: ExposurePart;
  /** The fragment as the model wrote it, when it wrote a string. */
  fragment: string | null;
  reason: ExposureDropReason;
}

/** A banned word found in a piece of generated text (lib/engine/wording.ts). */
export interface WordingDefect {
  /** Which piece of text, such as "clause 3 (auto_renewal) statement". */
  field: string;
  /** The banned word or phrase, as the list writes it. */
  term: string;
}

export interface WordingAttempt {
  /** 1 for the first answer, 2 for the retry. */
  attempt: number;
  defects: WordingDefect[];
}

/** How an analysis run went. Printed by the smoke script; never shown to the buyer. */
export interface AnalysisDiagnostics {
  /** Items the model returned (in the answer that was used). */
  returned: number;
  /** Items that became flags. */
  kept: number;
  dropped: DroppedItem[];
  droppedByReason: Partial<Record<DropReason, number>>;
  /** Exposure parts removed from kept flags. */
  exposureDropped: DroppedExposure[];
  /** The wording check on each answer the model gave. */
  wording: WordingAttempt[];
}

export interface AnalyseResult {
  analysis: Analysis;
  diagnostics: AnalysisDiagnostics;
}
