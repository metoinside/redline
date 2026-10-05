# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Desktop first. The buyer reviews at a desk with the contract text open beside the analysis; every view must still work on a phone, but the phone is secondary.

## Stack

Settled in `CLAUDE.md`: Next.js, Supabase for auth and database, Vercel for deployment. No code exists yet.

## Users

**The buyer**: a small business owner or operator who signs vendor, SaaS and service contracts (a software subscription, an equipment finance agreement, a cleaning or IT services agreement) without a lawyer. The money is the business's own and is often committed for a year or more. Today they sign as presented, pay a lawyer $250–$750 per contract, use a bundled AI review, or paste the contract into a chatbot.

The job: before signing, find the one renewal or exit clause that will hurt them later, and know what to ask the vendor to change.

**Unserved readers**: freelancers, tenants and terms-of-service readers. They can upload and get an analysis, but the output has not been checked for their documents, and the product must never suggest it has (ADR 0002).

## Product Purpose

Redline reads a contract the buyer is about to sign and shows them, sentence by sentence, what in it could hurt them on renewal or exit. The first version exists to prove the analysis can be trusted. Success is measured against a labelled set of real vendor contracts (PRD §4): every citation verbatim, recall on renewal-and-exit clauses as the main number, and top-tier precision as the guard against over-flagging.

## Positioning

Every claim sits next to the exact sentence it came from, and code checks that sentence word for word against the stored text before anything is shown. A flag whose source cannot be shown is a bug and is never displayed. Competing tools describe risks in their own words; their recurring complaints are hallucinated citations and over-flagging.

Redline also flags a deliberately narrow family (auto-renewal, notice windows, early termination fees, rollover, multi-year terms), ranked by the buyer's exposure as the document states it, never by how unusual a clause is. It will look like it finds less than tools that flag everything. That is the design.

## Operating Context

- The buyer uploads a PDF or DOCX, or pastes the text. The browser extracts the text; only the text is stored, never the file. Scanned documents with no extractable text are refused with an explanation (no OCR).
- The harm surfaces at renewal or exit, often months after signing. The buyer may come back to a saved document before a renewal date.
- The output is read next to the document: citations are highlighted in place and the buyer checks each claim against the text.
- Counter-offers are wording the buyer sends to the vendor with light editing.

## Capabilities and Constraints

The six capabilities, and nothing else:

1. A plain-English summary, listing every **notice obligation** with its date or rule and citation.
2. **Flags** for the renewal-and-exit family, each with a **tier** (*Negotiate before signing* or *Know before signing*), its **exposure**, and its **citation**. Ordered by money exposure within a tier. **Outside-terms notices** and the **clean result** ("No renewal or exit terms to negotiate", "we found none", never "there is none") belong to this capability (ADR 0006).
3. A drafted counter-offer for each flag.
4. A question box that answers only from the document, with a citation, or says "the document doesn't say".
5. An editable list of the buyer's **red lines**, which are an input to every analysis.
6. A library of the buyer's past documents and analyses, private to them.

Binding constraints:

- State only what the document says. No hedging words ("may", "might", "could potentially") and no market comparisons ("unusual", "non-standard", "below market", "typical") (ADR 0003, 0005). Ambiguous clauses show both readings.
- No numeric risk score and no high/medium/low.
- Excluded on purpose: payments and billing, OCR, sharing between users, renewal reminders, combining several files into one contract, flags outside the renewal-and-exit family, legal or jurisdiction claims.
- Every piece of user-facing copy goes through the humanizer skill before it is committed (`CLAUDE.md`).
- Terminology follows `CONTEXT.md`. Use *buyer*, *flag*, *citation*, *tier*, *red line*, *clean result*, *outside-terms notice*, *notice obligation*, and avoid the synonyms it lists.

Open:

- A public landing page is in v1 (decided 2026-10-04): static, in `landing/`, one action (try it on a document). Paste was added as a way in beside upload; issue #3 still has to be updated.
- Whether red lines can name clauses outside the family, and the test-set size and targets (`QUESTIONS.md`).

## Brand Commitments

None binding yet. The working name is Redline; no logo, palette or other identity assets exist.

## Evidence on Hand

- User research in `research/` (summary plus four source files). Thin and directional by its own account; quotes came through a summarising fetch tool.
- Real cases cited in `PRD.md`: the $48k/yr SaaS non-renewal miss, the Clickplus five-year lock-in, the CF&L rollover. Use only as quoted there, with their sources.
- No customers, testimonials, usage numbers, pricing or willingness-to-pay data exist. Do not invent any.
- The labelled test set does not exist yet (issue #12).

## Product Principles

1. **Show the sentence.** The buyer never has to take Redline's word for anything; the citation is the product.
2. **Say less, and only what the text supports.** A narrow, testable claim beats a broad, unverifiable one.
3. **Tell the buyer what to do.** Tiers are named for the action, not for a level of worry.
4. **An honest empty result is a valid answer.** "We found none" is shown plainly, and never while outside terms are unread.
5. **When in doubt, pick the option that makes the output more trustworthy.**
