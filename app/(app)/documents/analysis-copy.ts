import type { ClauseType } from "@/lib/engine/types";
import type { RunAnalysisFailure } from "./actions";

// What the buyer reads in the analysis view. Every line here went through the
// humanizer skill. Nothing in it says more than the flag does: the clause type
// and the sentence it cites.

export const CLAUSE_LABEL: Record<ClauseType, string> = {
  auto_renewal: "Auto-renewal",
  notice_window: "Notice window",
  early_termination_fee: "Early termination fee",
  rollover: "Rollover",
  multi_year_term: "Multi-year term",
};

/** The margin comment's sentence for a flag of each type, until #5 adds exposure. */
export const CLAUSE_COMMENT: Record<ClauseType, string> = {
  auto_renewal: "This sentence renews the contract, or part of it, unless someone acts to stop it.",
  notice_window: "This sentence sets how and when notice has to be given.",
  early_termination_fee: "This sentence charges a fee for ending the contract early.",
  rollover: "This sentence sets how long a renewal runs, or restarts a term.",
  multi_year_term: "This sentence commits you for more than a year.",
};

export const ANALYSIS_COPY = {
  heading: "Analysis",
  vendorOnly:
    "Redline is tuned and checked for vendor, SaaS and service contracts only. If this is another kind of document, such as a lease or a freelance agreement, nobody has checked the analysis for it.",
  scope: "For now Redline looks only for auto-renewal clauses. Each flag shows the exact sentence it comes from, checked word for word against the text below.",
  notRun: "This document hasn’t been analysed yet.",
  run: "Analyse this contract",
  rerun: "Analyse again",
  running: "Analysing the contract. This can take a minute.",
  ranOn: "Analysed",
  notSaved: "This analysis isn’t saved. It’s gone when you leave this page.",
  empty: "We found no auto-renewal clause in this document.",
  found: (n: number) => `${n === 1 ? "One auto-renewal clause" : `${n} auto-renewal clauses`} found. Select a flag to go to its sentence.`,
  flagsLabel: "Flags",
  clause: (number: string) => `Clause ${number}`,
  modelOff: {
    title: "Analysis isn’t set up on this server.",
    body: "This copy of Redline has no model connected, so it can’t analyse documents.",
  },
} as const;

export const FAILURE_COPY: Record<RunAnalysisFailure | "unreachable", { title: string; body: string }> = {
  "model-off": ANALYSIS_COPY.modelOff,
  "model-failed": { title: "The analysis didn’t finish.", body: "Nothing was saved. Try again in a minute." },
  unreachable: { title: "The analysis didn’t finish.", body: "Redline couldn’t reach the server. Check your connection and try again." },
  "save-failed": {
    title: "The analysis couldn’t be saved.",
    body: "Redline shows an analysis only once it’s saved in your library. Try again in a minute.",
  },
  "accounts-off": {
    title: "Accounts aren’t set up on this server.",
    body: "Without accounts, Redline can’t analyse a document from a library.",
  },
  "signed-out": { title: "You’re signed out.", body: "Sign in again to analyse this document." },
  "not-found": { title: "This document isn’t in your library.", body: "It was deleted, or it belongs to another account." },
  invalid: { title: "Redline couldn’t analyse this text.", body: "Add the document again, then try once more." },
};

/**
 * The clause number at the start of the line a citation sits on ("4.2" for a
 * line starting "4.2 Upon expiration..."), or null when the line has none.
 * Read from the document text, so it is only ever what the document says.
 */
export function clauseNumberAt(text: string, offset: number): string | null {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const match = /^(\d+(?:\.\d+)*)\.?[ \t]/.exec(text.slice(lineStart, offset));
  return match ? match[1] : null;
}
