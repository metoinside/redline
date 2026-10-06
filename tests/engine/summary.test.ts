import { describe, expect, it } from "vitest";
import { analyse } from "@/lib/engine/analyse";
import { ModelOutputError } from "@/lib/engine/model";
import { WordingDefectsError } from "@/lib/engine/wording";
import { loadFixture } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import { analysisPayload, changeWord, curlyQuotes, messySpacing, scriptedClient, summaryItem } from "../support/model-payloads";

// The plain-English summary (PRD §3 item 2; ADR 0001, 0005), at the engine
// seam. The scripted client stands in for the model only; the citation
// check, the wording check and analyse run for real. Each test checks the
// summary a buyer would see.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const { text: cleanText, sidecar: cleanSidecar } = loadFixture("clean-document");

async function run(payloads: unknown | unknown[], text = contract) {
  const steps = Array.isArray(payloads) ? payloads : [payloads];
  const client = scriptedClient(...steps);
  const result = await analyse({ text, redLines: [], client });
  expectCitationsVerbatim(result.analysis, text);
  return { ...result, client };
}

const at = (text: string, sentence: string) => {
  const start = text.indexOf(sentence);
  return { text: sentence, start, end: start + sentence.length };
};

describe("the summary", () => {
  it("shows every point with its citation, at the stored text's offsets, in document order", async () => {
    const { analysis, diagnostics } = await run(analysisPayload(sidecar));
    const expected = [...sidecar.summary].sort((a, b) => contract.indexOf(a.sentence) - contract.indexOf(b.sentence));
    expect(analysis.summary).toEqual(expected.map((p, i) => ({ id: `s${i + 1}`, text: p.point, citation: at(contract, p.sentence) })));
    expect(diagnostics).toMatchObject({ summaryReturned: sidecar.summary.length, summaryDropped: [] });
  });

  it("is shown for a document with nothing to negotiate, too", async () => {
    const { analysis } = await run(analysisPayload(cleanSidecar), cleanText);
    expect(analysis.summary.map((p) => p.text)).toEqual(cleanSidecar.summary.map((p) => p.point));
    expect(analysis.outcome.clean).toBe(true);
  });

  it("covers clauses outside the renewal-and-exit family without making them flags", async () => {
    const liability = sidecar.summary.find((p) => p.sentence.startsWith("In no event shall Provider"))!;
    const { analysis } = await run(analysisPayload(sidecar));
    expect(analysis.summary.map((p) => p.citation.text)).toContain(liability.sentence);
    expect(analysis.flags.map((f) => f.citation.text)).not.toContain(liability.sentence);
    expect(analysis.flags).toHaveLength(sidecar.clauses.length);
  });

  it("drops a point whose citation is not in the document, and keeps the rest", async () => {
    const [first, second, ...rest] = sidecar.summary;
    const invented = { point: "You can leave at any time with 30 days' notice.", sentence: "Customer may terminate this Agreement at any time on thirty (30) days' written notice." };
    const altered = { ...summaryItem(second), sentence: changeWord(second.sentence, "twenty-five", "fifty") };
    const { analysis, diagnostics } = await run(
      analysisPayload(sidecar, { summary: [summaryItem(first), invented, altered, ...rest.map(summaryItem)] }),
    );
    const shown = analysis.summary.map((p) => p.text);
    expect(shown).not.toContain(invented.point);
    expect(shown).not.toContain(second.point);
    expect(shown).toHaveLength(sidecar.summary.length - 1);
    expect(diagnostics.summaryDropped.map((d) => [d.index, d.reason])).toEqual([
      [1, "citation_not_found"],
      [2, "citation_not_found"],
    ]);
  });

  it("drops every point when the model quotes the wrong document", async () => {
    const { analysis } = await run(analysisPayload({ ...sidecar, clauses: [] }), cleanText);
    expect(analysis.summary).toEqual([]);
  });

  it("keeps a quote whose quote marks or spacing differ only in ways the normalisation removes", async () => {
    const point = sidecar.summary[0];
    const { analysis } = await run(analysisPayload(sidecar, { summary: [{ point: point.point, sentence: messySpacing(curlyQuotes(point.sentence)) }] }));
    expect(analysis.summary.map((p) => p.citation)).toEqual([at(contract, point.sentence)]);
  });

  it("drops malformed, too-short and repeated points", async () => {
    const point = sidecar.summary[0];
    const { analysis, diagnostics } = await run(
      analysisPayload(sidecar, {
        summary: [
          null,
          { sentence: point.sentence },
          { point: "  ", sentence: point.sentence },
          { point: point.point, sentence: "Master Subscription" },
          summaryItem(point),
          { point: ` ${point.point} `, sentence: curlyQuotes(point.sentence) },
        ],
      }),
    );
    expect(analysis.summary.map((p) => p.text)).toEqual([point.point]);
    expect(diagnostics.summaryDropped.map((d) => d.reason)).toEqual(["malformed", "malformed", "malformed", "quote_too_short", "duplicate"]);
  });

  it("fails the analysis when the model's answer has no summary list", async () => {
    const { summary: _summary, ...rest } = analysisPayload(sidecar);
    await expect(analyse({ text: contract, redLines: [], client: scriptedClient(rest) })).rejects.toBeInstanceOf(ModelOutputError);
  });

  it("is asked for in the same analysis call, in the strict schema", async () => {
    const { client } = await run(analysisPayload(sidecar));
    expect(client.requests).toHaveLength(1);
    const schema = client.requests[0].schema as { required: string[]; properties: Record<string, unknown> };
    expect(schema.required).toEqual(expect.arrayContaining(["summary", "notice_obligations"]));
    expect(schema.properties.summary).toMatchObject({ type: "array" });
  });
});

describe("the wording check covers the summary", () => {
  const hedged = (word: string) =>
    analysisPayload(sidecar, {
      summary: sidecar.summary.map((p, i) => (i === 2 ? { point: `You ${word} not be able to leave during the first 36 months.`, sentence: p.sentence } : summaryItem(p))),
    });

  it.each([["might"], ["may"], ["could potentially"]])("retries once when a point hedges (%s), and shows the plain answer", async (word) => {
    const { analysis, diagnostics, client } = await run([hedged(word), analysisPayload(sidecar)]);
    expect(client.requests).toHaveLength(2);
    expect(diagnostics.wording.map((a) => a.defects.map((d) => d.term))).toEqual([[word], []]);
    expect(analysis.summary.map((p) => p.text)).toEqual(
      [...sidecar.summary].sort((a, b) => contract.indexOf(a.sentence) - contract.indexOf(b.sentence)).map((p) => p.point),
    );
  });

  it.each([["typical"], ["below market"], ["standard"], ["unusual"]])("retries once when a point compares with the market (%s)", async (term) => {
    const market = analysisPayload(sidecar, {
      summary: [{ point: `The 36-month term is ${term} for this kind of contract.`, sentence: sidecar.summary[2].sentence }],
    });
    const { diagnostics } = await run([market, analysisPayload(sidecar)]);
    expect(diagnostics.wording[0].defects.map((d) => d.term)).toEqual([term]);
    expect(diagnostics.wording[1].defects).toEqual([]);
  });

  it("fails the analysis when the summary still hedges after the retry, so nothing is shown", async () => {
    const client = scriptedClient(hedged("might"), hedged("may"));
    const error = await analyse({ text: contract, redLines: [], client }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WordingDefectsError);
    expect((error as WordingDefectsError).attempts.map((a) => a.defects.map((d) => d.term))).toEqual([["might"], ["may"]]);
    expect(client.requests).toHaveLength(2);
  });

  it("does not check a point that was dropped for its citation, since it is never shown", async () => {
    const { diagnostics, client } = await run(
      analysisPayload(sidecar, { summary: [{ point: "This term might be typical.", sentence: "Customer may cancel at any time for any reason whatsoever." }] }),
    );
    expect(client.requests).toHaveLength(1);
    expect(diagnostics.wording).toEqual([{ attempt: 1, defects: [] }]);
  });

  it("never checks the cited sentence, which is the document's own words", async () => {
    // 2.4 says "Provider may modify the features"; quoting it is not hedging.
    const sentence = "Provider may modify the features of the Services at any time, provided that no modification materially reduces the core inventory and ordering functions during the then-current term.";
    const { analysis, client } = await run(analysisPayload(sidecar, { summary: [{ point: "Provider can change the features of the Services at any time, as long as the core functions keep working.", sentence }] }));
    expect(client.requests).toHaveLength(1);
    expect(analysis.summary.map((p) => p.citation.text)).toEqual([sentence]);
  });
});
