import type { ClauseType, ExposurePart, Tier } from "@/lib/engine/types";
import type { RunAnalysisFailure } from "./actions";

// What the buyer reads in the analysis view. Every line here went through the
// humanizer skill. Nothing in it says more than the flag does: its clause type,
// its tier, the exposure its sentence cites, and the sentence itself. The
// statement and readings on each flag come from the engine, which has already
// run them through the wording check.

export const CLAUSE_LABEL: Record<ClauseType, string> = {
  auto_renewal: "Auto-renewal",
  notice_window: "Notice window",
  early_termination_fee: "Early termination fee",
  rollover: "Rollover",
  multi_year_term: "Multi-year term",
};

/** The tiers, named for what the buyer should do (ADR 0003). */
export const TIER_LABEL: Record<Tier, string> = {
  negotiate: "Negotiate before signing",
  know: "Know before signing",
};

/** One line under each tier's heading, saying what put a flag there. */
export const TIER_NOTE: Record<Tier, string> = {
  negotiate: "Each of these states a sum, a lock-in period, a notice period or a fee, or reads two ways.",
  know: "These are part of how the contract renews or ends, but none of them states a sum, period or fee.",
};

/** The labels for the parts of a flag's exposure, each shown only when its sentence cites it. */
export const EXPOSURE_LABEL: Record<ExposurePart, string> = {
  money: "Money",
  lockIn: "Lock-in",
  exitDifficulty: "Getting out",
};

const countOf = (n: number, noun: string) => `${n === 1 ? "One" : n} ${noun}${n === 1 ? "" : "s"}`;

export const ANALYSIS_COPY = {
  heading: "Analysis",
  vendorOnly:
    "Redline is tuned and checked for vendor, SaaS and service contracts only. If this is another kind of document, such as a lease or a freelance agreement, nobody has checked the analysis for it.",
  scope:
    "Redline looks for five kinds of renewal and exit clause: auto-renewals, notice windows, early termination fees, rollovers and multi-year terms. Each flag shows the exact sentence it comes from, checked word for word against the text below.",
  notRun: "This document hasn’t been analysed yet.",
  run: "Analyse this contract",
  rerun: "Analyse again",
  running: "Analysing the contract. This can take a minute.",
  ranOn: "Analysed",
  notSaved: "This analysis isn’t saved. It’s gone when you leave this page.",
  empty: "We found no renewal or exit clauses in this document.",
  found: (negotiate: number, know: number) =>
    `${countOf(negotiate + know, "flag")}: ${negotiate} to negotiate before signing and ${know} to know before signing. Select a flag to go to its sentence.`,
  noExposure: "This sentence states no sum, lock-in period or fee.",
  twoReadings: "This sentence can be read two ways:",
  twoReadingsShort: "Reads two ways",
  noExposureShort: "No sum, period or fee",
  outdated: {
    title: "This analysis came from an earlier version of Redline.",
    body: "It has no tiers or exposure, so it isn’t shown. Analyse the contract again to see them.",
  },
  rejected: {
    title: "The saved analysis didn’t pass Redline’s checks, so it isn’t shown.",
    body: "Analyse the contract again to get a new one.",
  },
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
  "wording-failed": {
    title: "The analysis didn’t pass Redline’s wording check.",
    body: "Both tries hedged or compared this contract with others, so Redline didn’t show it or save it. Try again.",
  },
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
