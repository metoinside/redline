# 4. Flags are limited to the renewal-and-exit family

Date: 2026-10-02. Status: Accepted.

In the first version, Redline raises flags only for clauses in the **renewal-and-exit family**: auto-renewal, notice windows, early termination fees, rollover and multi-year terms. Other clauses can appear in the summary but never become flags. These are the only clauses for which the research found real harm to small business buyers. A closed list is also the only way to build a labelled test set where "correct" has a meaning.

## Considered options
- **Adding the clauses lawyers care about:** liability caps, indemnity, price increases and unilateral termination. Rejected for now because no evidence was found that these harm ordinary signers.
- **Open-ended flagging** of whatever the model thinks is risky. Rejected because it cannot be tested and pushes toward over-flagging, the main complaint about existing tools.

## Consequences
- Redline says nothing about a dangerous clause outside the family, such as an uncapped indemnity.
- Next to tools that flag everything, Redline will appear to find less. The brief presents that as the design, not as a gap.
- A flag type can be added only with evidence of harm and labelled examples in the test set.
