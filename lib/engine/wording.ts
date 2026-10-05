// The wording check (ADR 0003, 0005; PRD §4, hard requirements 3 and 4).
// Every piece of text Redline generates (flag statements and readings now;
// the summary, counter-offers and answers in later tickets) goes through
// findWordingDefects before a buyer can see it. Hedging tells the buyer
// nothing, and a comparison with the market is a claim the document can't
// support, so either one is a defect.
//
// It never runs over a citation or an exposure fragment: those are the
// document's own words, and a contract that says "Customer may not terminate"
// has to be quoted as it is.
//
// Safe to import in the browser: stored analyses are checked again there.

import type { WordingAttempt, WordingDefect } from "./types";

/** Words that hedge. "could potentially" is listed so it is reported as one defect, not as "could". */
export const HEDGING_TERMS = ["may", "might", "could", "could potentially", "possibly", "perhaps"] as const;

/** Words that compare a clause with the market or the industry. */
export const MARKET_TERMS = [
  "unusual",
  "non-standard",
  "standard",
  "typical",
  "atypical",
  "below market",
  "above market",
  "market rate",
  "industry norm",
] as const;

export const BANNED_TERMS: readonly string[] = [...HEDGING_TERMS, ...MARKET_TERMS];

/** One piece of generated text, and where it sits in the output (for the retry message and diagnostics). */
export type WordingPiece = { field: string; text: string };

const squash = (term: string) => term.toLowerCase().replace(/[\s\-‐-–]+/g, "");

// Longest first, so "could potentially" wins over "could" and "non-standard"
// over "standard" at the same position. Inside a phrase, a space or a hyphen
// may separate the words ("below-market"), and "non-standard" may be written
// as one word.
const PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[...BANNED_TERMS]
    .sort((a, b) => b.length - a.length)
    .map((term) =>
      term
        .split(/[\s-]+/)
        .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(term === "non-standard" ? "[\\s\\-\\u2010-\\u2013]?" : "[\\s\\-\\u2010-\\u2013]+"),
    )
    .join("|")})(?![\\p{L}\\p{N}])`,
  "giu",
);

const TERM_BY_SQUASHED = new Map(BANNED_TERMS.map((term) => [squash(term), term]));

/** "May" written next to a day or a year ("1 May", "May 15", "May 2027") is the month, not a hedge. */
function isMonthMay(text: string, start: number, matched: string): boolean {
  if (matched !== "May") return false;
  const before = text.slice(Math.max(0, start - 8), start);
  const after = text.slice(start + matched.length, start + matched.length + 6);
  return /\d{1,2}(?:st|nd|rd|th)?\s+$/.test(before) || /^\s+\d/.test(after);
}

/** Every banned word or phrase in `pieces`, whole words only and ignoring case, in the order found. */
export function findWordingDefects(pieces: readonly WordingPiece[]): WordingDefect[] {
  const defects: WordingDefect[] = [];
  for (const { field, text } of pieces) {
    for (const match of text.matchAll(PATTERN)) {
      if (isMonthMay(text, match.index, match[0])) continue;
      defects.push({ field, term: TERM_BY_SQUASHED.get(squash(match[0])) ?? match[0].toLowerCase() });
    }
  }
  return defects;
}

/**
 * The model's wording still had defects after one retry, so the analysis
 * failed: nothing is shown and nothing is saved. A confident, checked result
 * or none.
 */
export class WordingDefectsError extends Error {
  readonly attempts: WordingAttempt[];
  constructor(attempts: WordingAttempt[]) {
    const last = attempts.at(-1)?.defects ?? [];
    super(
      `The analysis was worded with hedging or market comparisons after a retry (${[...new Set(last.map((d) => `"${d.term}"`))].join(", ")}).`,
    );
    this.name = "WordingDefectsError";
    this.attempts = attempts;
  }
}
