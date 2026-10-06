# Build report

Unattended build, 2026-10-05 23:27 to 2026-10-06. The spec is issue #1 and the tickets are #2 to #13. Each finished ticket has a **Status:** line and ticked criteria in its GitHub issue. Issues are left open so you can close them after your review.

## Where it stands

- `npm run build` passes.
- `npm test` passes: 36 files, 498 tests. No test needs a key or a network.
- `npm run typecheck` passes.
- `npm run smoke` runs, but **the real model was never reached.** The OpenRouter key in `.env.local` gets `401 User not found`, both from the smoke script and from a direct call to OpenRouter's key endpoint. So no flags have come back from a real model yet, and no count of flags surviving verification exists. Smoke output:
  ```
  Analysing adhesion-contract.txt (10,804 characters)...
  The model call failed (http 401): The model service answered 401: User not found.
  ```
- With no Supabase variables set, `next start` serves `/`, `/new`, `/library`, `/sign-in` and `/red-lines` with status 200. A pasted or uploaded document opens in the browser-only view. Analysing it needs a working key.

## Ticket status

| Ticket | Status | Commit | Not verified |
|---|---|---|---|
| Scaffold: Next.js app, landing moved in | done | 18f8000 | |
| Fixtures | done | 157f676 | |
| #2 Sign in and an empty library | done except the deploy | 9386235 | The Vercel deploy. Sign-up and sign-in against a live Supabase project |
| #3 Upload a contract and see its extracted text | done | f4930ec | Saving to the library against live Supabase. The signed-out path was checked in headless Chrome |
| #4 First flag with a checked citation | done | 11e43e5 | The real model. Saving analyses against live Supabase |
| #5 All five clause types, tiers and exposure | done | 462b4cc | The real model |
| #6 Summary and notice obligations | done | 4b62c60 | The real model |
| #7 Outside-terms notices and the clean result | done | 599ea29 | The real model |
| #8 Counter-offers for each flag | done | c773d22 | The real model. Counter-offer quality is a human check (PRD §4, check 12) |
| #9 Question box | done | 2ba4864 | The real model. Saving questions against live Supabase |
| #10 Red lines drive the analysis | done | 7e7fc83 | Saving red lines against live Supabase |
| #11 Library: analysis history and delete | done | b63832f | Live Supabase |
| #12 Labelled test set | not started | | Needs a person: real contracts and human labels (`ready-for-human`) |
| #13 Eval suite that blocks releases | blocked by #12 | | Its whole job is scoring against the labelled set. Building it over the synthetic fixtures would be a way around the blocker |

No ticket failed verification or was sent back.

## Decisions made in your absence

1. **Where the spec and tickets live.** The run prompt pointed at `.scratch/` and an issues folder. Neither exists; GitHub issues #1 to #13 are the spec and the tickets. Status is tracked by editing each issue.
2. **Dependencies were added without waiting.** The run prompt said to decide rather than stop, but `CLAUDE.md` says to ask, so each one is also logged in `QUESTIONS.md` for you to confirm or reverse.

   | Package | Why |
   |---|---|
   | next, react, react-dom | The settled stack |
   | typescript, @types/node, @types/react, @types/react-dom | Typecheck |
   | vitest | Test runner |
   | tsx | Runs `scripts/smoke.ts` |
   | @supabase/supabase-js, @supabase/ssr | The settled stack |
   | @electric-sql/pglite (dev) | Runs the real migration SQL in-process for row-level security tests |
   | pdfjs-dist | PDF text extraction in the browser |
   | mammoth | DOCX text extraction in the browser |

   OpenRouter is called with `fetch`, so there is no SDK.
3. **Row-level security is tested in PGlite, not a local Supabase.** Docker wasn't running and the Supabase CLI isn't installed. The tests apply every file in `supabase/migrations/` to an in-process Postgres, behind a test-only shim for Supabase's `auth` schema. They prove the policies, not your project's own setup. Turning RLS off made the tests fail, so they do catch it.
4. **The landing page moved into the app** as `app/(marketing)/`, a root layout of its own, so its CSS can't leak into the signed-in screens. The old `landing/` folder is gone, and the "Try it on a document" links now go to `/new`. One sentence was corrected and humanized: it used to say you sign in before uploading. It now reads "Upload a PDF or DOCX or paste the text, with or without an account."
5. **Paste was added to #3's acceptance criteria,** as `QUESTIONS.md` recommended. Pasted text goes through the same normalisation as extracted text.
6. **Shared agent brief.** `docs/agents/build-brief.md` holds your two answers, the "not done" rules and the layout. Every ticket agent started from it.
7. **One normalisation function** (`lib/extraction/normalize.ts`) is applied at extraction, to pastes, and to the model's quotes before the verbatim check (ADR 0001).
8. **Scanned and partly scanned files are refused.** Analysing only the pages that have text would quietly leave part of the contract out.
9. **Tiers, exposure, red-line breaches and cleanliness are all worked out in code** from verified citations, on every run and again every time a saved analysis is read. Stored tiers, counts and "clean" values are never trusted. Money is parsed from the cited words, never from a number the model reports.
10. **Wording failures fail the run.** If any generated text (statements, readings, summary, deadlines, notice descriptions, counter-offers, answers) contains hedging or a market comparison, the model gets one retry with the defects named. If any remain, nothing is shown or saved and the buyer sees a plain error. The other options were showing hedged text or silently dropping a flag, and both are less trustworthy. Capitalised "May" next to a date is read as the month.
11. **A missing counter-offer fails the run** rather than hiding the flag, because hiding the flag would hide the risk too.
12. **A red-line breach is claimed only when the cited words state a figure** past the limit, or when the clause type is marked "not allowed". Mixed units count only when the breach is certain.
13. **Deadlines are never turned into calendar dates the text doesn't state.** A relative deadline shows its rule and what it counts from.
14. **A hedged answer in the question box gives an error,** not "the document doesn't say", because that reply would be a false claim about the document.
15. **Analyses and questions can't be edited.** A new run is a new row, and its red lines are saved as a snapshot.
16. **One UI string was edited after its agent's humanizer pass.** "It may have been deleted in another tab" became "Reload the page to see your current list.", because the product doesn't hedge.
17. **The code review step was skipped,** as you asked.

## Open choices you should know about

- The counter-offer prompt asks the model to stay within your red lines, but no code checks that.
- A red-line breach can be missed if the model files the figure under the wrong exposure part. The prompt says which part to use.
- The library loads every document's full text so it can re-check results. Paginate it if libraries grow large.
- The copy button on a counter-offer copies the message, the current sentence and the proposed wording. To copy the message alone, change one line (`COUNTER_OFFER_COPY.toSend`).
- `documents.source_kind` is NOT NULL with no default. Run the migrations in order on an empty table.
- Password-protected PDFs are refused in code, but no test file covers that path, because nothing on this Mac could encrypt a PDF.
- There are no default red lines. ADR 0002 mentions them, but no ticket asked for them.

## What could not be verified

- **Model:** every real-model path (analysis, question box, smoke) failed on the 401 key. The OpenRouter request shape (provider pin, low reasoning effort, strict `json_schema`, model from `OPENROUTER_MODEL`) is proven only against a fake network.
- **Supabase:** sign-up, sign-in, email confirmation, every save and load, and delete. The code uses the real client, but no project exists.
- **Vercel:** nothing was deployed by hand. Pushing to `main` triggers a deploy, but the project's Root Directory still points at the deleted `landing/` folder, so that deploy will fail until it is changed. The previous deployment stays live.

## Run these first

1. Get a working OpenRouter key and put it in `.env.local` as `OPENROUTER_API_KEY`. Keep `OPENROUTER_MODEL` as it is. Then:
   ```
   npm install
   npm test
   npm run smoke
   ```
   The smoke output lists every flag with its tier, exposure, source sentence and counter-offer, the dropped items and why, and how each planted clause compares with its expected tier.
2. Create the Supabase project. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`. Run the migrations in order in the SQL editor:
   ```
   supabase/migrations/20261005120000_documents.sql
   supabase/migrations/20261006090000_documents_source_kind.sql
   supabase/migrations/20261006120000_analyses.sql
   supabase/migrations/20261006150000_red_lines.sql
   supabase/migrations/20261006180000_questions.sql
   ```
   Add `<your site>/auth/confirm` to the project's allowed redirect URLs. Then rebuild (`npm run build && npm start`), because `NEXT_PUBLIC_` values are baked in at build time.
3. In Vercel, set the Root Directory to the repo root, and add the four variables. `OPENROUTER_*` goes in server-side environment variables only.
4. Answer the open entries in `QUESTIONS.md` (dependencies, red-line scope, test-set size), then start #12.
