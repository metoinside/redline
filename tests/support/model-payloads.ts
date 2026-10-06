import type {
  ModelAnalysisItem,
  ModelCounterOffer,
  ModelAnalysisPayload,
  ModelNoticeObligationItem,
  ModelOutsideTermsItem,
  ModelSummaryItem,
} from "@/lib/engine/analyse";
import { ScriptedModelClient, type ScriptStep } from "@/lib/engine/scripted";
import type { ClauseType } from "@/lib/engine/types";
import type { FixtureClause, FixtureNoticeObligation, FixtureOutsideTerms, FixtureSidecar, FixtureSummaryPoint } from "../fixtures/index";

// Builds what the model would return for a fixture, from its sidecar labels,
// so the scripted client can stand in for the model. A test starts from the
// sidecar's "right answer" and bends it: drop a clause, retype one, alter a
// quote, add one the document doesn't contain. Each clause carries the
// sidecar's statement, exposure fragments and readings (one, or the two the
// sidecar lists for a clause that reads two ways). The outside-terms list
// carries each sidecar outside-terms sentence with the document it names.
// The summary carries each sidecar summary point with its sentence, and the
// notice-obligation list each sidecar notice obligation with its description
// and deadline (a rule with what it counts from, or a stated date).
// Each clause also carries a counter-offer (SIDECAR_COUNTER_OFFERS): the
// wording the buyer proposes in place of its sentence, and a message to the
// vendor. The fixture sidecars have no counter-offer labels of their own, so
// they are written here, one per sidecar clause, in the engine's wording rules.

export type PayloadOptions = {
  /** Keep only clauses of these types. Default: every clause in the sidecar. */
  clauseTypes?: readonly ClauseType[];
  /** Sidecar clause ids to leave out. */
  omit?: readonly string[];
  /** Rewrites a clause's item before it goes in; return null to leave it out. */
  map?: (item: ModelAnalysisItem, clause: FixtureClause) => ModelAnalysisItem | null;
  /** Items added after the sidecar's own, in this order. Anything goes, malformed items included. */
  extra?: readonly unknown[];
  /**
   * The outside-terms list, in place of the sidecar's. Default: every
   * outside-terms sentence in the sidecar. Anything goes, malformed items included.
   */
  outsideTerms?: readonly unknown[];
  /** The summary, in place of the sidecar's. Anything goes, malformed items included. */
  summary?: readonly unknown[];
  /** The notice-obligation list, in place of the sidecar's. Anything goes, malformed items included. */
  noticeObligations?: readonly unknown[];
};

/** The model's answer for a fixture, built from its labels. */
export function analysisPayload(sidecar: FixtureSidecar, options: PayloadOptions = {}): ModelAnalysisPayload {
  const items: unknown[] = [];
  for (const clause of sidecar.clauses) {
    if (options.clauseTypes && !options.clauseTypes.includes(clause.clauseType)) continue;
    if (options.omit?.includes(clause.id)) continue;
    const item = modelItem(clause);
    const mapped = options.map ? options.map(item, clause) : item;
    if (mapped) items.push(mapped);
  }
  items.push(...(options.extra ?? []));
  const outside = options.outsideTerms ?? sidecar.outsideTerms.map(outsideTermsItem);
  const summary = options.summary ?? sidecar.summary.map(summaryItem);
  const obligations = options.noticeObligations ?? sidecar.noticeObligations.map(noticeObligationItem);
  return {
    summary: [...summary] as ModelSummaryItem[],
    notice_obligations: [...obligations] as ModelNoticeObligationItem[],
    clauses: items as ModelAnalysisItem[],
    outside_terms: [...outside] as ModelOutsideTermsItem[],
  };
}

/** One summary point as the model would report it, from its sidecar label. */
export function summaryItem(entry: FixtureSummaryPoint): ModelSummaryItem {
  return { point: entry.point, sentence: entry.sentence };
}

/** One notice obligation as the model would report it, from its sidecar labels. */
export function noticeObligationItem(entry: FixtureNoticeObligation): ModelNoticeObligationItem {
  const deadline: ModelNoticeObligationItem["deadline"] =
    entry.relativeTo === undefined
      ? { kind: "date", date: entry.deadline, rule: null, relative_to: null }
      : { kind: "rule", date: null, rule: entry.deadline, relative_to: entry.relativeTo };
  return { sentence: entry.sentence, description: entry.description, deadline };
}

/** One outside-terms sentence as the model would report it, from its sidecar labels. */
export function outsideTermsItem(entry: FixtureOutsideTerms): ModelOutsideTermsItem {
  return { sentence: entry.sentence, document: entry.document };
}

/** A whole model answer from a list of clause items, with no outside terms, summary or notice obligations unless given. */
export function answerOf(
  clauses: readonly unknown[],
  outsideTerms: readonly unknown[] = [],
  summary: readonly unknown[] = [],
  noticeObligations: readonly unknown[] = [],
): ModelAnalysisPayload {
  return {
    summary: [...summary] as ModelSummaryItem[],
    notice_obligations: [...noticeObligations] as ModelNoticeObligationItem[],
    clauses: [...clauses] as ModelAnalysisItem[],
    outside_terms: [...outsideTerms] as ModelOutsideTermsItem[],
  };
}

/**
 * The counter-offer the model would give for each sidecar clause, by clause
 * id. Only adhesion-contract.json has clauses. Each replacement differs from
 * its sentence, and none of them hedges or compares with the market.
 */
export const SIDECAR_COUNTER_OFFERS: Readonly<Record<string, ModelCounterOffer>> = {
  c1: {
    replacement:
      "The Initial Subscription Term begins on the Effective Date and continues for twelve (12) months, and Customer can terminate this Agreement for convenience at any time on thirty (30) days' written notice to Provider.",
    message:
      "Before we sign, we'd like to change the length of the first term. As written, it holds us for 36 months with no way to end it early. We're asking for a 12-month first term and the right to end the agreement on 30 days' written notice.",
  },
  c2: {
    replacement:
      "Upon expiration of the Initial Subscription Term or any renewal term, this Agreement shall renew only if both parties agree in writing, at a Subscription Fee no higher than the fee for the term that is ending.",
    message:
      "We'd like to change how the agreement renews. Right now it renews on its own at no less than $48,000 a year. We're asking that it renew only when we both agree in writing, at a fee no higher than what we pay now.",
  },
  c3: {
    replacement: "Each renewal term shall be twelve (12) months.",
    message: "We're asking for renewal terms of 12 months. As written, each renewal runs another 36 months, the same as the first term.",
  },
  c4: {
    replacement:
      "To prevent renewal, Customer must give written notice of non-renewal to Provider by email or by mail, and that notice must be sent no later than thirty (30) days before the end of the then-current term.",
    message:
      "We'd like to make notice of non-renewal simpler. The current wording asks for certified mail to your legal department, received 90 days before the term ends. We're asking to give written notice by email or mail, sent at least 30 days before the term ends.",
  },
  c5: {
    replacement:
      "If Customer terminates this Agreement for convenience during any renewal term, Customer shall pay only the Subscription Fees for the period up to the effective date of termination.",
    message:
      "We'd like to change the early termination fee. As written, ending the agreement during a renewal term costs us every fee left in that term. We're asking to pay only for the service up to the date the termination takes effect.",
  },
  c6: {
    replacement:
      "If Customer purchases additional Authorized User seats during any term, the subscription for those seats shall end on the last day of the then-current term, and adding seats shall not extend or restart the term of the existing Services.",
    message:
      "We'd like to settle what happens when we add seats. The current sentence reads two ways, and one reading restarts the whole subscription for a full new term. We're asking that added seats end with the current term and never extend or restart it.",
  },
  c7: {
    replacement:
      "The Priority Support add-on renews together with the Services only if Customer confirms the renewal in writing, and Customer can cancel the Priority Support add-on at any time without charge from the billing page of its account.",
    message:
      "We'd like the Priority Support add-on to renew only when we confirm it in writing. We're glad to keep the right to cancel it at any time from the billing page.",
  },
};

/** The sidecar clause's counter-offer. Fails loudly for a clause nobody wrote one for. */
export function counterOfferFor(clause: FixtureClause): ModelCounterOffer {
  const offer = SIDECAR_COUNTER_OFFERS[clause.id];
  if (!offer) throw new Error(`no counter-offer written for sidecar clause ${clause.id}`);
  return { ...offer };
}

/** A counter-offer for any sentence: a plain replacement and message that pass the wording check. */
export const PLAIN_COUNTER_OFFER: ModelCounterOffer = {
  replacement: "Either party can end this Agreement at the end of the current term by giving thirty (30) days' written notice.",
  message: "We'd like to be able to end the agreement at the end of any term on 30 days' written notice.",
};

/** One clause as the model would report it, from its sidecar labels. */
export function modelItem(clause: FixtureClause): ModelAnalysisItem {
  return {
    clause_type: clause.clauseType,
    sentence: clause.sentence,
    statement: clause.statement,
    exposure: {
      money: clause.exposure.money ?? null,
      lock_in: clause.exposure.lockIn ?? null,
      exit_difficulty: clause.exposure.exitDifficulty ?? null,
    },
    readings: clause.readings ? [...clause.readings] : [clause.statement],
    counter_offer: counterOfferFor(clause),
  };
}

/** An item for any sentence, with a plain statement, one reading, a plain counter-offer and no exposure unless given. */
export function itemFor(
  clauseType: string,
  sentence: string,
  overrides: Partial<ModelAnalysisItem> = {},
): ModelAnalysisItem {
  const statement = overrides.statement ?? "This sentence sets a renewal or exit term.";
  return {
    clause_type: clauseType,
    sentence,
    statement,
    exposure: { money: null, lock_in: null, exit_difficulty: null },
    readings: [statement],
    counter_offer: { ...PLAIN_COUNTER_OFFER },
    ...overrides,
  };
}

/** A scripted client that answers each call with the next step, in order. */
export function scriptedClient(...steps: ScriptStep[]): ScriptedModelClient {
  return new ScriptedModelClient(steps);
}

export function clauseById(sidecar: FixtureSidecar, id: string): FixtureClause {
  const clause = sidecar.clauses.find((c) => c.id === id);
  if (!clause) throw new Error(`no clause ${id} in the sidecar`);
  return clause;
}

// ---------- Ways to bend a quote ----------

/** Replaces the first whole-word `from` with `to`, and fails loudly if it isn't there. */
export function changeWord(sentence: string, from: string, to: string): string {
  const pattern = new RegExp(`(?<![\\w$])${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\w)`);
  if (!pattern.test(sentence)) throw new Error(`"${from}" is not a word in: ${sentence}`);
  const changed = sentence.replace(pattern, to);
  if (changed === sentence) throw new Error("the change left the sentence as it was");
  return changed;
}

/** Typographic quotes and apostrophes, as a model or a word processor writes them. */
export function curlyQuotes(sentence: string): string {
  return sentence.replace(/"([^"]*)"/g, "“$1”").replace(/'/g, "’");
}

/** Doubled spaces, a tab, a no-break space and padding at both ends. */
export function messySpacing(sentence: string): string {
  const words = sentence.split(" ");
  const joined = words
    .map((word, i) => (i === 0 ? word : (i % 3 === 0 ? "\t" : i % 3 === 1 ? "  " : " ") + word))
    .join("");
  return `  ${joined} \n`;
}

/**
 * A sentence that reads like a renewal clause but is in neither fixture: the
 * model inventing a citation.
 */
export const FABRICATED_SENTENCES: Record<ClauseType, string> = {
  auto_renewal:
    "This Agreement shall renew automatically for successive twelve (12) month terms unless either party opts out in writing.",
  notice_window: "Customer must give notice of non-renewal at least one hundred twenty (120) days before the renewal date.",
  early_termination_fee: "Customer shall pay a termination fee of $25,000 if it ends this Agreement early for any reason.",
  rollover: "Any unused subscription credits roll over into the next term and extend it by the same number of months.",
  multi_year_term: "The initial term of this Agreement is five (5) years from the Effective Date.",
};
