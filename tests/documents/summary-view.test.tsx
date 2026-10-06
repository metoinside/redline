import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnalysedDocument, type AnalysisSource } from "@/app/(app)/documents/analysed-document";
import { ANALYSIS_COPY, OBLIGATION_COPY, SUMMARY_COPY, clauseNumberAt } from "@/app/(app)/documents/analysis-copy";
import { analyse } from "@/lib/engine/analyse";
import type { Analysis } from "@/lib/engine/types";
import { loadFixture } from "../fixtures/index";
import { analysisPayload, scriptedClient } from "../support/model-payloads";

// The summary and notice obligations on the document view, rendered on the
// server as the first paint is: the summary at the top of the analysis with
// each point linking to its sentence, each notice obligation as a comment in
// the margin with its deadline as the text gives it, and a short list of them
// in the panel. Nothing schedules or reminds (ADR 0002).

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const { text: cleanText, sidecar: cleanSidecar } = loadFixture("clean-document");
const ran = "2026-10-06T10:00:00Z";

function decode(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

async function savedAnalysis(payload: unknown = analysisPayload(sidecar), text = contract): Promise<Analysis> {
  return (await analyse({ text, redLines: [], client: scriptedClient(payload) })).analysis;
}

function render(analysis: Analysis, body = contract) {
  const source: AnalysisSource = { kind: "saved", documentId: "d", run: { analysis, ranAt: ran, redLines: [] } };
  return renderToStaticMarkup(
    <AnalysedDocument title="Halvard MSA" body={body} sourceKind="pdf" addedAt="2026-10-06T09:00:00Z" source={source} modelConfigured />,
  );
}

const sectionOf = (html: string, cls: string) => html.match(new RegExp(`<section class="${cls}"[\\s\\S]*?</section>`))![0];
const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\$]/g, "\\$&");
const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
/** The <mark> a panel link points at, and the text it wraps. */
const markFor = (html: string, href: string) => {
  const m = html.match(new RegExp(`<mark id="${escapeRe(href)}"[^>]*class="([^"]*)"[^>]*>([^<]*)</mark>`))!;
  return { className: m[1], text: decode(m[2]) };
};
const linksOf = (section: string) => [...section.matchAll(/<a class="sentence-link" href="#([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((m) => ({ href: m[1], label: decode(m[2]) }));

describe("the summary on the document view", () => {
  it("sits at the top of the analysis, before the flags count, with every point linking to its own sentence", async () => {
    const analysis = await savedAnalysis();
    const html = render(analysis);
    const panel = html.match(/<section class="analysis"[\s\S]*$/)![0];
    expect(panel.indexOf('class="analysis-summary"')).toBeLessThan(panel.indexOf('class="analysis-result"'));

    const summary = sectionOf(html, "analysis-summary");
    expect(decode(summary)).toContain(SUMMARY_COPY.heading);
    const links = linksOf(summary);
    expect(links).toHaveLength(analysis.summary.length);
    analysis.summary.forEach((point, i) => {
      expect(decode(summary)).toContain(point.text);
      // The link goes to the mark around exactly this point's sentence.
      expect(markFor(html, links[i].href).text).toBe(point.citation.text);
      const number = clauseNumberAt(contract, point.citation.start);
      expect(links[i].label).toBe(number ? ANALYSIS_COPY.clause(number) : SUMMARY_COPY.goTo);
    });
  });

  it("marks a sentence only the summary cites quietly, and one a flag also cites with the flag's underline", async () => {
    const analysis = await savedAnalysis();
    const html = render(analysis);
    const links = linksOf(sectionOf(html, "analysis-summary"));
    const flagged = new Set(analysis.flags.map((f) => f.citation.text));
    analysis.summary.forEach((point, i) => {
      const { className } = markFor(html, links[i].href);
      expect(className.split(" ")[0]).toBe(flagged.has(point.citation.text) || analysis.noticeObligations.some((o) => o.citation.text === point.citation.text) ? "cite" : "summary-cite");
    });
  });

  it("shows the summary for a clean result too", async () => {
    const analysis = await savedAnalysis(analysisPayload(cleanSidecar), cleanText);
    const summary = decode(sectionOf(render(analysis, cleanText), "analysis-summary"));
    for (const point of cleanSidecar.summary) expect(summary).toContain(point.point);
  });

  it("says plainly when no point could be shown", async () => {
    const analysis = await savedAnalysis(analysisPayload(sidecar, { summary: [] }));
    expect(decode(sectionOf(render(analysis), "analysis-summary"))).toContain(SUMMARY_COPY.empty);
  });
});

describe("notice obligations on the document view", () => {
  it("lists each one in the panel with its description, its deadline rule, what it counts from and a link to its sentence", async () => {
    const analysis = await savedAnalysis();
    const html = render(analysis);
    const list = sectionOf(html, "analysis-obligations");
    const text = decode(list);
    expect(text).toContain(OBLIGATION_COPY.heading);
    const links = linksOf(list);
    expect(links).toHaveLength(sidecar.noticeObligations.length);
    sidecar.noticeObligations.forEach((n, i) => {
      expect(text).toContain(n.description);
      expect(text).toContain(`${OBLIGATION_COPY.deadline} ${n.deadline}`);
      expect(text).toContain(`${OBLIGATION_COPY.countsFrom}: ${n.relativeTo}`);
      expect(markFor(html, links[i].href).text).toBe(n.sentence);
    });
  });

  it("puts each one in the margin as a comment beside its sentence, with the rule and no worked-out date", async () => {
    const html = render(await savedAnalysis());
    for (const n of sidecar.noticeObligations) {
      // The mark around the sentence names the obligation, so the comment sits level with it and a click selects it.
      const mark = html.match(new RegExp(`<mark[^>]*data-items="([^"]*)"[^>]*>${escapeRe(escapeHtml(n.sentence.slice(0, 40)))}`))!;
      const id = mark[1].split(" ").find((i) => i.startsWith("o"))!;
      const comment = decode(html.match(new RegExp(`<aside[^>]*class="comment comment--obligation[^"]*"[^>]*data-item="${id}"[^>]*>([\\s\\S]*?)</aside>`))![1]);
      expect(comment).toContain(OBLIGATION_COPY.label);
      expect(comment).toContain(n.description);
      expect(comment).toContain(`${OBLIGATION_COPY.deadline} ${n.deadline}`);
      expect(comment).toContain(`${OBLIGATION_COPY.countsFrom}: ${n.relativeTo}`);
      expect(comment).toContain(OBLIGATION_COPY.ruleNote);
      expect(comment).not.toMatch(/\b20(2[7-9]|[3-9]\d)\b|Negotiate before signing|Know before signing/);
    }
  });

  it("shows a stated date as the text writes it", async () => {
    const sentence = "Seller shall complete installation no later than June 15, 2026.";
    const analysis = await savedAnalysis(
      analysisPayload(cleanSidecar, {
        noticeObligations: [{ sentence, description: "Check the sign is installed.", deadline: { kind: "date", date: "June 15, 2026", rule: null, relative_to: null } }],
      }),
      cleanText,
    );
    const text = decode(sectionOf(render(analysis, cleanText), "analysis-obligations"));
    expect(text).toContain(`${OBLIGATION_COPY.deadline} June 15, 2026`);
    expect(text).not.toContain(OBLIGATION_COPY.countsFrom);
  });

  it("says we found none when there are none, without claiming the contract has none", async () => {
    const analysis = await savedAnalysis(analysisPayload(cleanSidecar), cleanText);
    expect(decode(sectionOf(render(analysis, cleanText), "analysis-obligations"))).toContain(OBLIGATION_COPY.empty);
    expect(OBLIGATION_COPY.empty).toMatch(/We found nothing/);
  });

  it("has no calendar, reminder or scheduling control anywhere", async () => {
    const html = render(await savedAnalysis());
    const page = decode(html).replace(contract, "");
    expect(page).not.toMatch(/add to calendar|calendar|remind me|set a reminder|schedule|\.ics/i);
    expect(html).not.toMatch(/href="[^"]*\.ics|webcal:|type="date"|type="datetime-local"/);
  });
});
