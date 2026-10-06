// The summary and its notice obligations (PRD §3 item 2; ADR 0001, 0002,
// 0005), the rules applied in code both when the model answers (analyse.ts)
// and when a saved analysis is read back (stored.ts):
//  - every summary point and notice obligation cites a sentence that must be
//    found word for word in the stored text, or it is left out (the citation
//    check itself is in citations.ts);
//  - a deadline is either a date the sentence states, in the sentence's own
//    words, or the rule for working one out with what it counts from. Redline
//    never works out a calendar date the text does not state, so a deadline
//    that names a date, a year or a day of a month its sentence doesn't is
//    left out with its obligation;
//  - every point, description, rule and "counts from" goes through the
//    wording check. The date itself is the document's own words and, like a
//    citation, is quoted as it is.
//
// Safe to import in the browser: stored analyses are checked again there.

import { normalizeFragment } from "@/lib/extraction/normalize";
import type { Citation, NoticeDeadline, NoticeObligation, SummaryPoint } from "./types";
import type { WordingPiece } from "./wording";

export type DeadlineCheck = { ok: true; deadline: NoticeDeadline } | { ok: false; reason: "malformed" | "date_not_in_citation" };

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

/** Anything that reads as a calendar date or part of one: a year, a month with a day, or a numeric date. */
const DATE_PARTS = new RegExp(
  [
    `\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`,
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b`,
    "\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b",
    "\\b\\d{1,2}[/.]\\d{1,2}[/.]\\d{2,4}\\b",
    "\\b(?:1[89]|2[01])\\d{2}\\b",
  ].join("|"),
  "gi",
);

const squash = (text: string) => normalizeFragment(text).toLowerCase().replace(/\s+/g, " ");

/** The dates, years and days of a month in `text` that `citationText` doesn't state. */
export function datesNotInCitation(text: string, citationText: string): string[] {
  const cited = squash(citationText);
  return [...text.matchAll(DATE_PARTS)].map((m) => m[0]).filter((part) => !cited.includes(squash(part)));
}

const nonEmpty = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/**
 * Checks a deadline against its obligation's citation. `raw` is
 * { kind, date, rule, relativeTo }, from the model or from storage.
 */
export function checkDeadline(raw: unknown, citationText: string): DeadlineCheck {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "malformed" };
  const { kind, date, rule, relativeTo } = raw as Record<string, unknown>;

  if (kind === "date") {
    const stated = nonEmpty(date);
    if (stated === null || !/\d/.test(stated)) return { ok: false, reason: "malformed" };
    // The document's own words: found in the sentence, after the one normalisation.
    const fragment = normalizeFragment(stated);
    if (!normalizeFragment(citationText).includes(fragment)) return { ok: false, reason: "date_not_in_citation" };
    return { ok: true, deadline: { kind: "date", date: fragment } };
  }

  if (kind === "rule") {
    const how = nonEmpty(rule);
    const from = nonEmpty(relativeTo);
    if (how === null || from === null) return { ok: false, reason: "malformed" };
    if (datesNotInCitation(`${how}\n${from}`, citationText).length > 0) return { ok: false, reason: "date_not_in_citation" };
    return { ok: true, deadline: { kind: "rule", rule: how, relativeTo: from } };
  }

  return { ok: false, reason: "malformed" };
}

export const byDocumentOrder = (a: { citation: Citation }, b: { citation: Citation }) =>
  a.citation.start - b.citation.start || a.citation.end - b.citation.end;

/** The generated text in a summary point, for the wording check. */
export function summaryPieces(point: Pick<SummaryPoint, "text">, where: string): WordingPiece[] {
  return [{ field: `${where} point`, text: point.text }];
}

/** The generated text in a notice obligation, for the wording check. A stated date is the document's words and is left out. */
export function obligationPieces(obligation: Pick<NoticeObligation, "description" | "deadline">, where: string): WordingPiece[] {
  const { deadline } = obligation;
  return [
    { field: `${where} description`, text: obligation.description },
    ...(deadline.kind === "rule"
      ? [
          { field: `${where} deadline rule`, text: deadline.rule },
          { field: `${where} deadline counts from`, text: deadline.relativeTo },
        ]
      : []),
  ];
}
