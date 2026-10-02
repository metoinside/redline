# Redline
A web app for small business owners signing vendor, SaaS and service contracts (see ADR 0002). Any document can be uploaded, but only vendor contracts are tuned and tested. They get back:
1. A plain-English summary.
2. The clauses that could hurt them, ranked by severity, each with its exact source sentence.
3. A drafted counter-offer for each flagged clause.
4. A question box that answers only from the document.
5. An editable list of their own red lines, which drives the analysis.
6. A saved library of their past documents.
When choosing between options, pick the one that makes the output more trustworthy.

## Read first
- `research/summary.md`: the user research. Read it before deciding what the product should do.
- `PRD.md`: the brief, once it exists. Read it before building.
- If `PRD.md` conflicts with this file, this file wins. Log the conflict as a question (see below).

## Settled decisions (do not reinterpret)
- The stack is Next.js, Supabase for auth and database, and Vercel for deployment.
- The uploaded file is parsed in the browser. Only the extracted text is stored. Never upload or store the original file, including in Supabase Storage.
- Every risk flag cites the exact sentence it came from. A flag whose source cannot be shown is a bug.
- Check each citation in code: the cited sentence must appear verbatim in the stored document text. Never trust the model's quote unchecked. A flag that fails the check is not shown.
- The product calls its model through OpenRouter, from the server only. The key never goes in a `NEXT_PUBLIC_` variable or reaches the browser.
- Every table has Supabase row-level security, so users can only read and write their own rows.

## Scope
- Build the six capabilities above and stop there.
- If something looks like the obvious next step and is not on that list, ask before building it.
- Payments, billing, OCR for scanned documents, and sharing documents between users are excluded on purpose. Do not build them, stub them, or design for them.
- OCR would undermine trust: a citation is worthless when the text it points at was misread. If a file has no extractable text, tell the user and stop.

## Standing rules
- State only what the document says. Where the text does not support a claim, the product does not make that claim. This applies to the summary, the flags and the question box.
- If the document does not answer a question, the question box says so. It does not answer from general knowledge.
- The user's red lines are an input to every analysis run, not a separate feature.
- Keep credentials in `.env.local`, which is gitignored. Never commit a secret: a key is public the moment it is pushed and has to be rotated.
- Before every commit, check the staged files for `.env*` files, keys and tokens.
- Ask before adding a dependency.

## When I'm not watching
- Builds often run unattended. When something needs my approval (a dependency, out-of-scope work, a PRD conflict), do not stop the build.
- Append the question to `QUESTIONS.md` with the date, what you need, and your recommendation.
- Skip only the work that depends on the answer, and keep building the rest.
- Never treat an unanswered question as a yes.

## Agent skills

### Issue tracker

GitHub Issues on `metoinside/redline`, via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.
