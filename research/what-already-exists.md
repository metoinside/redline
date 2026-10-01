# What already exists: contract-review and clause-analysis products

Research date: 2026-10-01. Purpose: test the Redline hypothesis. This is evidence gathering, not advocacy.

## Method note
- Web searches used: 9 of 12. Pages fetched: 9 of 15 (2 returned HTTP 403: geeklawblog.com, G2 ContractCrab).
- Stopped once 8 products had at least one sourced finding.
- Source quality warning: much pricing and "complaint" data comes from aggregator sites and competitor-authored blogs (Vaquill, Spellbook, Costbench, Hyperstart, Talkory). These are marked "(vendor/aggregator)". Treat as indicative, not verified. No Reddit or HN threads were retrieved directly, so no direct Reddit complaint is claimed except one quote relayed second-hand in a vendor blog.

## Comparison table

| Product | What it does | Target | Price | Top complaint found | Sources |
|---|---|---|---|---|---|
| DoNotPay | Consumer "robot lawyer" subscription; legal docs and advice via chatbot | Consumers | Not found in this research | Regulator found it did not deliver on lawyer-level claims; FTC final order Feb 2025, $193,000 | [FTC](https://www.ftc.gov/node/87474), [mychesco](https://www.mychesco.com/a/news/national/ftc-cracks-down-on-misleading-ai-robot-lawyer-what-every-consumer-should-know) |
| Genie AI | Template-based drafting, risk review of existing contracts, alternative clause suggestions, doc Q&A | SMB owners, startup founders, solo practitioners (200k+ signups claimed) | Free tier; Pro $38/mo (10 docs/mo, up to 5 users); Enterprise custom | Gaps in template coverage and "less personalized" answers; one reviewer called outputs biased | [Capterra](https://www.capterra.com/p/10003121/Genie-AI/), [fast.io review](https://fast.io/resources/genie-ai-review-2026/) (vendor/aggregator) |
| ClauseAudit | Upload contract; risk score 0-100, clauses flagged high/med/low, plain-English explanation, negotiation scripts, PDF report, state-specific notes; built on Anthropic API | Job seekers, freelancers, tenants | Not specified on the page read | Risk scoring "a bit aggressive on a couple of standard clauses"; user requested side-by-side redline | [Product Hunt](https://www.producthunt.com/p/clauseaudit/clauseaudit) |
| ToS;DR | Community-rated summaries of ToS and privacy policies, graded A to E | General public | Free; donation funded (non-profit) | Coverage depends on volunteers; "many services still do not have a class"; data subject to change | [ToS;DR about](https://edit.tosdr.org/about), [Usercentrics](https://usercentrics.com/magazine/articles/data-literacy-with-terms-of-service-didnt-read/) |
| Spellbook | Word add-in for contract drafting and review | Lawyers and legal teams | Not public; estimated ~$179/user/mo, ~$350 enterprise (vendor/aggregator estimates); 7-day trial | Opaque pricing; Word-only (no Google Docs); hallucinations require human review | [Hyperstart](https://www.hyperstart.com/blog/spellbook-pricing/), [Costbench](https://www.costbench.com/software/ai-legal-tools/spellbook/) (vendor/aggregator) |
| LegalOn | Playbook-based contract review for in-house legal; attorney-built playbooks for 50+ contract types | In-house legal teams (8,000+ orgs claimed) | Per user, free trial; amount not public | None found: Capterra listing showed 0 reviews | [Capterra](https://www.capterra.com/p/10044750/LegalOn/) |
| Legalfly | AI contract and legal review (EU-oriented) | Legal teams | Not found | Partly inaccurate; struggles with jurisdictions and deadlines; cites outdated or wrong legislation articles (G2 reviewers, via search snippet) | [G2](https://g2.com/products/legalfly/reviews) |
| ContractCrab | AI contract review | Not confirmed from sources read | Not found | "Minor discrepancies in the interpretation of complex clauses"; design bugs (G2 snippet; page itself returned 403) | [G2](https://www.g2.com/products/contractcrab/reviews) |
| Lawgeex | AI contract review | Enterprise legal | Not found; reviewers call it high cost | AI needs improvement relative to cost; limited collaboration features | [G2](https://www.g2.com/products/lawgeex/reviews) |
| Harvey | General legal AI platform | AmLaw 100 firms, Fortune 500 in-house | Not public; reported $1,200-$2,000+/seat/mo, commonly 25-seat minimum, 12-month term (~$360k/yr) (vendor-authored) | Price; aggressive sales and non-transparent pricing; incorrect citations | [Vaquill review](https://www.vaquill.ai/blog/harvey-ai-review-honest-assessment), [Vaquill pricing](https://www.vaquill.ai/blog/harvey-ai-price-increase-per-seat) (competitor-authored) |
| Ironclad | Contract lifecycle management with AI | Enterprise | Not public; aggregator claims median ~$130,000/yr | Not found | [Costbench](https://www.costbench.com/compare/harvey-ai-vs-ironclad-ai/) (aggregator, weak) |
| Robin AI | AI plus human-in-the-loop contract review | In-house teams | Not found | Company failed: missed ~$50M round, laid off about a third of staff, listed on a distressed-sale marketplace; managed-services arm sold to Scissero Dec 2025 | [Nonbillable](https://www.nonbillable.co.uk/news/robin-ai-looks-for-buyer-after-funding-plans-collapse), [Geek Law Blog via search](https://www.geeklawblog.com/2025/11/is-the-collapse-of-robin-ai-a-one-off-or-a-sign-of-a-legal-tech-ai-bubble.html) |
| ChatGPT / Claude / Gemini (paste-in baseline) | General LLM; user prompts it | Anyone | Consumer subscription or free (not researched in detail) | Inconsistent: in one vendor test of an NDA with 5 planted flaws, Claude caught 5/5, Gemini 4, GPT-4o 3, Llama 2, Mistral 1; no model questioned whether the contract fit the business context unprompted | [Talkory test](https://www.talkory.ai/blog/best-ai-for-contract-review-2026) (vendor blog, small n=1 test) |

## Per-product notes

**DoNotPay.** The FTC finalized its order on 2025-02-11 (5-0 vote). The allegation was that the company marketed itself as "the world's first robot lawyer" without testing whether output matched a human lawyer's and without retaining attorneys to test accuracy. Remedy: $193,000, notice to 2021-2023 subscribers, and a ban on equivalence-to-lawyer claims without evidence. Lesson for any consumer product: claims about legal quality are a regulated risk. Source: [FTC](https://www.ftc.gov/node/87474).

**Genie AI.** Closest low-priced SMB competitor to the Redline pitch (review, alternative clauses, Q&A) with a free tier. Capterra rating reported as 4.5 across 26 reviews (aggregator figure); complaints are mild (template gaps, UI polish). Sources: [Capterra](https://www.capterra.com/p/10003121/Genie-AI/).

**ClauseAudit.** Almost exactly the Redline concept aimed at freelancers and tenants: risk score, severity flags, plain-English text, negotiation scripts, no account needed, built on Anthropic's API. Tiny evidence base (Product Hunt comments only). The one critique, over-flagging standard clauses, is a precision issue relevant to any severity-ranking feature. Two similar tools surfaced in search without further detail: ContractClarifyAI and ClauseCatch (freelancer red flags such as unlimited revisions, IP grabs, missing late-fee clauses) via [search results](https://www.indiehackers.com/product/clausecatch). Not verified by fetch.

**ToS;DR.** Free, open-source, volunteer-driven. Limitation is coverage, not quality: it only covers services that volunteers have reviewed, and it cannot read a document you upload. Sources: [ToS;DR](https://edit.tosdr.org/about).

**Spellbook, LegalOn, Lawgeex, Legalfly, ContractCrab, Harvey, Ironclad.** Lawyer- or enterprise-targeted, sales-led, mostly non-public pricing. Complaint patterns: accuracy on jurisdiction-specific points (Legalfly), cost versus AI quality (Lawgeex), opaque pricing (Spellbook, Harvey), hallucinated citations (Harvey, Spellbook). Many are unreachable for an individual signing a lease or freelance agreement.

**Robin AI.** Not a complaint about product accuracy; it is a business-viability signal. Raised about $69M total, then failed to close a $50M round. The Nonbillable article does not state a cause, and I did not retrieve the Geek Law Blog analysis (403), so do not infer that general LLMs killed it.

## Observed gaps (evidence-supported only)
1. **Price and access gap at the individual end.** The reviewed enterprise tools are sales-led with non-public pricing (Spellbook, Harvey, Ironclad); the only low-cost products found are Genie AI and small indie tools like ClauseAudit. Evidence: sources above.
2. **Trust and claims risk.** The FTC action shows regulators punish "replaces a lawyer" positioning and untested legal output. Evidence: [FTC](https://www.ftc.gov/node/87474).
3. **Accuracy and calibration complaints are the recurring theme.** Legalfly (wrong jurisdiction or outdated legislation), Spellbook (hallucination), ClauseAudit (over-flagging), Harvey (bad citations). A source-sentence-grounded design speaks directly to this, but that is my inference; no source says users want it.
4. **Baseline LLM is inconsistent but capable.** In the single vendor test, outcomes varied widely by model and none flagged context mismatch unprompted. This suggests the paste-in baseline is a real substitute, so Redline needs a differentiator beyond summarizing. Weak evidence (n=1, vendor blog).
5. **The concept is already shipped.** ClauseAudit, ContractClarifyAI and ClauseCatch offer risk ranking, plain English and negotiation language for freelancers. The hypothesis is not novel in features.

## What I could not find
- Any pricing for DoNotPay, Legalfly, ContractCrab, Lawgeex, LegalOn, or Robin AI.
- Verified official pricing for Spellbook, Harvey and Ironclad (only third-party estimates).
- Direct Reddit, HN or Trustpilot threads. Searches surfaced a Trustpilot page and Reddit snapshot but I did not read them, so I make no claims from them.
- Evisort-specific complaints; Evisort was not covered.
- Consumer-side complaints about DoNotPay beyond the FTC finding.
- Any user-count, retention or paid-conversion data for the freelancer/consumer tools.
- Whether people actually pay for consumer-grade contract review; not researched here.
