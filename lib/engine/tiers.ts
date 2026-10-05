// The tiering rules (ADR 0003, 0005; PRD §4 hard requirement 2, §5), applied
// in code after the model returns. The model never chooses a tier.
//
// A flag goes in Negotiate before signing only when at least one of these holds:
//  - its checked exposure cites a sum of money (or a formula for one);
//  - its checked exposure cites a lock-in period;
//  - its checked exposure cites how hard it is to get out with a figure in it,
//    such as a notice period ("ninety (90) days") or a fee amount;
//  - it has exactly two readings (the clause reads two ways);
//  - it breaches one of the buyer's red lines.
// Every other family clause goes in Know before signing, and is shown.
//
// Within each tier, flags are ordered by the money amount read from their
// exposure, highest first; flags with no sum come after, in document order.
//
// Safe to import in the browser: stored analyses are ranked again there.

import { hasFigure } from "./exposure";
import { TIERS, type Exposure, type Flag, type Readings, type RedLineBreach, type Tier } from "./types";

export type TierInput = { exposure: Exposure; readings: Readings | readonly string[] };

/** The tier for a clause, from its checked exposure, its readings and the red-line breaches the caller has found. */
export function assignTier(flag: TierInput, breaches: readonly RedLineBreach[]): Tier {
  const { money, lockIn, exitDifficulty } = flag.exposure;
  const citedExposure = Boolean(money) || Boolean(lockIn) || (exitDifficulty !== undefined && hasFigure(exitDifficulty));
  const readsTwoWays = flag.readings.length === 2;
  return citedExposure || readsTwoWays || breaches.length > 0 ? "negotiate" : "know";
}

type Rankable = Pick<Flag, "tier" | "moneyAmount" | "citation">;

/**
 * Flags in the order a buyer reads them: by tier, then money highest first,
 * then flags with no sum in document order. Stable, so flags on the same
 * sentence keep the order they came in.
 */
export function rankFlags<T extends Rankable>(flags: readonly T[]): T[] {
  return [...flags].sort((a, b) => {
    const tier = TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier);
    if (tier !== 0) return tier;
    if (a.moneyAmount !== null && b.moneyAmount !== null && a.moneyAmount !== b.moneyAmount) return b.moneyAmount - a.moneyAmount;
    if ((a.moneyAmount === null) !== (b.moneyAmount === null)) return a.moneyAmount === null ? 1 : -1;
    return a.citation.start - b.citation.start || a.citation.end - b.citation.end;
  });
}
