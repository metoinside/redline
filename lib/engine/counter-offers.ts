// Counter-offers (PRD §3 item 3, §4 check 12; ADR 0001, 0005), the rules
// applied in code both when the model answers (analyse.ts) and when a saved
// analysis is read back (stored.ts):
//  - a counter-offer belongs to one flag and is an edit to that flag's cited
//    sentence. The sentence it replaces is the flag's verified citation, set
//    here, never taken from the model or from storage, so a counter-offer
//    always answers the sentence the buyer sees, and a flag dropped by the
//    citation check takes its counter-offer with it;
//  - every kept flag needs one, with a replacement that changes the sentence
//    and a message to the vendor. A flag without one is a defect in the
//    model's answer, never a flag shown without its counter-offer;
//  - the replacement and the message go through the wording check
//    (counterOfferPieces). The cited sentence is the document's own words and
//    is never checked.
// Outside-terms notices never have a counter-offer: nothing here reads one.
//
// Safe to import in the browser: stored analyses are checked again there.
// (So the error for a failed run, CounterOfferDefectsError, lives in analyse.ts.)

import { normalizeFragment } from "@/lib/extraction/normalize";
import type { Citation, CounterOffer, CounterOfferDefect } from "./types";
import type { WordingPiece } from "./wording";

export type CounterOfferCheck = { ok: true; counterOffer: CounterOffer } | { ok: false; problem: CounterOfferDefect["problem"] };

const squash = (text: string) => normalizeFragment(text).replace(/\s+/g, " ").toLowerCase();

/**
 * Reads a counter-offer ({ replacement, message }, from the model or from
 * storage) for the flag whose verified citation is `citation`.
 */
export function readCounterOffer(raw: unknown, citation: Citation): CounterOfferCheck {
  if (typeof raw !== "object" || raw === null) return { ok: false, problem: "missing" };
  const { replacement, message } = raw as Record<string, unknown>;
  if (typeof replacement !== "string" || typeof message !== "string") return { ok: false, problem: "missing" };
  const proposed = replacement.trim();
  const note = message.trim();
  if (proposed === "" || note === "") return { ok: false, problem: "missing" };
  if (squash(proposed) === squash(citation.text)) return { ok: false, problem: "unchanged" };
  return { ok: true, counterOffer: { replaces: { ...citation }, replacement: proposed, message: note } };
}

/** The generated text in a counter-offer, for the wording check. The sentence it replaces is the document's words and is left out. */
export function counterOfferPieces(offer: Pick<CounterOffer, "replacement" | "message">, where: string): WordingPiece[] {
  return [
    { field: `${where} counter-offer replacement`, text: offer.replacement },
    { field: `${where} counter-offer message`, text: offer.message },
  ];
}
