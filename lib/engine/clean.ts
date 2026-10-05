// The clean-result rule (ADR 0006; PRD §3 item 5, §4 hard requirement 5),
// applied in code to what survived the checks. The model never says whether a
// result is clean.
//
// A result is clean only when it has no Negotiate before signing flag and no
// outside-terms notice. Only verified items count: a notice whose citation
// failed the check never reaches this function, so it can neither block nor
// unblock a clean result.
//
// A clean result lists the five clause types. A type with flags (all of them
// Know before signing, or the result would not be clean) is "found, low
// exposure" with each flag's citation; a type with none is "we found none".
// The checklist says what Redline found, never that a clause type is absent
// from the contract.
//
// Safe to import in the browser: stored analyses are checked again there.

import { CLAUSE_TYPES, type AnalysisOutcome, type ChecklistEntry, type Flag, type OutsideTermsNotice } from "./types";

export function decideOutcome(flags: readonly Flag[], notices: readonly OutsideTermsNotice[]): AnalysisOutcome {
  const negotiateFlags = flags.filter((f) => f.tier === "negotiate").length;
  if (negotiateFlags > 0 || notices.length > 0) {
    return { clean: false, negotiateFlags, outsideTermsNotices: notices.length };
  }
  const checklist: ChecklistEntry[] = CLAUSE_TYPES.map((clauseType) => {
    const found = flags
      .filter((f) => f.clauseType === clauseType)
      .sort((a, b) => a.citation.start - b.citation.start || a.citation.end - b.citation.end)
      .map((f) => ({ flagId: f.id, citation: f.citation }));
    return found.length > 0 ? { clauseType, status: "found_low_exposure", found } : { clauseType, status: "none_found" };
  });
  return { clean: true, checklist };
}
