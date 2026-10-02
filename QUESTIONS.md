# Open questions

Questions logged during work, waiting for an answer. Newest at the bottom.

## 2026-10-01: Which issue tracker should Redline use?
- **Need:** a tracker for `to-tickets`, `to-spec` and `triage` to read from and write to. These skills can't run without one. The triage labels are skipped until this is answered, because they depend on the tracker.
- **Recommendation:** GitHub Issues on `metoinside/redline` via `gh` (already authenticated), with the default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`).
- **To finish:** answer, then re-run `/mattpocock-skills:setup-matt-pocock-skills`.

## 2026-10-02: Can the buyer's red lines name clauses outside the renewal-and-exit family?
- **Need:** ADR 0003 puts every red-line breach in *Negotiate before signing*, but ADR 0004 lets only clauses in the family become flags. A red line such as "no uncapped indemnity" falls between the two.
- **Recommendation:** red lines set limits only within the family, for example "no notice window longer than 60 days" or "no auto-renewal longer than 12 months". This keeps every flag testable. Allowing any clause would reopen ADR 0004 through the back door.
- **Until answered:** `PRD.md` §5 applies the recommendation.

## 2026-10-02: Test set size, targets and source of contracts
- **Need:** `PRD.md` §4 defines the checks but not their numbers: how many labelled vendor contracts, the recall, top-tier precision, notice-obligation and outside-terms targets, and where real contracts come from.
- **Recommendation:** start with 20 contracts, aiming for at least 95% recall on renewal-and-exit clauses and at least 80% top-tier precision. Raise the targets once a baseline exists. Source the contracts from public sample MSAs and order forms, plus contracts that interviewees agree to share.
