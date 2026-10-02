# 3. Severity comes from exposure in the document, in two action tiers

Date: 2026-10-02. Status: Accepted.

A flag's severity is based on the buyer's exposure as the document states it, and never on how unusual the clause is. Exposure means the money committed, how long the buyer is locked in, and how hard it is to get out (notice length and termination fees). Flags fall into one of two tiers, named for what the buyer should do: **Negotiate before signing** and **Know before signing**. Within a tier, flags are ordered by money exposure. A breach of one of the buyer's red lines always goes in the top tier.

When choosing between flagging something harmless and missing something that hurts, Redline chooses to flag: every renewal-and-exit clause found becomes a flag. A clause reaches **Negotiate before signing** only if its exposure is specific (a sum, a lock-in period or a fee) and cited, or if the clause can be read two ways. Everything else goes in **Know before signing**.

## Considered options
- **Distance from market norm**, which is how lawyers rank clauses. Rejected because "unusual for the industry" is a claim the document cannot support, which breaks the rule that Redline only states what the text says.
- **A numeric risk score.** Rejected because it suggests a precision the model does not have, close to the untested quality claims the FTC fined DoNotPay for.
- **High, medium and low.** Rejected because "medium" is where uncertain flags end up, and it doesn't tell the buyer what to do.

## Consequences
- A completely standard auto-renewal clause can rank in the top tier, and a strange but harmless clause can rank low. Some lawyers will call that wrong. That ranking is intended.
- Redline never says "below market", "non-standard" or "unusual".
- Buyers do not get a score to watch fall after a negotiation, and borderline clauses must be assigned to one tier or the other.
- *Know before signing* will list benign renewal clauses, and some buyers will learn to skip it. That is the accepted cost of not missing the clause that matters.
