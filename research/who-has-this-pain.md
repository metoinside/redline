# Who has this pain: evidence log

## Method
- Web searches used: 10 of 12. Pages fetched: 9 of 15 (2 returned HTTP 403, 1 redirected away, so 6 pages actually read).
- Quotes below come from WebFetch output, which runs pages through a summarizing model. Quoted strings were returned as quotes, but I did not see raw page HTML. Treat them as high-likelihood verbatim, not guaranteed character-exact.
- Search engine returned almost no Reddit or Hacker News threads directly. Reddit, HN, and r/legaladvice were NOT successfully sourced (see gaps).
- 7 distinct sourced findings (target was 8; stopped because remaining queries were not yielding primary posts).

## Findings

### 1. Small business ops director, $48k SaaS auto-renewal
- Quote: "signed a SaaS contract last year for $48k/yr. company stopped using the tool 6 months ago. assumed cancellation by non-renewal."
- Also reported: vendor cites "written notice of non-renewal 90 days before term end"; poster missed the deadline by two weeks.
- Source: https://terms.law/forum/thread/saas-msa-auto-renewal-trap-2026.html
- Who: ops director (handle ops_director_v) at a company, posting on a lawyer-run forum (terms.law).
- Contract type: SaaS agreement.
- Clause: auto-renewal with 90-day written non-renewal notice.
- Consequence: invoiced the full $48,000 for another year.

### 2. Adobe Stock subscriber, early-termination penalty
- Quote: "Adobe demands a $200 plus penalty just to cancel."
- Also reported: failing to cancel within 14 days of renewal commits them to another year; they were not using the service.
- Source: https://community.adobe.com/t5/stock-discussions/prevent-auto-renewal-of-adobe-stock-annual-paid-monthly-plan/td-p/15514105
- Who: individual subscriber (handle tinyhousefever), posted Sept 20, 2025. Likely creator/consumer; occupation not stated.
- Contract type: consumer/prosumer subscription terms (annual plan paid monthly).
- Clause: early termination fee plus auto-renewal.
- Consequence: $200+ to exit, or another year-long commitment.
- Caveat: poster frames it as policy unfairness; whether they missed the clause at signup is not stated.

### 3. Employee/founder, IP assignment clause (Indie Hackers commenter)
- Quote: "Early in my career I signed a contract that assigned IP for anything I built 'during the term of employment'...Learned that lesson the hard way."
- Source: https://www.indiehackers.com/post/09948f0666 (commenter SportSignal)
- Who: employee who later built side projects.
- Contract type: employment agreement.
- Clause: broad IP assignment.
- Consequence: per the fetch summary, employer claimed ownership of weekend side projects built with personal tools. (That consequence is the summarizer's wording, not a direct quote.)

### 4. Contractor, non-compete (Indie Hackers commenters)
- Quote (ryanshrott): "The non-compete part was what really got me too...you can't work, can't build, and suddenly you're just waiting."
- Quote (Nayaab22): "If you're a contractor, your reputation IS your resume...you lose referrals, and your network goes cold. The real cost is often 12–18 months of lost momentum."
- Source: https://www.indiehackers.com/post/09948f0666
- Who: independent builders/contractors.
- Contract type: contractor/employment agreements with non-compete.
- Consequence: blocked from working during the restriction period; lost referrals and momentum. Nayaab22's line reads as general commentary, not clearly a personal incident.

### 5. Business owner, 5-year lock-in (Trustpilot, Clickplus)
- Quote: "They put a very small unreadable line in a very long contract mentioning the contract cannot be terminated before 5 years period."
- Source: https://www.trustpilot.com/review/clickplus.be (reviewer Karar Haider, Belgium, April 11, 2022)
- Who: business customer (company owner).
- Contract type: B2B service contract.
- Clause: no termination before 5 years.
- Consequence: per fetch summary, reviewer says they had to bankrupt their company to get out of the five-year payment obligation. This is the summarizer's paraphrase; the exact review wording was not returned.

### 6. Business customers, 36-month finance agreement and auto-rollover (Trustpilot, CF&L)
- Quotes (separate reviewers): "the finance agreement is all very small print and ties you in to an automatic rollover for a period that is the same length as the first one."
- "they rolled out contract over again for another 5 years" (after missing the cancellation deadline by days, per summary).
- "we have been trying to cancel our contract with them since 2022 so coming up three years...they send us huge termination charges and then resign us into a rolling contract for the next 5 years" (October 2025).
- Source: https://www.trustpilot.com/review/cfandl.co.uk
- Who: small business customers of a coffee-machine supplier (UK).
- Contract type: equipment finance/service agreement.
- Clause: auto-rollover for equal term; full servicing charges on early exit; written-only cancellation.
- Consequence: multi-year payments for unusable equipment, repeated rollover.

### 7. Consumer, undisclosed 30-day notice fee (Trustpilot, Hush)
- Quote: "The problem is that policy doesn't appear anywhere in the Terms of Use I agreed to at enrollment."
- Source: https://ie.trustpilot.com/review/gethush.ai (reviewer Sura Tsegaye, US, June 16, 2026)
- Who: individual consumer.
- Contract type: software subscription Terms of Use.
- Clause: 30-day cancellation notice policy, which the reviewer says is not in the Terms.
- Consequence: charged a prorated fee after cancelling before renewal; refund denied; disputing with card issuer.
- Note: this is a case where the terms did NOT contain the clause. A document-reading tool would not have prevented it, though it might have confirmed the absence.

## Patterns supported by findings
- Auto-renewal and notice-window clauses recur across B2B and consumer cases (findings 1, 2, 6, 7). Five-figure loss in finding 1; multi-year lock-ins in 5 and 6.
- Harm is typically discovered at exit time, not at signing (findings 1, 5, 6).
- IP assignment and non-compete clauses show up for individuals in employment/contractor roles (findings 3, 4), though these are comment-thread anecdotes.
- Reviewers explicitly describe the clause as small, unreadable, or buried (finding 5, 6), which supports "did not notice" as a real mechanism.

## Gaps / what I could not find
- No verified Reddit posts (r/legaladvice, r/freelance, r/smallbusiness, r/Tenant, r/personalfinance). Search returned none; I did not fetch reddit.com directly.
- No Hacker News threads.
- No tenant or lease-specific first-person accounts. Tenant evidence is zero.
- No freelancer-specific first-person account of a work-for-hire or payment-term loss. Only vendor/blog articles surfaced, which I excluded.
- No Upwork/Fiverr forum posts successfully read (one redirected, results were about non-circumvention generally).
- G2 thread on ZoomInfo auto-renewal and a Polycount thread returned 403; not used.
- No evidence on how many of these people would have acted differently with a summary tool, or whether they would pay for one.
- No evidence on whether these people read the contract and failed to understand it versus never read it. Mostly unknown.
- Findings skew to auto-renewal/subscription terms, not the contract/lease/freelance-agreement mix the product targets.
