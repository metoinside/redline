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
- All copy passes the humanizer skill before commit (`CLAUDE.md`). Terms follow `CONTEXT.md`.

## Direction contract

THESIS: Renewal and exit, signed like the road. Each flag is a sign posted over the contract, pointing at its sentence. Refuses the category's split hero with a browser-framed screenshot of a flag list.

OWN-WORLD: Interstate guide green panels with an inset white border and rounded corners own the frame. Asphalt carries the contract text, with yellow road-marking highlights on cited sentences. Red-and-white regulatory panels mean *Negotiate before signing*, yellow warning panels mean *Know before signing*, and orange construction panels mark outside terms. Highway lettering (Overpass) sets every sign; the contract itself is set in a document serif.

STORY: The visitor sees a contract under a gantry of signs, reads which clauses cost money and why, finds each sentence, learns what Redline won't do, and takes the exit: try it on a document.

FIRST VIEWPORT: A full-width green gantry panel carries the route-shield wordmark, the navigation links, the headline and the exit panel (the primary action). Below it, the gantry's signs hang over the asphalt, where the sample contract begins, the first cited sentence already marked.

FORM: Exit Ahead, interstate guide and warning signage. First on my ordered list (model pick, chosen by the owner). Seed key 03512813.

SIGNATURE INTERACTION: As the contract scrolls under the gantry, each cited sentence crossing the reading line lights its sign (dim to retroreflective) and the signs rank themselves by tier, then by money. Reduced motion shows every sign lit.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Sign-in and upload routes don't exist yet (#2, #3). The action links to `/sign-in?next=/new`.
