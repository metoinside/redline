// Exposure, checked in code (ADR 0003). The model points at the words in a
// cited sentence that state the money committed, the lock-in length and how
// hard it is to get out. A part is kept only when its fragment, after the one
// canonical normalisation, is an exact substring of the flag's citation, so
// every part a buyer sees is the document's own words. Money and lock-in parts
// must contain a figure. Money amounts are read here from the fragment itself;
// the model never reports a number the engine uses.
//
// Safe to import in the browser: stored analyses are checked again there.

import { normalizeFragment } from "@/lib/extraction/normalize";
import { EXPOSURE_PARTS, type Exposure, type ExposureDropReason, type ExposurePart } from "./types";

const NUMBER_WORDS =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion";
// Spanish, for contracts written in it. "un", "uno" and "una" are left out
// because they are also the article ("una parte"), and "once" because it is
// an English word.
const SPANISH_NUMBER_WORDS =
  "dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|trece|catorce|quince|dieci\\p{L}+|veinte|veinti\\p{L}+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|cientos|mil|millón|millones";
const FIGURE = new RegExp(`\\p{N}|(?<![\\p{L}])(?:${NUMBER_WORDS}|${SPANISH_NUMBER_WORDS})(?![\\p{L}])`, "iu");

/** True when `fragment` states a figure, in digits or in words ("90", "ninety", "thirty-six", "noventa"). */
export function hasFigure(fragment: string): boolean {
  return FIGURE.test(fragment);
}

const MULTIPLIER: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, bn: 1e9, billion: 1e9 };
const NUMBER = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?`;
const SCALE = String.raw`(?:\s?(thousand|million|billion|k|m|bn)(?![\p{L}]))?`;
/** "$48,000", "US$ 1,200.50", "USD 1.5 million", "$5k". */
const CURRENCY_FIRST = new RegExp(String.raw`(?:US\$|\$|(?<![\p{L}])USD)\s?${NUMBER}${SCALE}`, "giu");
/** "48,000 dollars", "1.5 million US dollars", "2,000 USD". */
const CURRENCY_AFTER = new RegExp(String.raw`(?<![\d,.$])${NUMBER}${SCALE}\s?(?:US\s)?(?:dollars|USD)(?![\p{L}])`, "giu");

/**
 * The largest sum of money written in `fragment`, read from its own figures,
 * or null when it states none. A share ("100% of the remaining fees") is not a
 * sum. Only dollar amounts are read, so sums are never compared across
 * currencies.
 */
export function parseMoneyAmount(fragment: string): number | null {
  let largest: number | null = null;
  for (const pattern of [CURRENCY_FIRST, CURRENCY_AFTER]) {
    for (const match of fragment.matchAll(pattern)) {
      const value = Number(`${match[1].replace(/,/g, "")}${match[2] ?? ""}`) * (match[3] ? MULTIPLIER[match[3].toLowerCase()] : 1);
      if (Number.isFinite(value) && value > 0 && (largest === null || value > largest)) largest = value;
    }
  }
  return largest;
}

export type ExposureCheck = {
  exposure: Exposure;
  dropped: { part: ExposurePart; fragment: string | null; reason: ExposureDropReason }[];
};

/**
 * Keeps each exposure part whose fragment is in `citationText` word for word
 * (after normalisation) and, for money and lock-in, states a figure. A part
 * given as null, undefined or an empty string is simply absent.
 */
export function checkExposure(parts: Partial<Record<ExposurePart, unknown>>, citationText: string): ExposureCheck {
  const exposure: Exposure = {};
  const dropped: ExposureCheck["dropped"] = [];
  for (const part of EXPOSURE_PARTS) {
    const raw = parts[part];
    if (raw === null || raw === undefined) continue;
    if (typeof raw !== "string") {
      dropped.push({ part, fragment: null, reason: "malformed" });
      continue;
    }
    const fragment = normalizeFragment(raw);
    if (fragment === "") continue;
    if (!citationText.includes(fragment)) {
      dropped.push({ part, fragment: raw, reason: "not_in_citation" });
      continue;
    }
    if ((part === "money" || part === "lockIn") && !hasFigure(fragment)) {
      dropped.push({ part, fragment: raw, reason: "no_figure" });
      continue;
    }
    exposure[part] = fragment;
  }
  return { exposure, dropped };
}
