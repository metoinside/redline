# Build brief for agents

Every agent building a ticket reads this file first, then `CLAUDE.md`, `CONTEXT.md` and the ADRs its ticket names. The spec is GitHub issue #1 (`gh issue view 1`); tickets are issues #2–#13. Where this brief and an ADR disagree, the ADR wins; where `CLAUDE.md` disagrees with anything, `CLAUDE.md` wins.

## Owner's answers (given 2026-10-05, binding)

1. **Model.** The model is whatever `OPENROUTER_MODEL` says. Call it through OpenRouter's OpenAI-compatible endpoint (`https://openrouter.ai/api/v1/chat/completions`) with `OPENROUTER_API_KEY`, from the server only. Every request:
   - pins the provider: `provider: { order: ["fireworks"], allow_fallbacks: false, require_parameters: true }`;
   - sets `reasoning: { effort: "low" }`;
   - requests structured JSON output: `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }` for every analysis and answer call.
   Never write a model id into code, tests, fixtures or docs. Never put either variable behind `NEXT_PUBLIC_`. Use `fetch`; do not add an OpenAI SDK.
2. **Supabase.** No project exists yet. Build sign-in, the library and red lines against the real Supabase client (`@supabase/supabase-js`, `@supabase/ssr`), reading `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Write every table and policy as SQL migration files under `supabase/migrations/` (timestamped names, e.g. `20261005120000_documents.sql`); the owner runs them by hand. The app must start and analyse a pasted document with both variables absent; only the library and red lines need an account. When they are absent, account features say plainly that accounts are not set up on this server. **Do not mock auth in the product.**

## What does not count as done

A ticket containing any of these is still open:
- a function that returns a fixed value in place of real behaviour;
- a TODO, a "not implemented" error, or a placeholder screen;
- a test that only checks a file exists or a function is defined;
- a test that mocks the thing it is meant to test (the scripted model client stands in for the model, never for the verifier, the tiering rules or the engine).

## Tests

- `npm run typecheck` (tsc --noEmit), `npm test` (vitest run, whole suite), `npx vitest run <file>` for one file.
- Tests check what the buyer would see (the analysis or answer that comes back), never prompts or private helpers.
- Every test that needs a contract uses `tests/fixtures/` (see its README). The model client in tests is the scripted client, returning payloads built from the fixture sidecar, so the suite runs with no key and no network.
- Row-level security is tested by running the real migration SQL in PGlite (`@electric-sql/pglite`, in-process Postgres) with a small shim for Supabase's `auth` schema (`auth.users`, `auth.uid()` reading `request.jwt.claim.sub`, roles `anon` and `authenticated`). The shim lives in test code only, never in a migration.

## Layout

- `app/` Next.js App Router. `/` is the landing page. Signed-in screens live under `app/(app)/` and share the app shell layout (`.impeccable/surfaces/app-app-layout-tsx.md`).
- `lib/extraction/` browser text extraction and the one normalisation function (ADR 0001). Pasted text goes through the same normalisation.
- `lib/engine/` the analysis engine: model client interface, OpenRouter client, scripted client (test use), citation verifier, tiering rules, wording check, clean-result rule, `analyse` and `ask`.
- `lib/supabase/` browser and server Supabase clients, and a single "is Supabase configured" check.
- `supabase/migrations/` SQL only.
- `scripts/smoke.ts` runs the fixture contract through the real pipeline (`npm run smoke`).
- `tests/` vitest tests and fixtures.

## Rules

- Engine rules are applied in code after the model returns: verbatim citation check (with offsets), the five clause types only, tiering (top tier only with a cited sum, period or fee, two readings, or a red-line breach), wording check (no hedging, no market comparisons in any generated text), clean-result rule.
- Every screen obeys `DESIGN.md`, `PRODUCT.md` and the app shell brief. Do not start an impeccable direction round or open a browser page that waits for a person.
- All copy a reader sees (UI labels, error messages, empty states, model-facing text excluded) goes through the humanizer skill (`humanizer:humanizer`) before you finish. Terms follow `CONTEXT.md`.
- Dependencies: only those listed in `BUILD-REPORT.md` under "Dependencies added" may be installed. If you need another, do not add it; say so in your final report.
- Never commit. Never touch `.env.local` or print its values. The orchestrator commits.
- Out of scope, never build or stub: payments, billing, OCR, sharing between users, reminders, combining files.

## Final report

End with: what you built (files touched, one line each), the test files you added, the output of `npm run typecheck` and `npm test` (last lines), any criterion you could not meet and why, and any decision you made with its reason.
