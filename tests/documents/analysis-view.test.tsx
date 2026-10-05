import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnalysedDocument, type AnalysisSource } from "@/app/(app)/documents/analysed-document";
import { ANALYSIS_COPY, FAILURE_COPY, TIER_LABEL, clauseNumberAt } from "@/app/(app)/documents/analysis-copy";
import { analyse } from "@/lib/engine/analyse";
import type { Analysis } from "@/lib/engine/types";
import { loadFixture } from "../fixtures/index";
import { analysisPayload, clauseById, scriptedClient } from "../support/model-payloads";

// What the buyer sees on the document view once an analysis exists: flags as
// tabs grouped by tier in ranked order, each citation marked in place in the
// text, margin comments with the statement, the cited exposure and both
// readings of an ambiguous clause, and the vendor-contracts statement.
// Rendered on the server, as the first paint of the page is.

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

const tabsOf = (html: string) =>
  [...html.matchAll(/<button[^>]*class="flag-tab flag-tab--(\w+)[^"]*"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({
    colour: m[1],
    lines: [...m[2].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((l) => decode(l[1])),
  }));
const groupsOf = (html: string) => [...html.matchAll(/<h3[^>]*class="flag-group-head"[^>]*>([^<]*)<\/h3>/g)].map((m) => decode(m[1]));
const commentOf = (html: string, sentence: string) => {
  const flag = html.match(new RegExp(`<mark[^>]*data-flag="(f\\d+)"[^>]*>${sentence.slice(0, 30).replace(/[.*+?^${}()|[\]\\$]/g, "\\$&")}`))![1];
  return decode(html.match(new RegExp(`<aside[^>]*data-flag="${flag}"[^>]*>([\\s\\S]*?)</aside>`))![1]);
};

describe("a saved document with an analysis", () => {
  it("shows every flag as a tab in its tier colour, grouped by tier in ranked order, and marks every citation in the unchanged text", async () => {
    const analysis = await savedAnalysis();
    const html = render({ kind: "saved", documentId: "d", latest: { analysis, ranAt: "2026-10-06T10:00:00Z" } });

    expect(docTextOf(html)).toBe(contract);
    expect(new Set(citesOf(html))).toEqual(new Set(sidecar.clauses.map((c) => c.sentence)));

    expect(groupsOf(html)).toEqual([TIER_LABEL.negotiate, TIER_LABEL.know]);
    const tabs = tabsOf(html);
    expect(tabs.map((t) => t.colour)).toEqual(["negotiate", "negotiate", "negotiate", "negotiate", "negotiate", "negotiate", "know"]);
    // The $48,000 renewal leads; the rest of the top tier follows in document order.
    expect(tabs[0].lines).toEqual(["Auto-renewal", "$48,000 per year", TIER_LABEL.negotiate]);
    expect(tabs.map((t) => t.lines[0])).toEqual([
      "Auto-renewal",
      "Multi-year term",
      "Rollover",
      "Notice window",
      "Rollover",
      "Early termination fee",
      "Auto-renewal",
    ]);
    expect(tabs[4].lines[1]).toBe(ANALYSIS_COPY.twoReadingsShort);
    expect(tabs[6].lines).toEqual(["Auto-renewal", ANALYSIS_COPY.noExposureShort, TIER_LABEL.know]);

    expect(decode(html)).toContain(ANALYSIS_COPY.found(6, 1));
    expect(html).toContain(ANALYSIS_COPY.rerun);
  });

  it("shows the statement and only the cited exposure in each margin comment", async () => {
    const html = render({ kind: "saved", documentId: "d", latest: { analysis: await savedAnalysis(), ranAt: "2026-10-06T10:00:00Z" } });
    const c5 = clauseById(sidecar, "c5");
    const comment = commentOf(html, c5.sentence);
    expect(comment).toContain(c5.statement);
    expect(comment).toContain(`Money${c5.exposure.money}`);
    expect(comment).toContain(`Getting out${c5.exposure.exitDifficulty}`);
    expect(comment).not.toContain("Lock-in");

    const c7 = clauseById(sidecar, "c7");
    const benign = commentOf(html, c7.sentence);
    expect(benign).toContain(TIER_LABEL.know);
    expect(benign).toContain(ANALYSIS_COPY.noExposure);
    expect(benign).not.toMatch(/Money|Lock-in|Getting out/);
  });

  it("shows both readings of a clause that reads two ways", async () => {
    const html = render({ kind: "saved", documentId: "d", latest: { analysis: await savedAnalysis(), ranAt: "2026-10-06T10:00:00Z" } });
    const c6 = clauseById(sidecar, "c6");
    const comment = commentOf(html, c6.sentence);
    expect(comment).toContain(ANALYSIS_COPY.twoReadings);
    for (const reading of c6.readings!) expect(comment).toContain(reading);
    expect(comment).toContain(TIER_LABEL.negotiate);
  });

  it("has no score and no high, medium or low anywhere", async () => {
    const html = decode(render({ kind: "saved", documentId: "d", latest: { analysis: await savedAnalysis(), ranAt: "2026-10-06T10:00:00Z" } }));
    const page = html.replace(contract.trim(), "");
    expect(page).not.toMatch(/\b(high|medium|low|score|rating)\b/i);
  });

  it("no longer says Redline looks only for auto-renewal clauses", () => {
    expect(ANALYSIS_COPY.scope).not.toMatch(/only for auto-renewal/);
    for (const label of ["auto-renewals", "notice windows", "early termination fees", "rollovers", "multi-year terms"]) {
      expect(ANALYSIS_COPY.scope).toContain(label);
    }
  });

  it("asks for a re-run instead of showing an analysis saved by the first version", () => {
    const c2 = clauseById(sidecar, "c2").sentence;
    const start = contract.indexOf(c2);
    const v1 = { schemaVersion: 1, flags: [{ id: "f1", clauseType: "auto_renewal", citation: { text: c2, start, end: start + c2.length } }] };
    const html = render({ kind: "saved", documentId: "d", latest: { analysis: v1 as unknown as Analysis, ranAt: "2026-10-06T10:00:00Z" } });
    expect(decode(html)).toContain(ANALYSIS_COPY.outdated.title);
    expect(citesOf(html)).toEqual([]);
    expect(html).not.toContain("flag-tab");
  });

  it("shows nothing from a saved analysis whose wording fails the check", async () => {
    const analysis = structuredClone(await savedAnalysis());
    analysis.flags[0].statement = "This renewal is below market.";
    const html = render({ kind: "saved", documentId: "d", latest: { analysis, ranAt: "2026-10-06T10:00:00Z" } });
    expect(decode(html)).toContain(ANALYSIS_COPY.rejected.title);
    expect(decode(html)).not.toContain("below market");
    expect(citesOf(html)).toEqual([]);
  });

  it("has words for an analysis that failed the wording check twice", () => {
    expect(FAILURE_COPY["wording-failed"].body).toMatch(/didn’t show it or save it/);
  });

  it("carries the statement that Redline is tuned and checked for vendor contracts only", async () => {
    const html = render({ kind: "saved", documentId: "d", latest: { analysis: await savedAnalysis(), ranAt: "2026-10-06T10:00:00Z" } });
    expect(decode(html)).toContain(decode(ANALYSIS_COPY.vendorOnly));
    expect(ANALYSIS_COPY.vendorOnly).toMatch(/vendor, SaaS and service contracts only/);
    expect(ANALYSIS_COPY.vendorOnly).toMatch(/nobody has checked/);
  });

  it("says plainly when no renewal or exit clause was found", async () => {
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
    expect(citesOf(html)).toHaveLength(analysis.flags.length - 1);
    expect(citesOf(html)).not.toContain(analysis.flags[0].citation.text);
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
