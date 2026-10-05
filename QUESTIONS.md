# Open questions

Questions logged during work, waiting for an answer. Newest at the bottom.

## 2026-10-02: Can the buyer's red lines name clauses outside the renewal-and-exit family?
- **Need:** ADR 0003 puts every red-line breach in *Negotiate before signing*, but ADR 0004 lets only clauses in the family become flags. A red line such as "no uncapped indemnity" falls between the two.
- **Recommendation:** red lines set limits only within the family, for example "no notice window longer than 60 days" or "no auto-renewal longer than 12 months". This keeps every flag testable. Allowing any clause would reopen ADR 0004 through the back door.
- **Until answered:** `PRD.md` §5 applies the recommendation.

## 2026-10-02: Test set size, targets and source of contracts
- **Need:** `PRD.md` §4 defines the checks but not their numbers: how many labelled vendor contracts, the recall, top-tier precision, notice-obligation and outside-terms targets, and where real contracts come from.
- **Recommendation:** start with 20 contracts, aiming for at least 95% recall on renewal-and-exit clauses and at least 80% top-tier precision. Raise the targets once a baseline exists. Source the contracts from public sample MSAs and order forms, plus contracts that interviewees agree to share.

## 2026-10-04: Is a public landing page part of v1?
- **Need:** the new copy rule in `CLAUDE.md` mentions "the landing page", but the Scope section lists only the six capabilities, so a landing page is not in scope as written.
- **Recommendation:** no landing page in v1. Sign-in leads straight into the app. Add one later as its own decision, once the analysis has passed the eval suite.
- **Answered 2026-10-04:** yes. The owner asked for a landing page, built as static HTML/CSS in `landing/` with no new dependencies, to be ported into Next.js when the app is scaffolded (#2).

## 2026-10-04: Paste as a second way in (decided, spec not yet updated)
- **Decision:** the owner chose upload **and** paste for the app shell. Pasted text becomes the stored document text, and citations are checked against it exactly as for an upload.
- **Need:** the spec (issue #1) and ticket #3 cover upload only. Someone has to add paste to #3's acceptance criteria.
- **Recommendation:** add paste to #3 rather than a new ticket, and have the same normalisation as extraction applied to pasted text, so citations stay verbatim (ADR 0001).

## 2026-10-05: Dependencies added during the unattended build
- **Need:** `CLAUDE.md` says to ask before adding a dependency. The unattended build prompt said to decide and record instead of stopping, so the build added: next, react, react-dom, typescript and the React/Node types, vitest, tsx, @supabase/supabase-js, @supabase/ssr, @electric-sql/pglite (dev, for row-level security tests), pdfjs-dist and mammoth.
- **Recommendation:** keep them. Each is either the settled stack or the smallest library for its job; `BUILD-REPORT.md` gives the reason for each. OpenRouter is called with `fetch`, so no SDK was added.
- **Until answered:** the packages stay installed. Remove any you reject and the ticket that needs it reopens.
