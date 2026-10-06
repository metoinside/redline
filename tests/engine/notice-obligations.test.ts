import { describe, expect, it } from "vitest";
import { analyse } from "@/lib/engine/analyse";
import { ModelOutputError } from "@/lib/engine/model";
import { WordingDefectsError } from "@/lib/engine/wording";
import { loadFixture } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import { analysisPayload, changeWord, noticeObligationItem, scriptedClient } from "../support/model-payloads";

// Notice obligations (PRD §3 item 2, §4 check 9; ADR 0001, 0002), at the
// engine seam: each thing the buyer must do by a date or deadline, with the
// deadline as the text states it (a date, or the rule for working it out)
// and the exact sentence. The scripted client stands in for the model only;
// the citation check, the deadline check, the wording check and analyse run
// for real.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const { text: cleanText, sidecar: cleanSidecar } = loadFixture("clean-document");
const [nonRenewal, invoiceDispute] = sidecar.noticeObligations;

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

/** A sentence in the clean document that states a date. */
const installBy = "Seller shall complete installation no later than June 15, 2026.";

describe("notice obligations", () => {
  it("lists every notice obligation from the sidecar with its description, its deadline rule and its citation, in document order", async () => {
    const { analysis, diagnostics } = await run(analysisPayload(sidecar));
    expect(analysis.noticeObligations).toEqual(
      sidecar.noticeObligations.map((n, i) => ({
        id: `o${i + 1}`,
        description: n.description,
        deadline: { kind: "rule", rule: n.deadline, relativeTo: n.relativeTo },
        citation: at(contract, n.sentence),
      })),
    );
    expect(diagnostics).toMatchObject({ noticeObligationsReturned: 2, noticeObligationsDropped: [] });
  });

  it("shows a relative deadline as its rule and what it counts from, never as a worked-out date", async () => {
    const { analysis } = await run(analysisPayload(sidecar));
    const shown = analysis.noticeObligations.find((o) => o.citation.text === nonRenewal.sentence)!;
    expect(shown.deadline).toEqual({ kind: "rule", rule: "Received 90 days before the end of the then-current term", relativeTo: "the end of the then-current term" });
    expect(JSON.stringify(shown.deadline)).not.toMatch(/\b20\d\d\b|December|November|\d{1,2}\/\d{1,2}/);
  });

  it("drops an obligation whose deadline is a date the sentence doesn't state, because it was worked out, not read", async () => {
    // The first term starts March 1, 2026 and runs 36 months, so the model "helpfully" computes the date.
    const computed = { ...noticeObligationItem(nonRenewal), deadline: { kind: "date", date: "December 1, 2028", rule: null, relative_to: null } };
    const ruleWithDate = {
      ...noticeObligationItem(nonRenewal),
      deadline: { kind: "rule", date: null, rule: "By December 1, 2028 (90 days before the term ends)", relative_to: "the end of the then-current term" },
    };
    const countsFromDate = {
      ...noticeObligationItem(invoiceDispute),
      deadline: { kind: "rule", date: null, rule: "15 days after the invoice date", relative_to: "the invoice of 1 March" },
    };
    const { analysis, diagnostics } = await run(analysisPayload(sidecar, { noticeObligations: [computed, ruleWithDate, countsFromDate] }));
    expect(analysis.noticeObligations).toEqual([]);
    expect(diagnostics.noticeObligationsDropped.map((d) => d.reason)).toEqual(["date_not_in_citation", "date_not_in_citation", "date_not_in_citation"]);
  });

  it("shows a date the sentence states, in the sentence's own words", async () => {
    const stated = { sentence: installBy, description: "Check the sign is installed.", deadline: { kind: "date", date: "June 15, 2026", rule: null, relative_to: null } };
    const { analysis } = await run(analysisPayload(cleanSidecar, { noticeObligations: [stated] }), cleanText);
    expect(analysis.noticeObligations).toEqual([
      { id: "o1", description: "Check the sign is installed.", deadline: { kind: "date", date: "June 15, 2026" }, citation: at(cleanText, installBy) },
    ]);
  });

  it("drops a notice obligation whose citation is not in the document, and keeps the rest", async () => {
    const invented = {
      sentence: "Customer must give Provider written notice of any planned reduction in Authorized Users at least sixty (60) days before the renewal date.",
      description: "Tell Provider in writing before cutting seats.",
      deadline: { kind: "rule", date: null, rule: "60 days before the renewal date", relative_to: "the renewal date" },
    };
    const altered = { ...noticeObligationItem(nonRenewal), sentence: changeWord(nonRenewal.sentence, "ninety", "sixty") };
    const { analysis, diagnostics } = await run(
      analysisPayload(sidecar, { noticeObligations: [invented, altered, noticeObligationItem(invoiceDispute)] }),
    );
    expect(analysis.noticeObligations.map((o) => o.citation.text)).toEqual([invoiceDispute.sentence]);
    expect(diagnostics.noticeObligationsDropped.map((d) => [d.index, d.reason])).toEqual([
      [0, "citation_not_found"],
      [1, "citation_not_found"],
    ]);
  });

  it("drops every obligation when the model quotes the wrong document", async () => {
    const { analysis } = await run(analysisPayload({ ...sidecar, clauses: [] }), cleanText);
    expect(analysis.noticeObligations).toEqual([]);
  });

  it("drops malformed, too-short and repeated obligations", async () => {
    const good = noticeObligationItem(invoiceDispute);
    const { analysis, diagnostics } = await run(
      analysisPayload(sidecar, {
        noticeObligations: [
          null,
          { ...good, description: " " },
          { ...good, deadline: null },
          { ...good, deadline: { kind: "rule", date: null, rule: "15 days after the invoice date", relative_to: null } },
          { ...good, deadline: { kind: "date", date: null, rule: null, relative_to: null } },
          { ...good, deadline: { kind: "soon", date: null, rule: null, relative_to: null } },
          { ...good, sentence: "invoice date" },
          good,
          { ...good, description: ` ${good.description}` },
        ],
      }),
    );
    expect(analysis.noticeObligations.map((o) => o.description)).toEqual([invoiceDispute.description]);
    expect(diagnostics.noticeObligationsDropped.map((d) => d.reason)).toEqual([
      "malformed",
      "malformed",
      "malformed",
      "malformed",
      "malformed",
      "malformed",
      "quote_too_short",
      "duplicate",
    ]);
  });

  it("puts them in document order whatever order the model gives", async () => {
    const { analysis } = await run(analysisPayload(sidecar, { noticeObligations: [invoiceDispute, nonRenewal].map(noticeObligationItem) }));
    expect(analysis.noticeObligations.map((o) => [o.id, o.citation.text])).toEqual([
      ["o1", nonRenewal.sentence],
      ["o2", invoiceDispute.sentence],
    ]);
  });

  it("is not a flag and carries no reminder or schedule: only a description, a deadline and a citation", async () => {
    const { analysis } = await run(analysisPayload(sidecar));
    for (const o of analysis.noticeObligations) expect(Object.keys(o).sort()).toEqual(["citation", "deadline", "description", "id"]);
    expect(analysis.flags.map((f) => f.citation.text)).not.toContain(invoiceDispute.sentence);
    expect(JSON.stringify(analysis)).not.toMatch(/remind|schedul|calendar|\.ics/i);
  });

  it("fails the analysis when the model's answer has no notice-obligation list", async () => {
    const { notice_obligations: _n, ...rest } = analysisPayload(sidecar);
    await expect(analyse({ text: contract, redLines: [], client: scriptedClient(rest) })).rejects.toBeInstanceOf(ModelOutputError);
  });
});

describe("the wording check covers notice obligations", () => {
  const withObligation = (patch: Record<string, unknown>) =>
    analysisPayload(sidecar, { noticeObligations: [{ ...noticeObligationItem(nonRenewal), ...patch }, noticeObligationItem(invoiceDispute)] });

  it.each([
    ["the description", { description: "You might need to send notice by certified mail." }, "might"],
    ["the deadline rule", { deadline: { kind: "rule", date: null, rule: "Possibly 90 days before the term ends", relative_to: "the end of the then-current term" } }, "possibly"],
    ["what it counts from", { deadline: { kind: "rule", date: null, rule: "90 days before the term ends", relative_to: "the typical term end" } }, "typical"],
  ])("retries once when %s hedges or compares with the market", async (_label, patch, term) => {
    const { analysis, diagnostics, client } = await run([withObligation(patch), analysisPayload(sidecar)]);
    expect(client.requests).toHaveLength(2);
    expect(diagnostics.wording.map((a) => a.defects.map((d) => d.term))).toEqual([[term], []]);
    expect(analysis.noticeObligations).toHaveLength(2);
  });

  it("fails the analysis when a defect is still there after the retry", async () => {
    const bad = withObligation({ description: "You may have to send notice." });
    const client = scriptedClient(bad, bad);
    await expect(analyse({ text: contract, redLines: [], client })).rejects.toBeInstanceOf(WordingDefectsError);
    expect(client.requests).toHaveLength(2);
  });

  it("does not treat a stated date in May as hedging", async () => {
    const text = `${cleanText}9.1 Buyer must confirm the final proof in writing no later than May 1, 2026.\n`;
    const sentence = "Buyer must confirm the final proof in writing no later than May 1, 2026.";
    const { analysis, client } = await run(
      analysisPayload(cleanSidecar, {
        noticeObligations: [{ sentence, description: "Confirm the final proof in writing.", deadline: { kind: "date", date: "May 1, 2026", rule: null, relative_to: null } }],
      }),
      text,
    );
    expect(client.requests).toHaveLength(1);
    expect(analysis.noticeObligations.map((o) => o.deadline)).toEqual([{ kind: "date", date: "May 1, 2026" }]);
  });
});
