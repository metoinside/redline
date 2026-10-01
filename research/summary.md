# Redline: research summary

Date: 2026-10-01. Based on four research files in this folder: `who-has-this-pain.md`, `what-goes-wrong.md`, `what-already-exists.md`, `who-would-pay.md`.

**How much to trust this.** It is a thin evidence base. Each agent read 3–9 pages. Many figures come from search snippets and were never read in full. Quotes came back through a summarizing fetch tool, so they are probably verbatim but not guaranteed character-exact. No Reddit or Hacker News threads were successfully sourced. Read everything below as directional.

---

## 1. The three sharpest pain points

**1. Auto-renewal notice windows: missed by days, billed for a year.**
> "signed a SaaS contract last year for $48k/yr. company stopped using the tool 6 months ago. assumed cancellation by non-renewal."

That is an ops director who missed a 90-day written non-renewal notice by two weeks and was invoiced the full $48,000. Source: https://terms.law/forum/thread/saas-msa-auto-renewal-trap-2026.html

The quantitative backing is FTC negative-option complaints, which rose from 42/day (2021) to ~70/day (2024): https://www.ftc.gov/news-events/news/press-releases/2024/10/federal-trade-commission-announces-final-click-cancel-rule-making-it-easier-consumers-end-recurring

**2. Multi-year lock-ins buried in small print (small B2B buyers).**
> "They put a very small unreadable line in a very long contract mentioning the contract cannot be terminated before 5 years period."

Source: https://www.trustpilot.com/review/clickplus.be. A related case: coffee-machine finance customers describe "all very small print" that "ties you in to an automatic rollover for a period that is the same length as the first one." Source: https://www.trustpilot.com/review/cfandl.co.uk

**3. IP assignment and non-competes that hit individuals later.**
> "Early in my career I signed a contract that assigned IP for anything I built 'during the term of employment'...Learned that lesson the hard way."

Source: https://www.indiehackers.com/post/09948f0666. These are comment-thread anecdotes. The non-compete side has scale: the FTC estimates ~18% of US workers (~30M) are covered. That figure measures how many are covered, not how many were harmed.

**What the three have in common:** the harm is found at exit or renewal time, not at signing. The person often missed one specific clause rather than misunderstanding the whole document.

---

## 2. Clause types that matter most, ranked

This order is a judgment, not a count. The sources use different units: survey percentages, complaint counts, single-state data.

| Rank | Clause / issue | Who | Strength of evidence | Can a reader tool prevent it? |
|---|---|---|---|---|
| 1 | Auto-renewal, notice windows, early-termination fees, rollover | Consumers, SMBs | Strong: FTC data plus most of the first-person quotes | **Yes**, it is a clause you can spot at signing |
| 2 | Payment terms: nonpayment, late payment | Freelancers | Strong prevalence (62% of NY freelancers lost wages; 91% paid late) | **Mostly no**: it is client behavior and enforcement. Only ~25% of freelancers even have written contracts |
| 3 | Security deposits and rental fees | Tenants | Moderate: ~5,000 NY AG deposit complaints since 2023 | Partly: much of it is landlord conduct, not lease wording |
| 4 | Non-competes | Employees, contractors | Coverage data only, not harm data | Yes |
| 5 | IP assignment | Employees, freelancers | Anecdotal only | Yes |
| 6 | Forced arbitration and class-action waivers | Consumers | Weak (0.04% of CFPB complaints), likely under-reported | Yes, but rarely negotiable |

**No evidence was found** for liability caps, indemnity, unilateral termination, fee escalators, kill fees or non-solicit. These are lawyer-salient clauses, but nothing found shows they burn ordinary signers.

---

## 3. Where existing tools are weak

- **Accuracy and calibration is the recurring complaint across the market.** Specific examples:
  - Legalfly: wrong jurisdiction and outdated law.
  - Spellbook and Harvey: hallucinated citations.
  - ClauseAudit: "a bit aggressive on a couple of standard clauses", i.e. it over-flags.

  Showing the exact source sentence addresses this. That is our inference; no source says users asked for it.
- **Price and access gap at the individual end.** Enterprise tools (Harvey, Spellbook, Ironclad, LegalOn) are sales-led with non-public pricing, often in the thousands per seat. They are irrelevant to someone signing a lease or a freelance agreement.
- **ToS;DR covers only services that volunteers have reviewed** and cannot read a document you upload.
- **No tool found addresses the "found out at renewal" problem.** All of them review at signing time. This is an absence in what was searched, not a confirmed gap.

But the low end is **not** empty (see section 5).

---

## 4. Who would plausibly pay, and roughly what

| Segment | Pain | Willingness to pay | Read |
|---|---|---|---|
| Small business owners | ~1 in 4 sign contracts as presented; they cite cost, time and low confidence in legal language (Rocket Lawyer 2026 survey) | Already pay lawyers $250–$750 flat per contract; some pay Rocket Lawyer $35–$65/mo | **Most plausible payer** |
| Creators / influencers | High-value brand deals | Lawyer review averages ~$670 (ContractsCounsel) | Plausible, but no data on how many skip review |
| Freelancers | Largest pool (20M+ US) and real pain | Under 1% ever used the legal system; the main pain (nonpayment) isn't a reading problem | Big but weak payer |
| Tenants | Low reading rates (UK: only 24% read the agreement) | No WTP evidence; UK data only | Unproven |

**Price range the evidence supports:** roughly **$10–$65/month**, or **$20–$100 per contract**. This is inferred from anchors: lawyers at $250–$750 per review sit above it, and Rocket Lawyer's bundle at $35–$65/mo sits inside it. **No source gave a direct willingness-to-pay figure from any segment.**

---

## 5. What contradicts the hypothesis

The evidence **does not support building Redline as currently described**: a general reader for contracts, leases, freelance agreements and ToS, sold on summaries, risk ranking, counter-offers and document Q&A. The pain is real but narrower than the pitch, and the feature set is not differentiated.

1. **The features are already shipped, some for free.**
   - ClauseAudit does almost exactly this for freelancers and tenants: risk score, severity flags, plain English, negotiation scripts, built on the Anthropic API.
   - ContractClarifyAI and ClauseCatch are similar.
   - Genie AI has a free tier and a $38/mo plan.
   - Rocket Lawyer bundles **unlimited** AI contract review into $35–$65/mo memberships.
2. **The free substitute is already in use.** 56% of AI users say they seek legal advice from ChatGPT or other AI (n=1,000, law-firm survey). One vendor test found Claude caught 5 of 5 planted NDA flaws when a user simply pasted the contract in.
3. **No direct evidence anyone will pay** for consumer-grade contract review.
4. **The highest-prevalence freelancer pain is not a reading problem.** Nonpayment comes from client behavior and enforcement. Reading the contract more carefully would not have saved most of those 62%.
5. **Harm surfaces at exit, not at signing.** In the strongest cases, the $48k renewal and the rollovers, the contract might have been read and the deadline still missed. A one-time read at signing may sit at the wrong moment in the problem.
6. **Some harm isn't in the document at all.** The Hush case: "that policy doesn't appear anywhere in the Terms of Use I agreed to." A document-grounded tool cannot catch that.
7. **There is zero first-person tenant or lease evidence.** ToS is the category people are least likely to pay for. Two of the four document types in the pitch are unsupported.
8. **Regulatory risk is concrete.** The FTC fined DoNotPay ($193k, Feb 2025) for claiming lawyer-level quality without testing it. Severity rankings and drafted counter-offers sit close to that line.
9. **Business-viability warning.** Robin AI (~$69M raised) failed to close a $50M round and sold off parts of the company in Dec 2025. No cause was sourced, so draw no conclusion beyond "this is a hard market."

**What the evidence does support:** small business buyers locked in by auto-renewal, notice windows and multi-year terms, with real money at stake ($48k, five-year lock-ins). If anything is worth validating next, it is that segment and that clause family. The open question is whether the job is *reading* the contract or *remembering the deadline* it creates.

---

## Biggest gaps before writing a PRD

- Reddit and HN complaints were not sourced at all. They are the obvious next pass.
- No direct willingness-to-pay data from any segment. This needs interviews, not desk research.
- No US tenant data.
- Clause-level complaint counts don't exist in the public data found. Every complaint dataset is categorized by issue, not by the clause that caused it.
