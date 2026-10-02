# Redline

Redline reads a contract someone is about to sign and shows them, sentence by sentence, what in it could hurt them.

## People

**Buyer**:
A small business owner or operator who signs vendor, SaaS and service contracts without a lawyer. The user Redline is built and checked for.
_Avoid_: customer, client, user (when the segment is meant)

**Unserved reader**:
Anyone outside the buyer segment, such as tenants, terms-of-service readers or freelancers. Their documents are analysed, but the output has not been checked for them.
_Avoid_: unsupported user

## Documents

**Vendor contract**:
An agreement under which a buyer pays a supplier for a product, software or service. The only document type Redline is tuned for.
_Avoid_: agreement (alone), deal

**Notice obligation**:
Something the buyer must do by a date stated or implied in the document, such as giving written notice of non-renewal 90 days before a renewal date.
_Avoid_: reminder, alert

## Analysis

**Flag**:
A clause from the renewal-and-exit family that Redline marks as a risk to the buyer, with a tier and a citation.
_Avoid_: issue, warning, finding

**Renewal-and-exit family**:
The clause types that can become flags: auto-renewal, notice windows, early termination fees, rollover and multi-year terms.
_Avoid_: risky clauses, red-flag clauses

**Exposure**:
What a clause costs the buyer, according to the document: the money committed, how long they're locked in, and how hard it is to get out. The basis of severity.
_Avoid_: risk score, unusualness

**Tier**:
A flag's severity, named for the action it calls for: **Negotiate before signing** or **Know before signing**.
_Avoid_: high/medium/low, score, rating

**Citation**:
The exact sentence a flag or claim comes from, matching the stored document text word for word.
_Avoid_: quote, reference, source (alone)

**Clean result**:
An analysis with nothing to negotiate. It lists each renewal-and-exit clause type as found with low exposure, or as "we found none".
_Avoid_: all clear, safe, no issues

**Outside terms**:
Terms a document brings in from another document it doesn't contain, such as online terms of service or an order form.
_Avoid_: linked terms, external policy

**Outside-terms notice**:
A cited sentence showing that the document brings in outside terms Redline has not read. It is not a flag, and while one exists the result cannot be clean.
_Avoid_: warning, missing-document flag

**Red line**:
A term the buyer has said they will not accept. Their red lines are an input to every analysis.
_Avoid_: preference, rule, dealbreaker
