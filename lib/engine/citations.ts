// The citation verifier (ADR 0001). A quote counts as a citation only when,
// after the one canonical normalisation, it appears as an exact substring of
// the stored document text. There is no fuzzy matching: one changed word, one
// dropped letter or a change of case and the quote is not found.
//
// Safe to import in the browser: it reads nothing and calls nothing.

import { normalizeFragment } from "@/lib/extraction/normalize";
import { countTextChars } from "@/lib/extraction/limits";
import type { Citation } from "./types";

/**
 * A quote needs at least this many letters and digits. Anything shorter is a
 * phrase, not a sentence the buyer can check: "automatically renew" has 18,
 * a stray "renew" has 5.
 */
export const MIN_CITATION_CHARS = 20;

export type QuoteCheck =
  | { ok: true; citation: Citation }
  | { ok: false; reason: "quote_too_short" | "citation_not_found" };

/**
 * Checks `quote` against the stored text. On success, the citation is the
 * stored text's own copy of the quote with the offsets of its first
 * occurrence.
 */
export function checkQuote(storedText: string, quote: string): QuoteCheck {
  const needle = normalizeFragment(quote);
  if (countTextChars(needle) < MIN_CITATION_CHARS) return { ok: false, reason: "quote_too_short" };
  const start = storedText.indexOf(needle);
  if (start === -1) return { ok: false, reason: "citation_not_found" };
  const end = start + needle.length;
  return { ok: true, citation: { text: storedText.slice(start, end), start, end } };
}

/** The citation for `quote`, or null when it is too short or not in the text word for word. */
export function findCitation(storedText: string, quote: string): Citation | null {
  const check = checkQuote(storedText, quote);
  return check.ok ? check.citation : null;
}

/** True when a citation's text is exactly what the stored text holds at its offsets. */
export function citationMatches(storedText: string, citation: Citation): boolean {
  const { text, start, end } = citation;
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    end > start &&
    end <= storedText.length &&
    storedText.slice(start, end) === text
  );
}
