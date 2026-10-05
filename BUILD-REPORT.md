# Build report

Unattended build started 2026-10-05. This file is updated as the build runs; the final version is at the bottom of the run.

## Ticket status

| Ticket | Status | Notes |
|---|---|---|
| Scaffold (Next.js app, landing moved in) | in progress | |
| Fixtures | not started | |
| #2 Sign in and an empty library | not started | |
| #3 Upload a contract and see its extracted text | not started | |
| #4 First flag with a checked citation | not started | |
| #5 All five clause types, tiers and exposure | not started | |
| #6 Summary and notice obligations | not started | |
| #7 Outside-terms notices and the clean result | not started | |
| #8 Counter-offers for each flag | not started | |
| #9 Question box | not started | |
| #10 Red lines drive the analysis | not started | |
| #11 Library: analysis history and delete | not started | |
| #12 Labelled test set | not started: needs a person (`ready-for-human`) | |
| #13 Eval suite that blocks releases | blocked by #12 | |

## Dependencies added

`CLAUDE.md` says to ask before adding a dependency. The run prompt said to decide in the owner's absence and record the decision. Each one below is also logged in `QUESTIONS.md` so it can be reversed.

| Package | Why |
|---|---|
| next, react, react-dom | The settled stack |
| typescript, @types/node, @types/react, @types/react-dom | Typecheck |
| vitest | Test runner |
| tsx | Runs `scripts/smoke.ts` |
| @supabase/supabase-js, @supabase/ssr | The settled stack (auth, database) |
| @electric-sql/pglite (dev) | Runs the real migration SQL in-process to test row-level security, since no Supabase project or running Docker exists |
| pdfjs-dist | PDF text extraction in the browser (#3) |
| mammoth | DOCX text extraction in the browser (#3) |

## Decisions made in the owner's absence

1. **Where the spec and tickets live.** The run prompt points to a spec under `.scratch/` and an issues folder. Neither exists; the spec is GitHub issue #1 and the tickets are issues #2–#13. Ticket status is tracked by editing each issue (a Status line and ticked criteria). Issues are left open for the owner to close after the review.
2. **Dependencies.** Added the minimum set above without waiting for approval, because the run prompt said to decide rather than stop. OpenRouter is called with `fetch`, so no SDK was added.
3. **Row-level security tests use PGlite.** Docker is not running and there is no Supabase CLI, so a local Supabase can't start. The tests run the real migration files in an in-process Postgres with a small test-only shim for Supabase's `auth` schema. This proves the policies; it does not prove the Supabase project's own setup.
4. **#12 and #13.** #12 needs a person to source and label real contracts. #13 depends on it, so it is not built; building it over the synthetic fixtures would be a way around the blocker.
5. **Shared agent brief.** `docs/agents/build-brief.md` holds the owner's two answers, the "not done" rules and the layout, so every ticket agent starts from the same contract.
