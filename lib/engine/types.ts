// The analysis engine's data shapes (spec, "Data shapes"). Safe to import
// anywhere, the browser included: types and constants only.
//
// An Analysis is stored as JSON (analyses.result) and read back by later
// versions of the app, so every field a later ticket adds is optional on the
// stored shape or comes with a new schemaVersion. #5 added tier, statement,
// exposure, moneyAmount and readings to Flag (schema version 2). #7 added
// outsideTerms and outcome to Analysis (schema version 3). #10 added
// redLineBreaches to Flag without a new version: it is worked out again on
// every read from the red lines the run used (the analyses.red_lines
// snapshot), never read from the stored flag, and every version 3 analysis
// saved before #10 ran with no red lines. Tickets #6, #8 add to Flag:
// counterOffer; and to Analysis: summary, noticeObligations.

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
  /**
   * The buyer's red lines this clause breaches, in the order the red lines
   * were given. Any breach puts the flag in Negotiate before signing.
   */
  redLineBreaches: RedLineBreach[];
}

/**
 * How a red line limits its clause type, in a form code can check (#10):
 *  - not_allowed: no clause of the type at all;
 *  - max_days: the longest notice period the buyer accepts (notice_window);
 *  - max_months: the longest renewal or rollover term, or lock-in, the buyer
 *    accepts (auto_renewal, rollover, multi_year_term);
 *  - max_dollars: the highest fee the buyer accepts (early_termination_fee).
 * Values are whole numbers. The same rules are check constraints on the
 * red_lines table (supabase/migrations/20261006150000_red_lines.sql).
 */
export type RedLineLimit =
  | { kind: "not_allowed" }
  | { kind: "max_days"; value: number }
  | { kind: "max_months"; value: number }
  | { kind: "max_dollars"; value: number };

export type RedLineLimitKind = RedLineLimit["kind"];
export type NumericLimitKind = Exclude<RedLineLimitKind, "not_allowed">;

/** The limits each clause type can take: "not allowed", and the one figure its clauses state. */
export const LIMIT_KINDS: Record<ClauseType, readonly RedLineLimitKind[]> = {
  auto_renewal: ["not_allowed", "max_months"],
  notice_window: ["not_allowed", "max_days"],
  early_termination_fee: ["not_allowed", "max_dollars"],
  rollover: ["not_allowed", "max_months"],
  multi_year_term: ["not_allowed", "max_months"],
};

/** The figure-limit for a clause type (the one that isn't "not allowed"). */
export const NUMERIC_LIMIT_KIND: Record<ClauseType, NumericLimitKind> = {
  auto_renewal: "max_months",
  notice_window: "max_days",
  early_termination_fee: "max_dollars",
  rollover: "max_months",
  multi_year_term: "max_months",
};

/** Inclusive bounds on a figure-limit's value. Ten years, twenty years, $100 million. */
export const LIMIT_VALUE_RANGE: Record<NumericLimitKind, { min: number; max: number }> = {
  max_days: { min: 1, max: 3650 },
  max_months: { min: 1, max: 240 },
  max_dollars: { min: 1, max: 100_000_000 },
};

/** A term the buyer will not accept: a limit on one clause type in the family. An input to every analysis. */
export interface RedLine {
  /** The red_lines row it came from, when it came from one. Never used to decide a breach. */
  id?: string;
  clauseType: ClauseType;
  limit: RedLineLimit;
}

/**
 * A flag's clause breaching one of the buyer's red lines, worked out in code
 * from the flag's checked exposure (lib/engine/red-lines.ts), never by the model.
 */
export interface RedLineBreach {
  redLine: RedLine;
  /**
   * The words in the flag's citation that breach a figure-limit, such as
   * "ninety (90) days" or "$25,000". null for a "not allowed" red line,
   * which any flag of its type breaches.
   */
  cited: string | null;
}

/**
 * A cited sentence showing that the document brings in terms from another
 * document Redline has not read (ADR 0006). It is not a flag: it has no tier
 * and no counter-offer, and it is not limited to the renewal-and-exit family.
 */
export interface OutsideTermsNotice {
  /** Unique within its analysis ("n1", "n2", ...), numbered in document order. */
  id: string;
  citation: Citation;
  /** The document the buyer should upload next, as the model describes it. Passed the wording check. */
  document: string;
}

/**
 * One line of a clean result's checklist: a clause type, and either the
 * Know before signing flags found for it, or "we found none". Worked out in
 * code from the verified flags, never from model text.
 */
export type ChecklistEntry =
  | { clauseType: ClauseType; status: "found_low_exposure"; found: { flagId: string; citation: Citation }[] }
  | { clauseType: ClauseType; status: "none_found" };

/**
 * The clean-result rule (ADR 0006), worked out in code: clean only when there
 * is no Negotiate before signing flag and no outside-terms notice. A clean
 * result carries the five-type checklist; a result that is not clean says
 * what stopped it.
 */
export type AnalysisOutcome =
  | { clean: true; checklist: ChecklistEntry[] }
  | { clean: false; negotiateFlags: number; outsideTermsNotices: number };

export const ANALYSIS_SCHEMA_VERSION = 3;

/** What the buyer sees for one analysis run. */
export interface Analysis {
  schemaVersion: typeof ANALYSIS_SCHEMA_VERSION;
  /**
   * Every flag that passed the checks, in ranked order: Negotiate before
   * signing first, then Know before signing; within a tier by moneyAmount,
   * highest first, then flags with no sum in document order.
   */
  flags: Flag[];
  /** Every outside-terms notice whose citation passed the check, in document order. */
  outsideTerms: OutsideTermsNotice[];
  /** Whether the result is clean, from the flags and notices above. Worked out again on every read. */
  outcome: AnalysisOutcome;
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
/** Why the engine left out an outside-terms sentence the model returned. */
export type NoticeDropReason = "malformed" | "quote_too_short" | "citation_not_found" | "duplicate";

export interface DroppedNotice {
  /** Position in the model's outside-terms list, from 0. */
  index: number;
  reason: NoticeDropReason;
  /** The quote as the model wrote it, when it wrote a string. */
  quote: string | null;
}

export interface AnalysisDiagnostics {
  /** Items the model returned (in the answer that was used). */
  returned: number;
  /** Items that became flags. */
  kept: number;
  dropped: DroppedItem[];
  droppedByReason: Partial<Record<DropReason, number>>;
  /** Exposure parts removed from kept flags. */
  exposureDropped: DroppedExposure[];
  /** Outside-terms sentences the model returned (in the answer that was used). */
  outsideTermsReturned: number;
  /** Outside-terms sentences left out, and why. Only verified notices reach the analysis. */
  outsideTermsDropped: DroppedNotice[];
  /** The wording check on each answer the model gave. */
  wording: WordingAttempt[];
}

export interface AnalyseResult {
  analysis: Analysis;
  diagnostics: AnalysisDiagnostics;
}
