import { describe, expect, it } from "vitest";
import { analyse } from "@/lib/engine/analyse";
import { ModelOutputError } from "@/lib/engine/model";
import { WordingDefectsError } from "@/lib/engine/wording";
import { loadFixture } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import { analysisPayload, changeWord, curlyQuotes, messySpacing, outsideTermsItem, scriptedClient } from "../support/model-payloads";

// Outside-terms notices (ADR 0006), at the engine seam. The scripted client
// stands in for the model only; the citation check, the wording check and
// analyse run for real. Each test checks the notices a buyer would see.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const { text: cleanText } = loadFixture("clean-document");
const outside = sidecar.outsideTerms[0];

async function run(payloads: unknown | unknown[], text = contract) {
  const steps = Array.isArray(payloads) ? payloads : [payloads];
  const client = scriptedClient(...steps);
  const result = await analyse({ text, redLines: [], client });
  expectCitationsVerbatim(result.analysis, text);
  return { ...result, client };
}

describe("a sentence that brings in outside terms", () => {
  it("is shown as a notice with its citation, at the stored text's offsets, and the document to add next", async () => {
    const { analysis, diagnostics } = await run(analysisPayload(sidecar));
    expect(analysis.outsideTerms).toHaveLength(1);
    const [notice] = analysis.outsideTerms;
    const start = contract.indexOf(outside.sentence);
    expect(notice.citation).toEqual({ text: outside.sentence, start, end: start + outside.sentence.length });
    expect(notice.document).toBe(outside.document);
    expect(diagnostics).toMatchObject({ outsideTermsReturned: 1, outsideTermsDropped: [] });
  });

  it("is not a flag: it has no tier, no exposure and no counter-offer, and it is not limited to the renewal-and-exit family", async () => {
    const { analysis } = await run(analysisPayload(sidecar));
    const [notice] = analysis.outsideTerms;
    expect(Object.keys(notice).sort()).toEqual(["citation", "document", "id"]);
    // The acceptable use policy sentence is none of the five clause types, and is not a flag.
    expect(analysis.flags.map((f) => f.citation.text)).not.toContain(outside.sentence);
  });

  it("is dropped when its citation is not in the document", async () => {
    const invented = "Customer's use of the Services is subject to the Halvard Data Processing Addendum at https://www.halvardcloud.example/legal/dpa.";
    const { analysis, diagnostics } = await run(
      analysisPayload(sidecar, {
        outsideTerms: [
          { sentence: invented, document: "the Data Processing Addendum" },
          { sentence: changeWord(outside.sentence, "Acceptable", "Fair"), document: outside.document },
        ],
      }),
    );
    expect(analysis.outsideTerms).toEqual([]);
    expect(diagnostics.outsideTermsDropped.map((d) => d.reason)).toEqual(["citation_not_found", "citation_not_found"]);
  });

  it("is dropped when the model quotes the wrong document", async () => {
    const { analysis } = await run(analysisPayload({ ...sidecar, clauses: [] }), cleanText);
    expect(analysis.outsideTerms).toEqual([]);
  });

  it("keeps a quote whose quote marks or spacing differ only in ways the normalisation removes", async () => {
    const { analysis } = await run(
      analysisPayload(sidecar, { outsideTerms: [{ sentence: messySpacing(curlyQuotes(outside.sentence)), document: outside.document }] }),
    );
    expect(analysis.outsideTerms.map((n) => n.citation.text)).toEqual([outside.sentence]);
  });

  it("drops malformed, too-short and repeated items and keeps the rest", async () => {
    const { analysis, diagnostics } = await run(
      analysisPayload(sidecar, {
        outsideTerms: [
          null,
          { sentence: outside.sentence },
          { sentence: outside.sentence, document: "   " },
          { sentence: "the Halvard policy", document: outside.document },
          outsideTermsItem(outside),
          { sentence: curlyQuotes(outside.sentence), document: outside.document },
        ],
      }),
    );
    expect(analysis.outsideTerms).toHaveLength(1);
    expect(diagnostics.outsideTermsDropped.map((d) => [d.index, d.reason])).toEqual([
      [0, "malformed"],
      [1, "malformed"],
      [2, "malformed"],
      [3, "quote_too_short"],
      [5, "duplicate"],
    ]);
  });

  it("shows several notices in document order", async () => {
    const text = [
      "1. This Order is governed by the Master Terms at https://vendor.example/terms, which are incorporated by reference.",
      "",
      "2. The services are described in the Statement of Work signed by both parties.",
      "",
    ].join("\n");
    const s = (n: number) => text.split("\n\n")[n - 1].replace(/^\d\. /, "").trim();
    const { analysis } = await run(
      { clauses: [], summary: [], notice_obligations: [], outside_terms: [{ sentence: s(2), document: "the signed Statement of Work" }, { sentence: s(1), document: "the Master Terms at https://vendor.example/terms" }] },
      text,
    );
    expect(analysis.outsideTerms.map((n) => [n.id, n.document])).toEqual([
      ["n1", "the Master Terms at https://vendor.example/terms"],
      ["n2", "the signed Statement of Work"],
    ]);
  });
});

describe("the wording check covers the document description", () => {
  const hedged = analysisPayload(sidecar, { outsideTerms: [{ sentence: outside.sentence, document: "a policy that might apply" }] });

  it("asks again once, and shows the second answer when it is clean", async () => {
    const { analysis, diagnostics, client } = await run([hedged, analysisPayload(sidecar)]);
    expect(client.requests).toHaveLength(2);
    expect(client.requests[1].messages.at(-1)!.content).toContain('"might"');
    expect(analysis.outsideTerms[0].document).toBe(outside.document);
    expect(diagnostics.wording.map((w) => w.defects.length)).toEqual([1, 0]);
  });

  it("fails the analysis when the description still hedges after the retry", async () => {
    const market = analysisPayload(sidecar, { outsideTerms: [{ sentence: outside.sentence, document: "the typical acceptable use policy" }] });
    await expect(analyse({ text: contract, redLines: [], client: scriptedClient(hedged, market) })).rejects.toBeInstanceOf(WordingDefectsError);
  });

  it("never checks the cited sentence, which is the document's own words", async () => {
    const text = "1. Provider may update the Service Terms at https://vendor.example/terms from time to time, and they apply to this Order.\n";
    const sentence = text.slice(3).trim();
    const { analysis } = await run({ clauses: [], summary: [], notice_obligations: [], outside_terms: [{ sentence, document: "the Service Terms at https://vendor.example/terms" }] }, text);
    expect(analysis.outsideTerms).toHaveLength(1);
  });
});

describe("an answer with no outside-terms list", () => {
  it("is a failure, never a result that looks checked", async () => {
    const { clauses } = analysisPayload(sidecar);
    await expect(analyse({ text: contract, redLines: [], client: scriptedClient({ clauses }) })).rejects.toBeInstanceOf(ModelOutputError);
    await expect(
      analyse({ text: contract, redLines: [], client: scriptedClient({ clauses, summary: [], notice_obligations: [], outside_terms: "none" }) }),
    ).rejects.toBeInstanceOf(ModelOutputError);
  });

  it("is asked for in the same analysis call, in the strict schema", async () => {
    const { client } = await run(analysisPayload(sidecar));
    expect(client.requests).toHaveLength(1);
    const schema = client.requests[0].schema as { required: string[]; properties: Record<string, unknown> };
    expect(schema.required).toEqual(expect.arrayContaining(["clauses", "outside_terms"]));
    expect(schema.properties.outside_terms).toMatchObject({ type: "array" });
  });
});
