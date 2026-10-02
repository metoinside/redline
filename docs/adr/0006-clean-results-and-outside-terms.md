# 6. Clean results are allowed, but never while outside terms are unread

Date: 2026-10-02. Status: Accepted.

When a document has nothing to negotiate, Redline shows a **clean result**: "No renewal or exit terms to negotiate". The clean result lists the five renewal-and-exit clause types and, for each one, shows either "found, low exposure" with a citation, or "we found none". It never says "there is none", because a missed clause behind a confident all-clear would be the worst failure the product can make.

Many vendor contracts bring in terms from another document, for example "subject to the Terms of Service at vendor.com/terms" or a separate order form. The renewal clause often lives in that other document. Every sentence that brings in outside terms is shown as an **outside-terms notice** with its citation, and it names the document to upload next. While any outside-terms notice exists, the result cannot be shown as clean.

## Considered options
- **Always showing something,** so every upload feels worth it. Rejected, because a tool that always finds problems stops being believed.
- **Ignoring outside terms** and analysing only what was uploaded. Rejected, because it produces false all-clears for exactly the clause family Redline exists to catch.
- **Combining several files into one contract.** Rejected for v1, because it changes the library and adds to the six capabilities.

## Consequences
- Some buyers will see a clean result and conclude Redline did nothing. The brief must defend the clean result as a valid answer.
- An outside-terms notice is a new kind of output: it is not a flag, it has no tier and no counter-offer, and it is not limited to the renewal-and-exit family.
- Most SaaS contracts point to outside terms, so clean results will be rare in the buyer segment.
