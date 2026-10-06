// Reading a saved analysis back. A stored result is JSON from the database,
// or from the server to the browser, so none of it is taken on trust. Before
// any of it is shown:
//  - its shape is checked, and a flag that is malformed is left out;
//  - every citation is checked again against the document text it will be
//    shown beside, and a flag that fails is left out (ADR 0001);
//  - every exposure fragment is checked again against its citation, the money
//    amount is read again from the fragment, red-line breaches are worked out
//    again from the red lines the run used (the analyses.red_lines snapshot,
//    passed in), and the tier and order are worked out again from what
//    survived (ADR 0003, 0005). A breach stored on a flag is never read;
//  - the snapshot itself must be a list of valid red lines, or nothing is
//    shown: a tier worked out from a partial snapshot could hide a breach;
//  - every outside-terms notice's citation is checked again the same way, and
//    a notice that fails is left out;
//  - every summary point's and notice obligation's citation is checked again
//    the same way, and each deadline again against its citation (a stated
//    date must be in the sentence, a rule must name no date the sentence
//    doesn't); one that fails is left out (lib/engine/summary.ts);
//  - every flag that survives must still carry a counter-offer with a
//    replacement that changes its sentence and a message. If one doesn't,
//    nothing from the analysis is shown, never a flag without its
//    counter-offer. The sentence a counter-offer replaces is set again from
//    its flag's checked citation; the stored one is never read. A flag that
//    fails its citation check is left out with its counter-offer. A
//    counter-offer stored on an outside-terms notice is never read
//    (lib/engine/counter-offers.ts);
//  - the wording check runs again over every statement, reading,
//    counter-offer replacement and message, notice description, summary
//    point, obligation description and deadline rule. If any defect is found,
//    nothing from the analysis is shown: a confident, checked result or none;
//  - whether the result is clean, and its checklist, are worked out again from
//    the flags and notices that survived (lib/engine/clean.ts). A stored
//    "clean" is never read.
//
// An analysis saved before schema version 5 is not shown. It is reported as
// outdated so the buyer can run it again. Version 1 (#4) has no tiers, so its
// $48,000 renewal would rank no higher than a benign one. Version 2 (#5) was
// never asked about outside terms, so a clean result worked out from it could
// be a false all-clear. Version 3 (#5, #7, #10) has no summary and no notice
// obligations, so a deadline the buyer has to meet would go unshown. Version
// 4 (#6) has no counter-offers, and a flag is never shown without one.
//
// Safe to import in the browser.

import { citationMatches } from "./citations";
import { decideOutcome } from "./clean";
import { counterOfferPieces, readCounterOffer } from "./counter-offers";
import { checkExposure, parseMoneyAmount } from "./exposure";
import { findBreaches, parseRedLines } from "./red-lines";
import { byDocumentOrder, checkDeadline, obligationPieces, summaryPieces } from "./summary";
import { assignTier, rankFlags } from "./tiers";
import {
  ANALYSIS_SCHEMA_VERSION,
  isClauseType,
  type Analysis,
  type Citation,
  type Flag,
  type NoticeObligation,
  type OutsideTermsNotice,
  type Readings,
  type RedLine,
  type SummaryPoint,
} from "./types";
import { findWordingDefects } from "./wording";

export type StoredAnalysisCheck =
  /** redLines: the run's snapshot, checked, for showing which red lines it ran with. */
  | { ok: true; analysis: Analysis; redLines: RedLine[] }
  /**
   * outdated: saved by an earlier version, and needs a re-run.
   * wording: generated text failed the wording check.
   * unreadable: not an analysis this version can read, its red-line snapshot is not valid, or a flag has no usable counter-offer.
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

/**
 * A flag to show, null for one left out (malformed, or its citation fails),
 * or "no_counter_offer" for a flag that would be shown but has no usable
 * counter-offer, which makes the whole analysis unreadable.
 */
function readFlag(value: unknown, storedText: string, redLines: readonly RedLine[]): Flag | null | "no_counter_offer" {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || !isClauseType(raw.clauseType)) return null;
  const citation = readCitation(raw.citation);
  if (!citation || !citationMatches(storedText, citation)) return null;
  if (typeof raw.statement !== "string" || raw.statement.trim() === "") return null;
  const readings = readReadings(raw.readings);
  if (!readings) return null;
  if (typeof raw.exposure !== "object" || raw.exposure === null || Array.isArray(raw.exposure)) return null;
  const offer = readCounterOffer(raw.counterOffer, citation);
  if (!offer.ok) return "no_counter_offer";

  const { exposure } = checkExposure(raw.exposure as Record<string, unknown>, citation.text);
  const moneyAmount = exposure.money ? parseMoneyAmount(exposure.money) : null;
  const redLineBreaches = findBreaches({ clauseType: raw.clauseType, exposure }, redLines);
  const tier = assignTier({ exposure, readings }, redLineBreaches);
  return {
    id: raw.id,
    clauseType: raw.clauseType,
    citation,
    tier,
    statement: raw.statement,
    exposure,
    moneyAmount,
    readings,
    redLineBreaches,
    counterOffer: offer.counterOffer,
  };
}

function readNotice(value: unknown, storedText: string): OutsideTermsNotice | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string") return null;
  const citation = readCitation(raw.citation);
  if (!citation || !citationMatches(storedText, citation)) return null;
  if (typeof raw.document !== "string" || raw.document.trim() === "") return null;
  return { id: raw.id, citation, document: raw.document };
}

function readSummaryPoint(value: unknown, storedText: string): SummaryPoint | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string") return null;
  const citation = readCitation(raw.citation);
  if (!citation || !citationMatches(storedText, citation)) return null;
  if (typeof raw.text !== "string" || raw.text.trim() === "") return null;
  return { id: raw.id, text: raw.text, citation };
}

function readObligation(value: unknown, storedText: string): NoticeObligation | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string") return null;
  const citation = readCitation(raw.citation);
  if (!citation || !citationMatches(storedText, citation)) return null;
  if (typeof raw.description !== "string" || raw.description.trim() === "") return null;
  const deadline = checkDeadline(raw.deadline, citation.text);
  if (!deadline.ok) return null;
  return { id: raw.id, description: raw.description, deadline: deadline.deadline, citation };
}

/**
 * Checks a saved analysis against the text it will be shown beside and the
 * red lines it ran with (its analyses.red_lines snapshot, as stored), and
 * says why when it can't be shown.
 */
export function checkStoredAnalysis(value: unknown, storedText: string, redLineSnapshot: unknown): StoredAnalysisCheck {
  if (typeof value !== "object" || value === null) return { ok: false, reason: "unreadable" };
  const raw = value as Record<string, unknown>;
  const version = raw.schemaVersion;
  if (typeof version === "number" && Number.isInteger(version) && version >= 1 && version < ANALYSIS_SCHEMA_VERSION) {
    return { ok: false, reason: "outdated" };
  }
  if (
    version !== ANALYSIS_SCHEMA_VERSION ||
    !Array.isArray(raw.flags) ||
    !Array.isArray(raw.outsideTerms) ||
    !Array.isArray(raw.summary) ||
    !Array.isArray(raw.noticeObligations)
  ) {
    return { ok: false, reason: "unreadable" };
  }
  const redLines = parseRedLines(redLineSnapshot);
  if (!redLines) return { ok: false, reason: "unreadable" };

  const read = raw.flags.map((f) => readFlag(f, storedText, redLines));
  if (read.includes("no_counter_offer")) return { ok: false, reason: "unreadable" };
  const flags = read.filter((f): f is Flag => f !== null && f !== "no_counter_offer");
  const notices = raw.outsideTerms
    .map((n) => readNotice(n, storedText))
    .filter((n): n is OutsideTermsNotice => n !== null)
    .sort((a, b) => a.citation.start - b.citation.start || a.citation.end - b.citation.end);
  const summary = raw.summary
    .map((p) => readSummaryPoint(p, storedText))
    .filter((p): p is SummaryPoint => p !== null)
    .sort(byDocumentOrder);
  const obligations = raw.noticeObligations
    .map((o) => readObligation(o, storedText))
    .filter((o): o is NoticeObligation => o !== null)
    .sort(byDocumentOrder);
  const defects = findWordingDefects([
    ...summary.flatMap((p) => summaryPieces(p, p.id)),
    ...obligations.flatMap((o) => obligationPieces(o, o.id)),
    ...flags.flatMap((f) => [
      { field: `${f.id} statement`, text: f.statement },
      ...f.readings.map((r, i) => ({ field: `${f.id} reading ${i + 1}`, text: r })),
      ...counterOfferPieces(f.counterOffer, f.id),
    ]),
    ...notices.map((n) => ({ field: `${n.id} document`, text: n.document })),
  ]);
  if (defects.length > 0) return { ok: false, reason: "wording" };

  const ranked = rankFlags(flags);
  return {
    ok: true,
    analysis: {
      schemaVersion: ANALYSIS_SCHEMA_VERSION,
      summary,
      noticeObligations: obligations,
      flags: ranked,
      outsideTerms: notices,
      outcome: decideOutcome(ranked, notices),
    },
    redLines,
  };
}

/** The analysis to show beside `storedText`, or null when it can't be shown (see checkStoredAnalysis for why). */
export function readStoredAnalysis(value: unknown, storedText: string, redLineSnapshot: unknown): Analysis | null {
  const check = checkStoredAnalysis(value, storedText, redLineSnapshot);
  return check.ok ? check.analysis : null;
}
