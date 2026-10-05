---
version: 1
slug: "landing-index-html"
primary_target: "app/(marketing)/page.tsx"
related_targets: []
---

# Landing page

Scope: the public landing page, static HTML/CSS in `landing/`, ported into Next.js when #2 scaffolds the app. Visitor mode: **Persuade**.

## Audience, job, action
- **Who:** the buyer from PRODUCT.md, about to sign a vendor, SaaS or service contract they can still negotiate.
- **What they should come to believe:** Redline shows the renewal and exit terms in their contract, ranked by what is at stake, and every flag points at the exact sentence it came from.
- **One action:** try it on a document (upload a PDF or DOCX, or paste the text). It leads to sign-in, then the upload screen.

## Proof and content
- The demonstration is a sample vendor contract, written for this page and labelled as made up everywhere a visitor could mistake it for a real one.
- No prices, customers, testimonials, statistics or quotes. The research cases stay out of the page.
- Limits are stated plainly: no verdict on whether to sign, no legal advice, no scanned or photographed documents, tuned only for vendor, SaaS and service contracts, flags only the five renewal-and-exit clause types.
- No headline promises full recall ("every term").
- All copy passes the humanizer skill before commit (`CLAUDE.md`). Terms follow `CONTEXT.md`.

## Direction contract

THESIS: Redline marks up your draft. The page is a contract on a desk carrying Redline's marks: red-pen underlines on cited sentences, margin comments, and adhesive flag tabs on the sheet's edge, one per flag, in ranked order. Refuses the split hero with a screenshot of a flag list.

OWN-WORLD: A manila folder ground holds bright white bond sheets with a soft desk shadow. Contract text is black document ink in Source Serif 4. Redline red is the only marking ink: underlines, tracked insertions for counter-offers. Flag tabs carry the tiers: red tab for *Negotiate before signing*, yellow tab for *Know before signing*, blue tab for an outside-terms notice. Interface words are set in Libre Franklin. No cream, no parchment, no lamplight.

STORY: The visitor sees a contract with its renewal sentence already marked, reads which clauses cost money and why, finds each sentence, learns what Redline won't do, and tries it on a document.

FIRST VIEWPORT: On manila: a letterhead row with the wordmark (a red pen stroke under "Redline") and the links; the headline across the folder in large serif, the lede and the primary action (a red-ruled "Try it on a document" button) under it. Below, the white contract sheet starts with its ranked flag tabs standing off its right edge, the first cited sentence already underlined in red with its margin comment.

FORM: Marked-up Draft (the lawyer's redlined draft). First of three on my familiar list in a safer re-roll, chosen by the owner on the decision page. Seed key 03512813.

SIGNATURE INTERACTION: As each cited sentence reaches the reading line, a red pen stroke draws under it and its flag tab slides out from the sheet's edge, the tabs keeping tier-then-money order. Selecting a tab scrolls to its sentence. Reduced motion shows every mark drawn and every tab out.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Sign-in and upload routes don't exist yet (#2, #3). The action links to `/new`.
