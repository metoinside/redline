// Red lines, checked in code (#10; ADR 0003). A red line is a limit on one
// clause type in the renewal-and-exit family. Whether a flag breaches one is
// worked out here, from the flag's checked exposure, never by the model:
//  - "not allowed" is breached by every verified flag of its clause type;
//  - a figure-limit is breached only when a figure read from the flag's
//    exposure fragments (each already found word for word in its citation)
//    is certainly over the limit. With no figure in the cited words, no
//    breach is claimed: a breach must rest on the document's own words.
//
// Which fragments hold the figure: a notice window's notice period is in its
// exitDifficulty part; a renewal, rollover or lock-in term is in its lockIn
// part; a fee is in its money part, or its exitDifficulty part. Money is read
// with the same parser that orders flags (lib/engine/exposure.ts).
//
// Durations are read in digits, in words, or both ("ninety (90) days",
// "thirty-six (36) months", "36-month"). Days and weeks compare exactly, as do
// months and years. Across the two, only a certain breach is claimed: a month
// counts as 28 days against a day limit, and as 31 days against a month limit.
// Where a fragment gives a figure both in words and in digits that disagree,
// the smaller is used.
//
// Safe to import in the browser: stored analyses are checked again there.

import { parseMoneyAmount } from "./exposure";
import {
  LIMIT_KINDS,
  LIMIT_VALUE_RANGE,
  isClauseType,
  type ClauseType,
  type Exposure,
  type Flag,
  type RedLine,
  type RedLineBreach,
  type RedLineLimit,
} from "./types";

// ---------- Shape ----------

/** A red line from untrusted JSON (a stored snapshot, or the server's own rows), or null when it isn't a valid one. */
export function parseRedLine(value: unknown): RedLine | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!isClauseType(raw.clauseType)) return null;
  if (raw.id !== undefined && typeof raw.id !== "string") return null;
  const limit = parseLimit(raw.clauseType, raw.limit);
  if (!limit) return null;
  return raw.id === undefined ? { clauseType: raw.clauseType, limit } : { id: raw.id, clauseType: raw.clauseType, limit };
}

/** A list of red lines, or null when it isn't a list or any entry is invalid. Nothing is quietly left out. */
export function parseRedLines(value: unknown): RedLine[] | null {
  if (!Array.isArray(value)) return null;
  const lines = value.map(parseRedLine);
  return lines.every((l): l is RedLine => l !== null) ? lines : null;
}

/** A limit of a kind its clause type takes, with a whole value in range, or null. */
export function parseLimit(clauseType: ClauseType, value: unknown): RedLineLimit | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { kind, value: amount } = value as Record<string, unknown>;
  if (typeof kind !== "string" || !(LIMIT_KINDS[clauseType] as readonly string[]).includes(kind)) return null;
  if (kind === "not_allowed") return { kind };
  const range = LIMIT_VALUE_RANGE[kind as keyof typeof LIMIT_VALUE_RANGE];
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < range.min || amount > range.max) return null;
  return { kind, value: amount } as RedLineLimit;
}

// ---------- Plain words ----------

const plural = (n: number, unit: string) => `${n.toLocaleString("en-US")} ${unit}${n === 1 ? "" : "s"}`;

const NOT_ALLOWED: Record<ClauseType, string> = {
  auto_renewal: "No auto-renewal",
  notice_window: "No notice window",
  early_termination_fee: "No early termination fee",
  rollover: "No rollover",
  multi_year_term: "No multi-year term",
};

const MONTHS_SUBJECT: Record<ClauseType, string> = {
  auto_renewal: "No auto-renewal term",
  notice_window: "No notice window",
  early_termination_fee: "No early termination fee",
  rollover: "No rollover term",
  multi_year_term: "No lock-in",
};

/** A red line in plain words, such as "No notice window longer than 60 days". Shown to the buyer and given to the model. */
export function describeRedLine({ clauseType, limit }: RedLine): string {
  switch (limit.kind) {
    case "not_allowed":
      return NOT_ALLOWED[clauseType];
    case "max_days":
      return `No notice window longer than ${plural(limit.value, "day")}`;
    case "max_months":
      return `${MONTHS_SUBJECT[clauseType]} longer than ${plural(limit.value, "month")}`;
    case "max_dollars":
      return `No early termination fee over $${limit.value.toLocaleString("en-US")}`;
  }
}

// ---------- Reading durations ----------

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
// Longest first, so "seventeen" is never read as "seven".
const WORD = `(?:${[...Object.keys(SMALL), "hundred", "thousand"].sort((a, b) => b.length - a.length).join("|")})`;
const WORDS = `${WORD}(?:(?:\\s+|-)(?:and\\s+)?${WORD})*`;
const DIGITS = String.raw`\d{1,3}(?:,\d{3})+|\d+`;
const DURATION = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:(${WORDS})\s*(?:\((${DIGITS})\)\s*)?|(${DIGITS})\s*)(?:-\s*)?(?:(?:calendar|business|working|consecutive)\s+)?(day|week|month|year)s?(?![\p{L}])`,
  "giu",
);

type Unit = "day" | "week" | "month" | "year";
type Duration = { amount: number; unit: Unit; text: string };

/** "one hundred twenty" → 120, "thirty-six" → 36. */
function wordsToNumber(words: string): number | null {
  let total = 0;
  let current = 0;
  for (const token of words.toLowerCase().split(/[\s-]+/)) {
    if (token === "and" || token === "") continue;
    if (token === "hundred") current = (current || 1) * 100;
    else if (token === "thousand") {
      total += (current || 1) * 1000;
      current = 0;
    } else if (token in SMALL) current += SMALL[token];
    else return null;
  }
  return total + current;
}

/** Every duration stated in `fragment`, with the exact words that state it. */
function readDurations(fragment: string): Duration[] {
  const found: Duration[] = [];
  for (const match of fragment.matchAll(DURATION)) {
    const [text, words, bracketed, bare, unit] = match;
    const figures = [
      words ? wordsToNumber(words) : null,
      bracketed ? Number(bracketed.replace(/,/g, "")) : null,
      bare ? Number(bare.replace(/,/g, "")) : null,
    ].filter((n): n is number => n !== null && Number.isFinite(n) && n > 0);
    if (figures.length === 0) continue;
    found.push({ amount: Math.min(...figures), unit: unit.toLowerCase() as Unit, text: text.trim() });
  }
  return found;
}

/** True only when `d` is certainly longer than `limit` days. */
function overDays(d: Duration, limit: number): boolean {
  const shortest = { day: 1, week: 7, month: 28, year: 365 }[d.unit];
  return d.amount * shortest > limit;
}

/** True only when `d` is certainly longer than `limit` months. */
function overMonths(d: Duration, limit: number): boolean {
  if (d.unit === "month") return d.amount > limit;
  if (d.unit === "year") return d.amount * 12 > limit;
  const days = d.unit === "week" ? d.amount * 7 : d.amount;
  return days > limit * 31;
}

// ---------- Breaches ----------

/** The exposure parts that state the figure a red line on this clause type limits. */
const FIGURE_PARTS: Record<ClauseType, readonly (keyof Exposure)[]> = {
  auto_renewal: ["lockIn"],
  notice_window: ["exitDifficulty"],
  early_termination_fee: ["money", "exitDifficulty"],
  rollover: ["lockIn"],
  multi_year_term: ["lockIn"],
};

/** The words in the flag's cited exposure that breach `redLine`, null for a "not allowed" breach, or undefined for no breach. */
function breachingWords(flag: Pick<Flag, "clauseType" | "exposure">, redLine: RedLine): string | null | undefined {
  const { limit } = redLine;
  if (limit.kind === "not_allowed") return null;
  for (const part of FIGURE_PARTS[flag.clauseType]) {
    const fragment = flag.exposure[part];
    if (!fragment) continue;
    if (limit.kind === "max_dollars") {
      const amount = parseMoneyAmount(fragment);
      if (amount !== null && amount > limit.value) return fragment;
      continue;
    }
    const over = limit.kind === "max_days" ? overDays : overMonths;
    const breaching = readDurations(fragment).find((d) => over(d, limit.value));
    if (breaching) return breaching.text;
  }
  return undefined;
}

/**
 * The buyer's red lines that a verified flag breaches, in the order given.
 * `flag.exposure` must already have passed the exposure check, so every
 * figure read here is in the flag's citation.
 */
export function findBreaches(flag: Pick<Flag, "clauseType" | "exposure">, redLines: readonly RedLine[]): RedLineBreach[] {
  const breaches: RedLineBreach[] = [];
  for (const redLine of redLines) {
    if (redLine.clauseType !== flag.clauseType) continue;
    const cited = breachingWords(flag, redLine);
    if (cited !== undefined) breaches.push({ redLine, cited });
  }
  return breaches;
}
