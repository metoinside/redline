# Redline: brief for the first version

Date: 2026-10-02. Terms in *italics* are defined in `CONTEXT.md`. Decisions are recorded in `docs/adr/0001`–`0006`.

This version exists to prove that the analysis can be trusted. Where a choice below trades something away, it was traded for that.

## 1. Who this is for

**The buyer** is a small business owner or operator who signs vendor, SaaS and service contracts without a lawyer. Examples are a software subscription, an equipment finance agreement, a cleaning or IT services agreement. The money is the business's own, and it is often committed for a year or more.

What they do instead today:
- **They sign as presented.** "Nearly 1 in 4 owners sign contracts exactly as presented", citing time pressure and low confidence in legal language. Source: Rocket Lawyer 2026 SMB survey, https://www.rocketlawyer.com/the-briefing-room/1-in-4-business-owners-sign-contracts-as-is (a vendor survey with no published sample size).
- **They pay a lawyer** $250–$750 flat per contract, or about $349 an hour. Sources: https://www.contractscounsel.com/b/contract-review-cost and https://clio.com/resources/legal-trends/compare-lawyer-rates/. The survey above says cost is why many skip this step.
- **They use a bundled AI review.** Rocket Lawyer includes "unlimited contract reviews" in plans from $34.99/mo (https://www.rocketlawyer.com/pricing). Genie AI has a free tier and a $38/mo plan.
- **They paste the contract into ChatGPT or Claude.** 56% of AI users say they seek legal advice from AI (Kolmogorov Law survey, n=1,000; snippet only). This figure is for AI users in general, not for small business owners.

**Not served:** freelancers, tenants and people reading terms of service. Their documents can be uploaded and will be analysed, but the output has not been checked for them, and the product must not suggest that it has (ADR 0002).

## 2. The problem

The buyer is hurt by a clause they signed, typically when they try to leave or when the contract renews, rather than on the day they sign. The clauses are about renewal and exit.

> "signed a SaaS contract last year for $48k/yr. company stopped using the tool 6 months ago. assumed cancellation by non-renewal."

The contract required "written notice of non-renewal 90 days before term end". The poster, an ops director, missed it by two weeks and was invoiced for the full year. Source: https://terms.law/forum/thread/saas-msa-auto-renewal-trap-2026.html

> "They put a very small unreadable line in a very long contract mentioning the contract cannot be terminated before 5 years period."

Source: https://www.trustpilot.com/review/clickplus.be

> "the finance agreement is all very small print and ties you in to an automatic rollover for a period that is the same length as the first one."

Source: https://www.trustpilot.com/review/cfandl.co.uk (UK small business customers of a coffee-machine supplier).

Two things follow from this evidence:
- **The buyer misses one clause.** They do not misunderstand the whole document. Showing that one clause, with the sentence it came from, matters more than summarising the whole document.
- **Reading at signing may not be enough.** In the $48k case, the buyer may well have read the clause and still missed the deadline. Redline can show the deadline, but it cannot make anyone act on it.

## 3. What the first version does

1. **Upload.** The buyer uploads a document. The browser extracts the text, and only that text is stored. A file with no extractable text, such as a scanned document, is refused with an explanation.
2. **Summary.** A plain-English summary of what the document says. It also lists every *notice obligation*: each date or deadline the buyer must act by, with its *citation*.
3. **Flags.** Each clause in the *renewal-and-exit family* becomes a *flag*. Every flag shows:
   - its *tier* (*Negotiate before signing* or *Know before signing*);
   - its *exposure*;
   - its *citation*.

   Within a tier, flags are ordered by money exposure. A flag whose citation does not match the stored text word for word is not shown.
4. **Outside-terms notices.** Every sentence that brings in *outside terms* is shown with its citation, along with the document to upload next.
5. **Clean result.** When there are no flags in the top tier and no *outside-terms notices*, the result says "No renewal or exit terms to negotiate". It lists the five clause types and shows, for each one, either "found, low exposure" with a citation or "we found none".
6. **Counter-offers.** A drafted counter-offer for each flag, answering its cited sentence. Outside-terms notices get no counter-offer.
7. **Question box.** It answers only from the document, citing the sentence each answer relies on. If the document does not say, the answer says so.
8. **Red lines.** An editable list of the buyer's own *red lines*. The list is an input to every analysis, and a breach of a red line always goes in *Negotiate before signing*.
9. **Library.** The buyer's past documents and analyses. Only the buyer who uploaded a document can see it.

## 4. What good looks like

Each check below runs against a **labelled test set** of real vendor contracts. For each contract, a person has marked:
- every renewal-and-exit clause, with its expected tier;
- every notice obligation;
- every sentence that brings in outside terms;
- a set of questions, some answerable from the document and some not.

The checks fall into three groups.

### Hard requirements (any failure blocks a release)
1. **Citations.** Every citation shown (in flags, notices, summary dates and answers) appears word for word in the stored text. This is checked automatically on every contract.
2. **Top-tier evidence.** Every *Negotiate before signing* flag either cites a specific sum, lock-in period or fee, shows two readings of an ambiguous clause, or breaches a red line.
3. **No hedging.** The output contains no hedging words such as "may", "might" or "could potentially" (ADR 0005).
4. **No market comparisons.** The output contains no comparisons to the market, such as "unusual", "non-standard", "below market" or "typical" (ADR 0003).
5. **Honest clean results.** A clean result never says "there is none". It is never shown while an outside-terms notice exists.
6. **Red lines.** A clause that breaches a red line is always in the top tier.

### Measured on the labelled set
7. **Recall.** The share of labelled renewal-and-exit clauses that Redline flags. Missing a clause is the costlier error, so this is the main number.
8. **Top-tier precision.** The share of *Negotiate before signing* flags that a person also put in that tier. This guards against over-flagging, which is the main complaint about existing tools: ClauseAudit was called "a bit aggressive on a couple of standard clauses" (https://www.producthunt.com/p/clauseaudit/clauseaudit).
9. **Notice obligations.** The share of labelled dates and deadlines that the summary lists, each with a citation.
10. **Outside terms.** The share of labelled outside-terms sentences that are shown as notices.
11. **Question box.** For every unanswerable question in the set, the answer is "the document doesn't say". Answerable questions are answered with a citation.

### Judged by a person
12. **Counter-offers.** Each counter-offer answers its cited sentence, and a buyer could send it with light editing.

**Not yet decided:**
- the size of the test set;
- the numeric targets for checks 7–10;
- where the real contracts come from.

These are logged in `QUESTIONS.md`.

## 5. My red lines

These are the clause types Redline flags. It flags nothing else (ADR 0004). Tier follows exposure, never how unusual the clause is (ADR 0003).

| Clause | Goes in *Negotiate before signing* when | Why it matters (research) |
|---|---|---|
| **Auto-renewal** | It renews for a cited period or amount | The $48k case. FTC negative-option complaints rose from 42 a day (2021) to about 70 a day (2024): https://www.ftc.gov/news-events/news/press-releases/2024/10/federal-trade-commission-announces-final-click-cancel-rule-making-it-easier-consumers-end-recurring |
| **Notice window** | The notice period or method (for example "written") is stated and the deadline falls before the renewal | The $48k buyer missed a 90-day written notice window by two weeks |
| **Early termination fee** | A sum, or a formula for one, is cited | Adobe Stock: cancelling outside a 14-day window commits the subscriber to another year (https://community.adobe.com/t5/stock-discussions/prevent-auto-renewal-of-adobe-stock-annual-paid-monthly-plan/td-p/15514105). CF&L customers describe "huge termination charges" |
| **Rollover** | It renews for a term as long as the original, or longer | CF&L: "they rolled out contract over again for another 5 years" |
| **Multi-year term** | The buyer cannot leave before a cited period | Clickplus: "cannot be terminated before 5 years" |

In every row, the clause also goes in the top tier if it can be read two ways (ADR 0005), or if it breaches one of the buyer's red lines. Otherwise it goes in *Know before signing*.

**Open:** whether the buyer's own red lines can name clauses outside this family, such as "no uncapped indemnity". ADR 0003 puts red-line breaches in the top tier, but ADR 0004 says only clauses in the family become flags. Until this is decided, red lines can set limits only within the family, such as "no notice window longer than 60 days". This is logged in `QUESTIONS.md`.

## 6. The calls I made and what I gave up

| Call | Chosen against | Who is worse off |
|---|---|---|
| Built for the small business buyer (ADR 0002) | Freelancers, the largest pool (20M+ in the US) | Freelancers, who get output nobody checked for them, and the "protect the little guy" story |
| Tuned only for vendor contracts (ADR 0002) | Promising contracts, leases, freelance agreements and terms of service | A tenant who uploads a lease and gets output that has not been checked for leases |
| Show the deadline, send no reminder (ADR 0002) | Adding reminders, a seventh capability | The buyer who sees the 90-day deadline and still forgets it. Redline cannot claim it would have saved the $48k |
| Severity from exposure, not from distance to market norm (ADR 0003) | Ranking the way lawyers do | A buyer who wants to know "is this normal?". A lawyer reviewing Redline's output, who will see a standard auto-renewal ranked high |
| Two action tiers (ADR 0003) | A numeric risk score, or high/medium/low | A buyer who wants a number to compare vendors, or to watch fall after negotiating |
| Only renewal-and-exit flags (ADR 0004) | Adding liability caps, indemnity, price increases and unilateral termination, or flagging anything risky | A buyer whose contract has an uncapped indemnity, which Redline says nothing about. Redline also looks like it finds less than tools that flag everything |
| Flag rather than miss (ADR 0003) | Flagging only what clearly hurts | Every buyer: *Know before signing* lists benign renewal clauses, and some will learn to skip it |
| Plain statements, no hedging (ADR 0005) | Hedged, legally safer wording | A buyer who meets a wrong reading stated confidently. Their protection is the citation next to it |
| Clean result, worded "we found none" (ADR 0006) | Always showing something | A buyer who sees a clean result and thinks Redline did nothing, and Redline's perceived value per upload |
| Outside terms block a clean result (ADR 0006) | Analysing only what was uploaded | A buyer who cannot get the referenced terms, and so never gets a clean result |
| Every flag cites its exact sentence (ADR 0001) | Letting the model describe risks in its own words | A buyer whose contract is missing a protection, which cannot be flagged because there is no sentence to cite. A buyer with a scanned contract, which is refused |

## 7. What we are not building

| Not building | Why |
|---|---|
| OCR for scanned documents | A citation is worthless when the text it points at was misread |
| Payments and billing | They do not make the analysis more trustworthy, and this version exists to prove trust |
| Sharing documents between users | Same reason. It also widens who can see a buyer's contracts |
| Renewal reminders | A seventh capability. Showing the cited deadline is the first version's whole answer |
| Combining several files into one contract | It changes the library and the capabilities. Outside-terms notices tell the buyer which document is missing instead |
| Flags outside the renewal-and-exit family | No evidence of harm to ordinary signers, and no way to test "correct" |
| Comparisons to the market | The document cannot support them |
| A numeric risk score | It suggests a precision the model does not have. The FTC fined DoNotPay $193,000 for untested claims about legal quality (https://www.ftc.gov/node/87474) |
| Tuning for leases, terms of service or freelance agreements | Not served in this version (ADR 0002) |

## 8. What the research could not tell us

- **Whether anyone will pay.** No source gave a willingness-to-pay figure for any segment. The $250–$750 lawyer fee and the $35–$65 Rocket Lawyer plan are anchors, not evidence. Finding out needs interviews.
- **Whether the job is reading the contract or remembering its deadlines.** If most buyers read the renewal clause and forgot it, then the first version solves the smaller half of the problem.
- **How common the harm is.** The small-business cases are anecdotes: one forum post and a handful of Trustpilot reviews, two of them from the UK. No dataset counts complaints by clause.
- **Whether other clauses hurt.** No evidence was found that liability caps, indemnity, unilateral termination or price increases harm ordinary signers. That is an absence in what was searched, not proof that they are harmless.
- **How often vendor contracts bring in outside terms.** The research does not measure this. It was assumed during the brief, and only one case, Hush, describes a policy missing from the document the customer agreed to (https://ie.trustpilot.com/review/gethush.ai). This matters because ADR 0006 is built on it.
- **Whether buyers want citations.** Accuracy is the recurring complaint about existing tools. That showing the source sentence answers this complaint is an inference: no source says users asked for it.
- **Forum discussions.** Reddit and Hacker News threads were never successfully sourced.
- **Exact quotes.** All quotes came through a summarising fetch tool. They are probably verbatim, but not guaranteed character for character.
