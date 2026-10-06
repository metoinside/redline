import type {
  ModelAnalysisItem,
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
  };
}

/** An item for any sentence, with a plain statement, one reading and no exposure unless given. */
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
