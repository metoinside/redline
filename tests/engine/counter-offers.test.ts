import { describe, expect, it } from "vitest";
import { CounterOfferDefectsError, analyse } from "@/lib/engine/analyse";
import { ModelOutputError } from "@/lib/engine/model";
import type { Flag, RedLine } from "@/lib/engine/types";
import { WordingDefectsError } from "@/lib/engine/wording";
import { loadFixture } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import {
  FABRICATED_SENTENCES,
  SIDECAR_COUNTER_OFFERS,
  analysisPayload,
  changeWord,
  clauseById,
  itemFor,
  outsideTermsItem,
  scriptedClient,
} from "../support/model-payloads";

// Ticket #8: a drafted counter-offer for each flag (PRD §3 item 3, §4 check
// 12; user stories 29-32). The scripted client stands in for the model only;
// the citation verifier, the wording check, the counter-offer rule and
// analyse run for real. Each test checks the analysis a buyer would see.

const { text: contract, sidecar } = loadFixture("adhesion-contract");

async function run(payloads: unknown[], redLines: RedLine[] = []) {
  const client = scriptedClient(...payloads);
  const result = await analyse({ text: contract, redLines, client });
  // ADR 0001: every citation in the output, each counter-offer's included, is verbatim.
  expectCitationsVerbatim(result.analysis, contract);
  return { ...result, client };
}

const flagFor = (flags: Flag[], id: string) => {
  const flag = flags.find((f) => f.citation.text === clauseById(sidecar, id).sentence);
  if (!flag) throw new Error(`no flag for ${id}`);
  return flag;
};

/** The sidecar's answer with one clause's counter-offer replaced (or removed, with `undefined`). */
const withOffer = (id: string, counterOffer: unknown) =>
  analysisPayload(sidecar, {
    map: (item, clause) => {
      if (clause.id !== id) return item;
      const { counter_offer: _gone, ...rest } = item;
      return (counterOffer === undefined ? rest : { ...rest, counter_offer: counterOffer }) as typeof item;
    },
  });

describe("every shown flag has a counter-offer that answers its cited sentence", () => {
  it("carries a replacement and a vendor message on every flag, tied in code to the flag's own citation", async () => {
    const { analysis } = await run([analysisPayload(sidecar)]);
    expect(analysis.flags).toHaveLength(sidecar.clauses.length);
    for (const clause of sidecar.clauses) {
      const flag = flagFor(analysis.flags, clause.id);
      const offer = SIDECAR_COUNTER_OFFERS[clause.id];
      expect(flag.counterOffer, clause.id).toEqual({
        replaces: flag.citation,
        replacement: offer.replacement,
        message: offer.message,
      });
      // The edit is to this flag's sentence, at this flag's offsets, and it changes it.
      expect(contract.slice(flag.counterOffer.replaces.start, flag.counterOffer.replaces.end)).toBe(clause.sentence);
      expect(flag.counterOffer.replacement).not.toBe(clause.sentence);
    }
  });

  it("ties each counter-offer to its own sentence when one sentence is flagged as two clause types", async () => {
    const c2 = clauseById(sidecar, "c2");
    const asRollover = { replacement: "Each renewal term shall be twelve (12) months, at the Subscription Fee for the term that is ending.", message: "We're asking for 12-month renewals at the fee we pay now." };
    const { analysis } = await run([
      analysisPayload(sidecar, {
        clauseTypes: ["auto_renewal"],
        omit: ["c7"],
        extra: [itemFor("rollover", c2.sentence, { counter_offer: asRollover })],
      }),
    ]);
    expect(analysis.flags.map((f) => [f.clauseType, f.counterOffer.replacement])).toEqual([
      ["auto_renewal", SIDECAR_COUNTER_OFFERS.c2.replacement],
      ["rollover", asRollover.replacement],
    ]);
    for (const flag of analysis.flags) expect(flag.counterOffer.replaces).toEqual(flag.citation);
  });

  it("trims the counter-offer's text", async () => {
    const { analysis } = await run([withOffer("c3", { replacement: "  Each renewal term shall be twelve (12) months.\n", message: " We're asking for 12-month renewals. " })]);
    expect(flagFor(analysis.flags, "c3").counterOffer).toMatchObject({
      replacement: "Each renewal term shall be twelve (12) months.",
      message: "We're asking for 12-month renewals.",
    });
  });
});

describe("a flag dropped by the citation verifier takes its counter-offer with it", () => {
  const marker = {
    replacement: "Customer can end this Agreement at any time without paying the zebra fee.",
    message: "We're asking to drop the zebra fee.",
  };

  it("leaves no trace of the counter-offer when the quote has one figure changed", async () => {
    const c2 = clauseById(sidecar, "c2");
    const altered = changeWord(c2.sentence, "$48,000", "$45,000");
    const payload = analysisPayload(sidecar, {
      map: (item, clause) => (clause.id === "c2" ? { ...item, sentence: altered, counter_offer: marker } : item),
    });
    const { analysis, diagnostics } = await run([payload]);
    expect(analysis.flags).toHaveLength(sidecar.clauses.length - 1);
    expect(diagnostics.dropped).toContainEqual(expect.objectContaining({ reason: "citation_not_found", quote: altered }));
    const shown = JSON.stringify(analysis);
    expect(shown).not.toContain("zebra");
    expect(shown).not.toContain(marker.message);
  });

  it("leaves no trace of the counter-offer for an invented sentence, and doesn't ask again over its wording or a missing one", async () => {
    const { analysis, client } = await run([
      analysisPayload(sidecar, {
        extra: [
          itemFor("early_termination_fee", FABRICATED_SENTENCES.early_termination_fee, {
            counter_offer: { replacement: "The zebra fee might be waived.", message: "This is a non-standard fee." },
          }),
          itemFor("auto_renewal", FABRICATED_SENTENCES.auto_renewal, { counter_offer: undefined as never }),
          itemFor("liability_cap", sidecar.decoys[0].sentence, { counter_offer: marker }),
        ],
      }),
    ]);
    // Nobody sees an item that is dropped, so its wording and its counter-offer don't matter.
    expect(client.requests).toHaveLength(1);
    expect(analysis.flags).toHaveLength(sidecar.clauses.length);
    expect(JSON.stringify(analysis)).not.toContain("zebra");
  });
});

describe("counter-offer wording: no hedging and no market comparisons", () => {
  it.each([
    ["the replacement", "may", { replacement: "Customer may end this Agreement on thirty (30) days' written notice.", message: SIDECAR_COUNTER_OFFERS.c1.message }],
    ["the message", "typical", { replacement: SIDECAR_COUNTER_OFFERS.c1.replacement, message: "A 36-month lock-in isn't typical, so we're asking for 12 months." }],
    ["the message", "below market", { replacement: SIDECAR_COUNTER_OFFERS.c1.replacement, message: "We'd like a 12-month term at a below-market fee." }],
    ["the replacement", "could potentially", { replacement: "Customer could potentially end this Agreement on thirty (30) days' notice.", message: SIDECAR_COUNTER_OFFERS.c1.message }],
  ])("asks again once when %s uses %s, naming it, and shows the clean second answer", async (_where, term, offer) => {
    const { analysis, diagnostics, client } = await run([withOffer("c1", offer), analysisPayload(sidecar)]);
    expect(client.requests).toHaveLength(2);
    expect(client.requests[1].messages.at(-1)!.content).toContain(`"${term}"`);
    expect(diagnostics.wording[0].defects).toEqual([expect.objectContaining({ term })]);
    expect(diagnostics.wording[0].defects[0].field).toMatch(/counter-offer/);
    expect(diagnostics.wording[1].defects).toEqual([]);
    expect(flagFor(analysis.flags, "c1").counterOffer.replacement).toBe(SIDECAR_COUNTER_OFFERS.c1.replacement);
  });

  it("fails the analysis when the counter-offer still hedges after the retry", async () => {
    const hedged = withOffer("c4", { replacement: SIDECAR_COUNTER_OFFERS.c4.replacement, message: "Perhaps we can agree on 30 days." });
    const client = scriptedClient(hedged, hedged);
    const error = await analyse({ text: contract, redLines: [], client }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WordingDefectsError);
    expect((error as WordingDefectsError).attempts.map((a) => a.defects.map((d) => d.term))).toEqual([["perhaps"], ["perhaps"]]);
    expect(client.requests).toHaveLength(2);
  });

  it("fails the analysis when a market comparison in the replacement survives the retry", async () => {
    const compared = withOffer("c5", { replacement: "Customer shall pay the industry norm for early termination.", message: SIDECAR_COUNTER_OFFERS.c5.message });
    const error = await analyse({ text: contract, redLines: [], client: scriptedClient(compared, compared) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WordingDefectsError);
  });

  it("accepts permissions written with \"can\" and \"is entitled to\"", async () => {
    const { client } = await run([
      withOffer("c1", {
        replacement: "Customer can terminate this Agreement for convenience, and is entitled to a refund of prepaid fees for the rest of the term.",
        message: "We're asking for the right to end the agreement for convenience, with a refund of prepaid fees.",
      }),
    ]);
    expect(client.requests).toHaveLength(1);
  });
});

describe("a flag without a counter-offer is a defect, never shown", () => {
  it.each([
    ["no counter-offer", undefined],
    ["a null counter-offer", null],
    ["an empty replacement", { replacement: "   ", message: SIDECAR_COUNTER_OFFERS.c2.message }],
    ["an empty message", { replacement: SIDECAR_COUNTER_OFFERS.c2.replacement, message: "" }],
    ["a replacement that is not text", { replacement: 42, message: SIDECAR_COUNTER_OFFERS.c2.message }],
    ["a replacement that repeats the sentence unchanged", { replacement: ` ${clauseById(sidecar, "c2").sentence} `, message: SIDECAR_COUNTER_OFFERS.c2.message }],
  ])("asks again once for %s, naming the flag, and shows the second answer when it has one", async (_label, offer) => {
    const { analysis, diagnostics, client } = await run([withOffer("c2", offer), analysisPayload(sidecar)]);
    expect(client.requests).toHaveLength(2);
    const followUp = client.requests[1].messages.at(-1)!;
    expect(followUp.role).toBe("user");
    expect(followUp.content).toMatch(/counter_offer/);
    expect(followUp.content).toContain("auto_renewal");
    expect(diagnostics.counterOffers).toEqual([
      { attempt: 1, defects: [expect.objectContaining({ clauseType: "auto_renewal" })] },
      { attempt: 2, defects: [] },
    ]);
    expect(analysis.flags).toHaveLength(sidecar.clauses.length);
    expect(flagFor(analysis.flags, "c2").counterOffer.replacement).toBe(SIDECAR_COUNTER_OFFERS.c2.replacement);
  });

  it("fails the analysis when a flag still has no counter-offer after the retry, rather than show it without one", async () => {
    const missing = withOffer("c5", undefined);
    const client = scriptedClient(missing, missing);
    const error = await analyse({ text: contract, redLines: [], client }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CounterOfferDefectsError);
    // A bad answer from the model: the server reports it as a failed analysis, and nothing is saved.
    expect(error).toBeInstanceOf(ModelOutputError);
    const attempts = (error as CounterOfferDefectsError).attempts;
    expect(attempts.map((a) => a.defects.map((d) => [d.clauseType, d.problem]))).toEqual([
      [["early_termination_fee", "missing"]],
      [["early_termination_fee", "missing"]],
    ]);
    expect(client.requests).toHaveLength(2);
  });

  it("names both problems in one retry when an answer has a missing counter-offer and hedged wording", async () => {
    const both = analysisPayload(sidecar, {
      map: (item, clause) => {
        if (clause.id === "c3") return { ...item, counter_offer: null as never };
        if (clause.id === "c7") return { ...item, counter_offer: { ...item.counter_offer, message: "We might want this." } };
        return item;
      },
    });
    const { client } = await run([both, analysisPayload(sidecar)]);
    expect(client.requests).toHaveLength(2);
    const followUp = client.requests[1].messages.at(-1)!.content;
    expect(followUp).toContain('"might"');
    expect(followUp).toContain("rollover");
  });

  it("reports hedging as the reason when both problems survive the retry", async () => {
    const both = analysisPayload(sidecar, {
      map: (item, clause) => {
        if (clause.id === "c3") return { ...item, counter_offer: null as never };
        if (clause.id === "c7") return { ...item, counter_offer: { ...item.counter_offer, message: "We might want this." } };
        return item;
      },
    });
    const error = await analyse({ text: contract, redLines: [], client: scriptedClient(both, both) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WordingDefectsError);
  });
});

describe("outside-terms notices never carry a counter-offer", () => {
  it("shows a notice with no counter-offer, even when the model sends one for it", async () => {
    const outside = sidecar.outsideTerms[0];
    const { analysis } = await run([
      analysisPayload(sidecar, {
        outsideTerms: [{ ...outsideTermsItem(outside), counter_offer: { replacement: "The zebra policy does not apply.", message: "Please drop the zebra policy." } }],
      }),
    ]);
    expect(analysis.outsideTerms).toHaveLength(1);
    const [notice] = analysis.outsideTerms;
    expect(Object.keys(notice).sort()).toEqual(["citation", "document", "id"]);
    expect(JSON.stringify(analysis)).not.toContain("zebra");
  });

  it("has no counter-offer on any notice in a full analysis, while every flag has one", async () => {
    const { analysis } = await run([analysisPayload(sidecar)]);
    for (const notice of analysis.outsideTerms) expect(notice).not.toHaveProperty("counterOffer");
    for (const flag of analysis.flags) expect(flag.counterOffer.message.length).toBeGreaterThan(0);
  });
});

describe("counter-offers with red lines", () => {
  it("keeps the counter-offer on a flag that crosses a red line", async () => {
    const redLines: RedLine[] = [{ clauseType: "notice_window", limit: { kind: "max_days", value: 60 } }];
    const { analysis } = await run([analysisPayload(sidecar)], redLines);
    const c4 = flagFor(analysis.flags, "c4");
    expect(c4.redLineBreaches).toHaveLength(1);
    expect(c4.counterOffer.replacement).toBe(SIDECAR_COUNTER_OFFERS.c4.replacement);
  });
});
