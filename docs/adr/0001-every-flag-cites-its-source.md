# 1. Every flag cites its source

Date: 2026-10-01. Status: Accepted.

## Decision
Every risk flag Redline produces cites the exact sentence from the uploaded document that it came from. Before a flag is shown, code checks that the cited sentence appears verbatim in the stored document text. If the source sentence cannot be shown, the flag is treated as a bug, not as a formatting preference, and it is never shown.

## Alternatives
- **The model describes risks in its own words, with no quotes.** This is the easiest to build and reads well. However, the reader has no way to tell a real clause from an invented or misread one.
- **Cite by section or page number only.** This is lighter, but the reader still has to search, and the model can point to the wrong section without anyone noticing.
- **Quote, but treat a missing or mismatched quote as acceptable.** This looks trustworthy without being trustworthy. It is the worst option.

## Why
- The reader never has to take Redline's word for anything. For every flag, they can:
  - see the exact sentence that raised it;
  - find that sentence in their own document;
  - judge for themselves whether the flag is fair.
- If the model makes up or changes a sentence, the verbatim check fails before the user sees the flag.
- Counter-offers inherit the same footing, because each one answers a specific, quoted sentence.

## Consequences
- **Absent clauses cannot be flags.** Risks that come from something missing, such as no liability cap or no notice period, have no sentence to cite.
- **Some risks are lost.** A risk that only appears when several clauses are read together has to be split into citable flags, or it is dropped.
- **OCR stays out.** Citations depend on exact text, so the product cannot accept scanned documents. A misread citation is worse than none.
- **Extraction must keep text faithful.** Any normalisation of whitespace, hyphenation or quote marks must be applied the same way to both the stored text and the citation.
- **Offsets are stored.** Each flag stores the character offsets of its citation, so the UI can highlight it in place.
- **The product shows fewer flags.** Whatever the model claims but cannot quote is dropped. Recall gives way to precision.
- **Testing:**
  - A test must assert that every flag's citation is an exact substring of the document text.
  - Model output varies from run to run, but this check does not, so it can run on every fixture in CI.
  - A failure is a release blocker, not a warning.
