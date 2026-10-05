---
version: 1
slug: "app-app-layout-tsx"
primary_target: "app/(app)/layout.tsx"
related_targets: []
---

# App shell (behind sign-in)

Scope: the frame every signed-in screen sits in. Brief only; no screen is built yet. Built with the tickets: #2 (shell and library), #3 (upload and paste), #4–#7 (result), #9 (question box), #10 (red lines), #11 (library history). Visitor mode: **Operate**.

## Task and information
The buyer comes back to do one of five jobs, and each gets its own area in the frame:
1. **Add a document.** Upload a PDF or DOCX, or paste the text. A scanned file with no text is refused with the reason. Paste is decided but not yet in #3 (see `QUESTIONS.md`).
2. **Read the result.** The summary with notice obligations; flags in two tiers, ordered by money; outside-terms notices; the clean result ("No renewal or exit terms to negotiate", with "we found none" per clause type). Each claim sits beside its citation, which is highlighted in the document text.
3. **Ask the document.** The question box answers with a citation, or says "the document doesn't say".
4. **Keep red lines.** An editable list of limits on the five clause types, applied to every analysis.
5. **Find past documents.** The library, newest first, each analysis showing its run date and the red lines it used.

## States worth designing
- Empty library (first visit).
- Upload refused (no extractable text).
- Analysis running.
- A result with top-tier flags.
- A result with outside-terms notices and therefore no clean result.
- A clean result.
- The question box answering, and saying "the document doesn't say".
- A flag naming the red line it breaches.

## World in an Operate frame
The world (Marked-up Draft, chosen 2026-10-05; see the landing brief's direction contract) lends only type, palette, density and one signature move. Layout, navigation and controls stay standard web components.
- **Type:** Libre Franklin for the interface; Source Serif 4 for contract text and citations.
- **Palette:**
  - manila only for the frame (navigation rail and page ground around the document), never behind working text;
  - the document on a white sheet, black ink, for long reading sessions at a desk;
  - Redline red is the one marking ink: citation underlines and counter-offer insertions;
  - tier colours with fixed meanings, carried by flag tabs: red means *Negotiate before signing*, yellow means *Know before signing*, blue means an outside-terms notice. A clean result shows no tab colour; it is stated in plain words.
- **Density:** comfortable for reading at a desk; tables in the library use tabular figures.
- **Signature move:** the result's flags stand as tabs on the document sheet's edge, in ranked order. Selecting one scrolls the document to its sentence and marks it with the red underline; its margin comment holds the exposure and the counter-offer. Notice obligations sit in the margin as dated comments ("Notice by 2 Oct 2028").
- **Never:** a costume of a law office. No wood desk, no handwriting fonts, no paper texture or torn edges on working screens.

## Constraints
- Every citation shown has passed the verbatim check. A failed one is never rendered.
- No hedging words, no market comparisons, no score.
- Copy passes the humanizer skill before commit.

## Unresolved
- Paste in #3.
- Whether red lines can name clauses outside the family (`QUESTIONS.md`).
