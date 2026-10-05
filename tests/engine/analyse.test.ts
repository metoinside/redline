import { describe, expect, it } from "vitest";
import { analyse } from "@/lib/engine/analyse";
import { ModelOutputError } from "@/lib/engine/model";
import type { Flag } from "@/lib/engine/types";
import { WordingDefectsError } from "@/lib/engine/wording";
import { normalizeText } from "@/lib/extraction/normalize";
import { CLAUSE_TYPES, loadFixture } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import {
  FABRICATED_SENTENCES,
  analysisPayload,
  changeWord,
  clauseById,
  curlyQuotes,
  itemFor,
  messySpacing,
  modelItem,
  scriptedClient,
} from "../support/model-payloads";

// Seam 1, the analysis engine. The scripted client stands in for the model
// only; the verifier, the clause-type rule, the exposure check, the tiering
// rules, the wording check and analyse itself run for real. Each test checks
// the analysis a buyer would see.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const { text: cleanText, sidecar: cleanSidecar } = loadFixture("clean-document");

async function run(payloads: unknown | unknown[], text = contract) {
  const steps = Array.isArray(payloads) ? payloads : [payloads];
  const client = scriptedClient(...steps);
  const result = await analyse({ text, redLines: [], client });
  // ADR 0001: whatever else a test checks, every citation in every result is verbatim.
  expectCitationsVerbatim(result.analysis, text);
  for (const flag of result.analysis.flags) {
    // Every exposure part shown is the document's own words, inside the flag's citation.
    for (const part of Object.values(flag.exposure)) expect(flag.citation.text).toContain(part);
  }
  return { ...result, client };
}

const flagFor = (flags: Flag[], id: string) => {
  const sentence = clauseById(sidecar, id).sentence;
  const flag = flags.find((f) => f.citation.text === sentence);
  if (!flag) throw new Error(`no flag for ${id}`);
  return flag;
};

describe("the renewal-and-exit family", () => {
  it("flags every planted clause of all five types, each citing its sentence at the right offsets", async () => {
    const { analysis } = await run(analysisPayload(sidecar));

    expect(analysis.flags).toHaveLength(sidecar.clauses.length);
    expect(new Set(analysis.flags.map((f) => f.clauseType))).toEqual(new Set(CLAUSE_TYPES));
    for (const clause of sidecar.clauses) {
      const flag = flagFor(analysis.flags, clause.id);
      expect(flag.clauseType).toBe(clause.clauseType);
      expect(flag.citation.start).toBe(contract.indexOf(clause.sentence));
      expect(flag.statement).toBe(clause.statement);
    }
    expect(new Set(analysis.flags.map((f) => f.id)).size).toBe(analysis.flags.length);
  });

  it("discards a clause type outside the family, and one written in the wrong case", async () => {
    const liabilityCap = sidecar.decoys[0].sentence;
    const { analysis, diagnostics } = await run({
      outside_terms: [],
      clauses: [itemFor("liability_cap", liabilityCap), itemFor("AUTO_RENEWAL", clauseById(sidecar, "c2").sentence)],
    });
    expect(analysis.flags).toEqual([]);
    expect(diagnostics.dropped.map((d) => d.reason)).toEqual(["unknown_clause_type", "unknown_clause_type"]);
  });

  it("drops items that are not well formed and keeps the rest", async () => {
    const c2 = clauseById(sidecar, "c2");
    const good = modelItem(c2);
    const { analysis, diagnostics } = await run({
      outside_terms: [],
      clauses: [
        null,
        "auto_renewal",
        { clause_type: "auto_renewal" },
        { ...good, sentence: 42 },
        { ...good, statement: "   " },
        { ...good, readings: [] },
        { ...good, readings: ["One.", "Two.", "Three."] },
        { ...good, readings: "one" },
        good,
      ],
    });
    expect(analysis.flags.map((f) => f.citation.text)).toEqual([c2.sentence]);
    expect(diagnostics.returned).toBe(9);
    expect(diagnostics.droppedByReason).toEqual({ malformed: 8 });
  });
});

describe("exposure shows only what the citation says", () => {
  it("shows each cited part of the exposure in the document's own words", async () => {
    const { analysis } = await run(analysisPayload(sidecar));
    for (const clause of sidecar.clauses) {
      expect(flagFor(analysis.flags, clause.id).exposure, clause.id).toEqual(clause.exposure);
    }
  });

  it("reads the money amount from the cited fragment itself", async () => {
    const { analysis } = await run(analysisPayload(sidecar));
    expect(flagFor(analysis.flags, "c2").moneyAmount).toBe(48_000);
    // A share of the remaining fees is cited money, but not a sum Redline can rank by.
    expect(flagFor(analysis.flags, "c5").moneyAmount).toBeNull();
    expect(flagFor(analysis.flags, "c1").moneyAmount).toBeNull();
  });

  it("drops an exposure fragment the model invented, and it does not lift the tier", async () => {
    const c7 = clauseById(sidecar, "c7");
    const { analysis, diagnostics } = await run({
      outside_terms: [],
      clauses: [{ ...modelItem(c7), exposure: { money: "$5,000 per year", lock_in: "twelve (12) months", exit_difficulty: null } }],
    });
    const [flag] = analysis.flags;
    expect(flag.exposure).toEqual({});
    expect(flag.moneyAmount).toBeNull();
    expect(flag.tier).toBe("know");
    expect(diagnostics.exposureDropped).toEqual([
      expect.objectContaining({ part: "money", fragment: "$5,000 per year", reason: "not_in_citation" }),
      expect.objectContaining({ part: "lockIn", fragment: "twelve (12) months", reason: "not_in_citation" }),
    ]);
  });

  it("drops a fragment that is in the document but not in this flag's sentence", async () => {
    const c7 = clauseById(sidecar, "c7");
    expect(contract).toContain("thirty-six (36) months");
    const { analysis } = await run({
      outside_terms: [],
      clauses: [{ ...modelItem(c7), exposure: { money: null, lock_in: "thirty-six (36) months", exit_difficulty: null } }],
    });
    expect(analysis.flags[0].exposure).toEqual({});
    expect(analysis.flags[0].tier).toBe("know");
  });

  it("drops a money or lock-in part with no figure in it", async () => {
    const c3 = clauseById(sidecar, "c3");
    const { analysis, diagnostics } = await run({
      outside_terms: [],
      clauses: [{ ...modelItem(c3), exposure: { money: null, lock_in: "the Initial Subscription Term", exit_difficulty: null } }],
    });
    expect(analysis.flags[0].exposure).toEqual({});
    expect(analysis.flags[0].tier).toBe("know");
    expect(diagnostics.exposureDropped).toEqual([expect.objectContaining({ part: "lockIn", reason: "no_figure" })]);
  });

  it("keeps a fragment whose quote marks or spacing differ only in ways the normalisation removes", async () => {
    const c2 = clauseById(sidecar, "c2");
    const { analysis } = await run({
      outside_terms: [],
      clauses: [{ ...modelItem(c2), exposure: { money: " $48,000  per year ", lock_in: null, exit_difficulty: null } }],
    });
    expect(analysis.flags[0].exposure).toEqual({ money: "$48,000 per year" });
    expect(analysis.flags[0].moneyAmount).toBe(48_000);
  });
});

describe("tiers are set in code from the cited exposure and the readings", () => {
  it("reproduces every expected tier in the sidecar when the model returns the sidecar's own data", async () => {
    const { analysis } = await run(analysisPayload(sidecar));
    for (const clause of sidecar.clauses) {
      expect(flagFor(analysis.flags, clause.id).tier, clause.id).toBe(clause.expectedTier);
    }
  });

  it("never puts a clause with no cited sum, period or fee and one reading in Negotiate before signing", async () => {
    // Every family sentence in the contract, reported with no exposure and one reading.
    const { analysis } = await run({
      outside_terms: [],
      clauses: sidecar.clauses.map((c) => ({
        ...modelItem(c),
        exposure: { money: null, lock_in: null, exit_difficulty: null },
        readings: [c.statement],
      })),
    });
    expect(analysis.flags).toHaveLength(sidecar.clauses.length);
    expect(analysis.flags.every((f) => f.tier === "know")).toBe(true);
  });

  it("lists a benign family clause under Know before signing instead of hiding it", async () => {
    const { analysis } = await run(analysisPayload(sidecar));
    const c7 = flagFor(analysis.flags, "c7");
    expect(c7.tier).toBe("know");
    expect(c7.readings).toEqual([clauseById(sidecar, "c7").statement]);
  });

  it("shows both readings of the ambiguous clause and puts it in Negotiate before signing", async () => {
    const c6 = clauseById(sidecar, "c6");
    const { analysis } = await run(analysisPayload(sidecar));
    const flag = flagFor(analysis.flags, "c6");
    expect(flag.readings).toEqual(c6.readings);
    expect(flag.exposure).toEqual({});
    expect(flag.tier).toBe("negotiate");
  });

  it("counts two readings that say the same thing as one", async () => {
    const c7 = clauseById(sidecar, "c7");
    const { analysis } = await run({ outside_terms: [], clauses: [{ ...modelItem(c7), readings: [c7.statement, ` ${c7.statement} `] }] });
    expect(analysis.flags[0].readings).toEqual([c7.statement]);
    expect(analysis.flags[0].tier).toBe("know");
  });
});

describe("flags are grouped by tier and ordered by money", () => {
  it("puts Negotiate before signing first, the $48,000 renewal at its head, then the rest in document order", async () => {
    const reversed = analysisPayload(sidecar);
    reversed.clauses.reverse();
    const { analysis } = await run(reversed);

    const tiers = analysis.flags.map((f) => f.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => (a === b ? 0 : a === "negotiate" ? -1 : 1)));

    const negotiate = analysis.flags.filter((f) => f.tier === "negotiate");
    expect(negotiate[0].citation.text).toBe(clauseById(sidecar, "c2").sentence);
    const rest = negotiate.slice(1).map((f) => f.citation.start);
    expect(rest).toEqual([...rest].sort((a, b) => a - b));
    expect(negotiate.slice(1).every((f) => f.moneyAmount === null)).toBe(true);
  });

  it("orders flags with a cited sum by the sum, highest first, within a tier", async () => {
    const text = normalizeText(
      [
        "1. This Agreement renews automatically each year at a fee of $12,000 per year unless Customer cancels.",
        "",
        "2. If Customer ends this Agreement early, Customer shall pay an early termination fee of $30,000.",
        "",
        "3. The Agreement has an initial term of twenty-four (24) months.",
        "",
        "4. Any renewal term shall last for USD 1.5 million worth of services or one year, whichever ends first.",
      ].join("\n"),
    );
    const s = (n: number) => text.split("\n\n")[n - 1].replace(/^\d\. /, "").trim();
    const { analysis } = await run(
      {
        outside_terms: [],
        clauses: [
          itemFor("auto_renewal", s(1), { exposure: { money: "$12,000 per year", lock_in: null, exit_difficulty: null } }),
          itemFor("multi_year_term", s(3), { exposure: { money: null, lock_in: "twenty-four (24) months", exit_difficulty: null } }),
          itemFor("early_termination_fee", s(2), { exposure: { money: "$30,000", lock_in: null, exit_difficulty: "early termination fee" } }),
          itemFor("rollover", s(4), { exposure: { money: "USD 1.5 million", lock_in: "one year", exit_difficulty: null } }),
        ],
      },
      text,
    );
    expect(analysis.flags.map((f) => f.moneyAmount)).toEqual([1_500_000, 30_000, 12_000, null]);
    expect(analysis.flags.every((f) => f.tier === "negotiate")).toBe(true);
  });
});

describe("wording: no hedging and no market comparisons in what Redline writes", () => {
  const c2 = clauseById(sidecar, "c2");
  const c6 = clauseById(sidecar, "c6");
  const hedged = (statement: string) =>
    analysisPayload(sidecar, { map: (item, clause) => (clause.id === "c2" ? { ...item, statement, readings: [statement] } : item) });

  it("asks again once, naming the defect, and shows the second answer when it is clean", async () => {
    const { analysis, diagnostics, client } = await run([
      hedged("The contract may renew on its own at a fee of at least $48,000 a year."),
      analysisPayload(sidecar),
    ]);
    expect(client.requests).toHaveLength(2);
    const followUp = client.requests[1].messages.at(-1)!;
    expect(followUp.role).toBe("user");
    expect(followUp.content).toContain('"may"');
    expect(flagFor(analysis.flags, "c2").statement).toBe(c2.statement);
    expect(diagnostics.wording).toEqual([
      { attempt: 1, defects: [expect.objectContaining({ term: "may" }), expect.objectContaining({ term: "may" })] },
      { attempt: 2, defects: [] },
    ]);
  });

  it("treats a market comparison in a reading as a defect", async () => {
    const payload = analysisPayload(sidecar, {
      map: (item, clause) => (clause.id === "c6" ? { ...item, readings: [c6.readings![0], "This is a non-standard rollover."] } : item),
    });
    const { client, diagnostics } = await run([payload, analysisPayload(sidecar)]);
    expect(client.requests).toHaveLength(2);
    expect(diagnostics.wording?.[0].defects).toEqual([expect.objectContaining({ term: "non-standard" })]);
  });

  it.each([
    ["might", "The contract MIGHT renew at $48,000 a year."],
    ["could potentially", "It could potentially renew at $48,000 a year."],
    ["possibly", "It possibly renews at $48,000 a year."],
    ["perhaps", "Perhaps it renews at $48,000 a year."],
    ["unusual", "An unusual renewal at $48,000 a year."],
    ["typical", "A typical renewal at $48,000 a year."],
    ["atypical", "An atypical renewal at $48,000 a year."],
    ["below market", "It renews at a below market $48,000 a year."],
    ["above market", "It renews at an above-market $48,000 a year."],
    ["market rate", "It renews at the market rate of $48,000 a year."],
    ["industry norm", "Renewal at $48,000 a year is the industry norm."],
    ["standard", "A standard renewal at $48,000 a year."],
  ])("fails the analysis when %s is still there after the retry", async (term, statement) => {
    const client = scriptedClient(hedged(statement), hedged(statement));
    const error = await analyse({ text: contract, redLines: [], client }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WordingDefectsError);
    const attempts = (error as WordingDefectsError).attempts;
    expect(attempts).toHaveLength(2);
    for (const attempt of attempts) expect(attempt.defects.map((d) => d.term.toLowerCase().replace("-", " "))).toContain(term);
    expect(client.requests).toHaveLength(2);
  });

  it("never checks the citation or the exposure fragments, which are the document's own words", async () => {
    // Clause 3.1 says "Customer may not terminate", and its exit-difficulty fragment carries the same words.
    const c1 = clauseById(sidecar, "c1");
    expect(c1.sentence).toMatch(/\bmay\b/);
    expect(c1.exposure.exitDifficulty).toMatch(/\bmay\b/);
    const { client, diagnostics } = await run(analysisPayload(sidecar));
    expect(client.requests).toHaveLength(1);
    expect(diagnostics.wording).toEqual([{ attempt: 1, defects: [] }]);
  });

  it("matches whole words only, and leaves the month of May alone", async () => {
    const statement = "From 1 May 2027 the contract renews at a standardised fee of at least $48,000 a year, with no mayor involved.";
    const { client, analysis } = await run(hedged(statement));
    expect(client.requests).toHaveLength(1);
    expect(flagFor(analysis.flags, "c2").statement).toBe(statement);
  });

  it("ignores wording in an item that is dropped anyway, since nobody sees it", async () => {
    const { client } = await run(
      analysisPayload(sidecar, { extra: [itemFor("auto_renewal", FABRICATED_SENTENCES.auto_renewal, { statement: "It may renew." })] }),
    );
    expect(client.requests).toHaveLength(1);
  });
});

describe("citations that fail the verbatim check are dropped", () => {
  it("drops a flag citing a sentence that is not in the document", async () => {
    const fabricated = FABRICATED_SENTENCES.early_termination_fee;
    expect(contract).not.toContain(fabricated);
    const { analysis, diagnostics } = await run(
      analysisPayload(sidecar, {
        extra: [itemFor("early_termination_fee", fabricated, { exposure: { money: "$25,000", lock_in: null, exit_difficulty: null } })],
      }),
    );
    expect(analysis.flags.map((f) => f.citation.text)).not.toContain(fabricated);
    expect(analysis.flags).toHaveLength(sidecar.clauses.length);
    expect(diagnostics.dropped).toContainEqual(
      expect.objectContaining({ reason: "citation_not_found", clauseType: "early_termination_fee", quote: fabricated }),
    );
  });

  it("drops a flag whose quote has one figure changed", async () => {
    const c2 = clauseById(sidecar, "c2");
    const altered = changeWord(c2.sentence, "$48,000", "$45,000");
    const { analysis, diagnostics } = await run(
      analysisPayload(sidecar, { map: (item, clause) => (clause.id === "c2" ? { ...item, sentence: altered } : item) }),
    );
    expect(analysis.flags.map((f) => f.citation.text)).not.toContain(c2.sentence);
    expect(analysis.flags).toHaveLength(sidecar.clauses.length - 1);
    expect(diagnostics.dropped).toContainEqual(expect.objectContaining({ reason: "citation_not_found", quote: altered }));
  });

  it("drops a quote too short to show the buyer anything, even when it is in the document", async () => {
    expect(contract).toContain("automatically renew");
    const { analysis, diagnostics } = await run({ outside_terms: [], clauses: [itemFor("auto_renewal", "automatically renew")] });
    expect(analysis.flags).toEqual([]);
    expect(diagnostics.dropped).toEqual([expect.objectContaining({ reason: "quote_too_short" })]);
  });

  it("drops every citation when the model quotes the wrong document", async () => {
    const { analysis } = await run(analysisPayload(sidecar), cleanText);
    expect(analysis.flags).toEqual([]);
  });

  it("keeps a quote with curly quotes, extra spaces and no-break spaces, at the stored text's offsets", async () => {
    const c4 = clauseById(sidecar, "c4");
    const { analysis } = await run({ outside_terms: [], clauses: [{ ...modelItem(c4), sentence: messySpacing(curlyQuotes(c4.sentence)) }] });
    const start = contract.indexOf(c4.sentence);
    expect(analysis.flags[0].citation).toEqual({ text: c4.sentence, start, end: start + c4.sentence.length });
    expect(analysis.flags[0].tier).toBe("negotiate");
  });

  it("shows one flag when the model returns the same clause twice, and two when it gives the sentence two types", async () => {
    const c2 = clauseById(sidecar, "c2");
    const { analysis, diagnostics } = await run({
      outside_terms: [],
      clauses: [modelItem(c2), { ...modelItem(c2), sentence: curlyQuotes(c2.sentence) }, { ...modelItem(c2), clause_type: "rollover" }],
    });
    expect(analysis.flags.map((f) => f.clauseType)).toEqual(["auto_renewal", "rollover"]);
    expect(diagnostics.dropped).toEqual([expect.objectContaining({ reason: "duplicate" })]);
  });
});

describe("a document with nothing to flag", () => {
  it("returns no flags for the clean document", async () => {
    const { analysis, diagnostics } = await run(analysisPayload(cleanSidecar), cleanText);
    expect(analysis.flags).toEqual([]);
    expect(diagnostics).toMatchObject({ returned: 0, kept: 0, dropped: [], droppedByReason: {}, exposureDropped: [] });
  });
});

describe("failures are failures, never an empty result", () => {
  it.each([
    ["a string", "auto_renewal"],
    ["null", null],
    ["an object without clauses", { flags: [] }],
    ["clauses that is not a list", { clauses: "none" }],
  ])("rejects a model answer that is %s", async (_label, payload) => {
    await expect(analyse({ text: contract, redLines: [], client: scriptedClient(payload) })).rejects.toBeInstanceOf(ModelOutputError);
  });

  it("passes on the client's error", async () => {
    const boom = new Error("network down");
    await expect(analyse({ text: contract, redLines: [], client: scriptedClient(boom) })).rejects.toBe(boom);
  });

  it("passes on an error from the retry", async () => {
    const boom = new Error("network down");
    const payload = analysisPayload(sidecar, {
      map: (item, clause) => (clause.id === "c7" ? { ...item, statement: "It might renew." } : item),
    });
    await expect(analyse({ text: contract, redLines: [], client: scriptedClient(payload, boom) })).rejects.toBe(boom);
  });

  it("refuses text that is not in canonical stored form, since offsets would not match the stored text", async () => {
    await expect(
      analyse({ text: contract.replace(/\n/g, "\r\n"), redLines: [], client: scriptedClient(analysisPayload(sidecar)) }),
    ).rejects.toThrow(/canonical/);
  });
});

describe("the request the engine makes", () => {
  it("makes one analysis call carrying the document text and a strict JSON schema", async () => {
    const { client } = await run(analysisPayload(sidecar));
    expect(client.requests).toHaveLength(1);
    const [request] = client.requests;
    expect(request.task).toBe("analysis");
    expect(request.messages.some((m) => m.content.includes(contract))).toBe(true);
    expect(request.schema).toMatchObject({ type: "object" });
  });
});
