import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnalysedDocument, type AnalysisSource } from "@/app/(app)/documents/analysed-document";
import { ANALYSIS_COPY, clauseNumberAt } from "@/app/(app)/documents/analysis-copy";
import { analyse } from "@/lib/engine/analyse";
import type { Analysis } from "@/lib/engine/types";
import { loadFixture } from "../fixtures/index";
import { analysisPayload, scriptedClient } from "../support/model-payloads";

// What the buyer sees on the document view once an analysis exists: flags as
// tabs, each citation marked in place in the text, and the vendor-contracts
// statement. Rendered on the server, as the first paint of the page is.

const { text: contract, sidecar } = loadFixture("adhesion-contract");

function decode(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

const docTextOf = (html: string) => decode(html.match(/<div class="doc-text">([\s\S]*?)<\/div>/)![1]);
const citesOf = (html: string) => [...html.matchAll(/<mark[^>]*class="cite[^"]*"[^>]*>([^<]*)<\/mark>/g)].map((m) => decode(m[1]));

async function savedAnalysis(payload = analysisPayload(sidecar)): Promise<Analysis> {
  return (await analyse({ text: contract, redLines: [], client: scriptedClient(payload) })).analysis;
}

function render(source: AnalysisSource, modelConfigured = true, body = contract) {
  return renderToStaticMarkup(
    <AnalysedDocument
      title="Halvard MSA"
      body={body}
      sourceKind="pdf"
      addedAt="2026-10-06T09:00:00Z"
      source={source}
      modelConfigured={modelConfigured}
    />,
  );
}

describe("a saved document with an analysis", () => {
  it("shows each auto-renewal flag as a tab and marks its citation in the unchanged text", async () => {
    const analysis = await savedAnalysis();
    const html = render({ kind: "saved", documentId: "d", latest: { analysis, ranAt: "2026-10-06T10:00:00Z" } });

    expect(docTextOf(html)).toBe(contract);
    const autoRenewals = sidecar.clauses.filter((c) => c.clauseType === "auto_renewal").map((c) => c.sentence);
    expect(citesOf(html)).toEqual(autoRenewals);

    const tabs = [...html.matchAll(/<button[^>]*class="flag-tab[^"]*"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => decode(m[1]));
    expect(tabs).toEqual(["Auto-renewalClause 4.2", "Auto-renewalClause 4.7"]);
    expect(html).toContain(ANALYSIS_COPY.found(2));
    expect(html).toContain(ANALYSIS_COPY.rerun);
  });

  it("carries the statement that Redline is tuned and checked for vendor contracts only", async () => {
    const html = render({ kind: "saved", documentId: "d", latest: { analysis: await savedAnalysis(), ranAt: "2026-10-06T10:00:00Z" } });
    expect(decode(html)).toContain(decode(ANALYSIS_COPY.vendorOnly));
    expect(ANALYSIS_COPY.vendorOnly).toMatch(/vendor, SaaS and service contracts only/);
    expect(ANALYSIS_COPY.vendorOnly).toMatch(/nobody has checked/);
  });

  it("says plainly when no auto-renewal clause was found", async () => {
    const analysis = await savedAnalysis({ clauses: [] });
    const html = render({ kind: "saved", documentId: "d", latest: { analysis, ranAt: "2026-10-06T10:00:00Z" } });
    expect(decode(html)).toContain(ANALYSIS_COPY.empty);
    expect(ANALYSIS_COPY.empty).toMatch(/^We found no/);
    expect(citesOf(html)).toEqual([]);
    expect(html).not.toContain("flag-tab");
  });

  it("never shows a saved flag whose citation does not match the text at its offsets", async () => {
    const analysis = await savedAnalysis();
    const tampered = structuredClone(analysis);
    tampered.flags[0].citation.start += 2;
    const html = render({ kind: "saved", documentId: "d", latest: { analysis: tampered, ranAt: "2026-10-06T10:00:00Z" } });
    expect(citesOf(html)).toEqual([analysis.flags[1].citation.text]);
    expect(docTextOf(html)).toBe(contract);
  });
});

describe("before any analysis", () => {
  it("offers to run one, with the vendor-contracts statement", () => {
    const html = render({ kind: "saved", documentId: "d", latest: null });
    expect(html).toContain(ANALYSIS_COPY.run);
    expect(decode(html)).toContain(ANALYSIS_COPY.notRun);
    expect(decode(html)).toContain(decode(ANALYSIS_COPY.vendorOnly));
    expect(docTextOf(html)).toBe(contract);
  });

  it("says analysis isn't set up, with no control to run it, when the model isn't configured", () => {
    const html = render({ kind: "browser" }, false);
    expect(decode(html)).toContain(ANALYSIS_COPY.modelOff.title);
    expect(html).not.toContain(ANALYSIS_COPY.run);
    expect(decode(html)).toContain(decode(ANALYSIS_COPY.vendorOnly));
  });
});

describe("clauseNumberAt", () => {
  it("reads the clause number at the start of the citation's line", () => {
    const c2 = sidecar.clauses.find((c) => c.id === "c2")!.sentence;
    expect(clauseNumberAt(contract, contract.indexOf(c2))).toBe("4.2");
    expect(clauseNumberAt(contract, 0)).toBeNull();
    expect(clauseNumberAt("Preamble text here.\n", 9)).toBeNull();
  });
});
