import { describe, expect, it } from "vitest";
import { analyse } from "@/lib/engine/analyse";
import { ModelOutputError } from "@/lib/engine/model";
import { loadFixture } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import {
  FABRICATED_SENTENCES,
  analysisPayload,
  changeWord,
  clauseById,
  curlyQuotes,
  messySpacing,
  scriptedClient,
} from "../support/model-payloads";

// Seam 1, the analysis engine. The scripted client stands in for the model
// only; the verifier, the clause-type rule and analyse itself run for real.
// Each test checks the analysis a buyer would see.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const { text: cleanText } = loadFixture("clean-document");

const autoRenewals = sidecar.clauses.filter((c) => c.clauseType === "auto_renewal");

async function run(payload: unknown, text = contract) {
  const client = scriptedClient(payload);
  const result = await analyse({ text, redLines: [], client });
  // ADR 0001: whatever else a test checks, every citation in every result is verbatim.
  expectCitationsVerbatim(result.analysis, text);
  return { ...result, client };
}

describe("auto-renewal flags from the adhesion contract", () => {
  it("shows each auto-renewal clause as a flag citing its sentence at the right offsets", async () => {
    const { analysis } = await run(analysisPayload(sidecar));

    expect(autoRenewals.length).toBeGreaterThan(0);
    expect(analysis.flags.map((f) => f.citation.text)).toEqual(autoRenewals.map((c) => c.sentence));
    for (const flag of analysis.flags) {
      expect(flag.clauseType).toBe("auto_renewal");
      expect(flag.citation.start).toBe(contract.indexOf(flag.citation.text));
      expect(contract.slice(flag.citation.start, flag.citation.end)).toBe(flag.citation.text);
    }
    expect(new Set(analysis.flags.map((f) => f.id)).size).toBe(analysis.flags.length);
  });

  it("orders flags by where their sentence sits in the document", async () => {
    const reversed = analysisPayload(sidecar);
    reversed.clauses.reverse();
    const { analysis } = await run(reversed);
    const starts = analysis.flags.map((f) => f.citation.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("reports what the model returned, what was kept and why the rest was dropped", async () => {
    const { diagnostics } = await run(analysisPayload(sidecar));
    expect(diagnostics.returned).toBe(sidecar.clauses.length);
    expect(diagnostics.kept).toBe(autoRenewals.length);
    expect(diagnostics.dropped).toHaveLength(sidecar.clauses.length - autoRenewals.length);
    expect(diagnostics.dropped.every((d) => d.reason === "clause_type_not_in_scope")).toBe(true);
    expect(diagnostics.droppedByReason).toEqual({ clause_type_not_in_scope: sidecar.clauses.length - autoRenewals.length });
  });
});

describe("citations that fail the verbatim check are dropped", () => {
  it("drops a flag citing a sentence that is not in the document", async () => {
    const fabricated = FABRICATED_SENTENCES.auto_renewal;
    expect(contract).not.toContain(fabricated);
    const { analysis, diagnostics } = await run(
      analysisPayload(sidecar, { extra: [{ clause_type: "auto_renewal", sentence: fabricated }] }),
    );
    expect(analysis.flags.map((f) => f.citation.text)).not.toContain(fabricated);
    expect(analysis.flags).toHaveLength(autoRenewals.length);
    expect(diagnostics.dropped).toContainEqual(
      expect.objectContaining({ reason: "citation_not_found", clauseType: "auto_renewal", quote: fabricated }),
    );
  });

  it("drops a flag whose quote has one word changed", async () => {
    const c2 = clauseById(sidecar, "c2");
    const altered = changeWord(c2.sentence, "$48,000", "$45,000");
    const { analysis, diagnostics } = await run(
      analysisPayload(sidecar, { map: (item, clause) => (clause.id === "c2" ? { ...item, sentence: altered } : item) }),
    );
    expect(analysis.flags.map((f) => f.citation.text)).not.toContain(c2.sentence);
    expect(analysis.flags.map((f) => f.citation.text)).not.toContain(altered);
    expect(analysis.flags).toHaveLength(autoRenewals.length - 1);
    expect(diagnostics.dropped).toContainEqual(expect.objectContaining({ reason: "citation_not_found", quote: altered }));
  });

  it("drops a flag whose quote changes a single ordinary word", async () => {
    const c7 = clauseById(sidecar, "c7");
    const altered = changeWord(c7.sentence, "can", "may");
    const { analysis } = await run(
      analysisPayload(sidecar, { map: (item, clause) => (clause.id === "c7" ? { ...item, sentence: altered } : item) }),
    );
    expect(analysis.flags.map((f) => f.citation.text)).toEqual([clauseById(sidecar, "c2").sentence]);
  });

  it("drops a quote too short to show the buyer anything, even when it is in the document", async () => {
    expect(contract).toContain("automatically renew");
    const { analysis, diagnostics } = await run({ clauses: [{ clause_type: "auto_renewal", sentence: "automatically renew" }] });
    expect(analysis.flags).toEqual([]);
    expect(diagnostics.dropped).toEqual([expect.objectContaining({ reason: "quote_too_short" })]);
  });

  it("drops every citation when the model quotes the wrong document", async () => {
    const { analysis } = await run(analysisPayload(sidecar), cleanText);
    expect(analysis.flags).toEqual([]);
  });
});

describe("only auto-renewal clauses become flags in this version", () => {
  it("discards a family clause type other than auto-renewal, even on an auto-renewal sentence", async () => {
    const c2 = clauseById(sidecar, "c2");
    const { analysis, diagnostics } = await run({ clauses: [{ clause_type: "notice_window", sentence: c2.sentence }] });
    expect(analysis.flags).toEqual([]);
    expect(diagnostics.dropped).toEqual([expect.objectContaining({ reason: "clause_type_not_in_scope", clauseType: "notice_window" })]);
  });

  it("discards a clause type outside the renewal-and-exit family", async () => {
    const liabilityCap = sidecar.decoys[0].sentence;
    const { analysis, diagnostics } = await run({
      clauses: [
        { clause_type: "liability_cap", sentence: liabilityCap },
        { clause_type: "AUTO_RENEWAL", sentence: clauseById(sidecar, "c2").sentence },
      ],
    });
    expect(analysis.flags).toEqual([]);
    expect(diagnostics.dropped.map((d) => d.reason)).toEqual(["unknown_clause_type", "unknown_clause_type"]);
  });

  it("drops items that are not well formed and keeps the rest", async () => {
    const c2 = clauseById(sidecar, "c2");
    const { analysis, diagnostics } = await run({
      clauses: [null, "auto_renewal", { clause_type: "auto_renewal" }, { clause_type: "auto_renewal", sentence: 42 }, { clause_type: "auto_renewal", sentence: c2.sentence }],
    });
    expect(analysis.flags.map((f) => f.citation.text)).toEqual([c2.sentence]);
    expect(diagnostics.returned).toBe(5);
    expect(diagnostics.droppedByReason).toEqual({ malformed: 4 });
  });
});

describe("quotes that match after the one normalisation are kept", () => {
  it("keeps a quote with curly quotes and an apostrophe that the stored text has straight", async () => {
    // The model calls the non-renewal sentence an auto-renewal clause; the
    // engine checks the citation, not the model's reading.
    const c4 = clauseById(sidecar, "c4");
    const curly = curlyQuotes(c4.sentence);
    expect(curly).not.toBe(c4.sentence);
    const { analysis } = await run({ clauses: [{ clause_type: "auto_renewal", sentence: curly }] });
    expect(analysis.flags.map((f) => f.citation.text)).toEqual([c4.sentence]);
  });

  it("keeps a quote with extra spaces, tabs and no-break spaces", async () => {
    const c2 = clauseById(sidecar, "c2");
    const messy = messySpacing(c2.sentence);
    expect(contract).not.toContain(messy);
    const { analysis } = await run({ clauses: [{ clause_type: "auto_renewal", sentence: messy }] });
    expect(analysis.flags).toHaveLength(1);
    expect(analysis.flags[0].citation).toEqual({
      text: c2.sentence,
      start: contract.indexOf(c2.sentence),
      end: contract.indexOf(c2.sentence) + c2.sentence.length,
    });
  });

  it("shows one flag when the model returns the same clause twice", async () => {
    const c2 = clauseById(sidecar, "c2");
    const { analysis, diagnostics } = await run({
      clauses: [
        { clause_type: "auto_renewal", sentence: c2.sentence },
        { clause_type: "auto_renewal", sentence: curlyQuotes(c2.sentence) },
      ],
    });
    expect(analysis.flags).toHaveLength(1);
    expect(diagnostics.dropped).toEqual([expect.objectContaining({ reason: "duplicate" })]);
  });
});

describe("a document with nothing to flag", () => {
  it("returns no flags for the clean document", async () => {
    const { analysis, diagnostics } = await run({ clauses: [] }, cleanText);
    expect(analysis.flags).toEqual([]);
    expect(diagnostics).toEqual({ returned: 0, kept: 0, dropped: [], droppedByReason: {} });
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
