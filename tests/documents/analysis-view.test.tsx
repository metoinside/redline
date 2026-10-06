import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnalysedDocument, type AnalysisSource } from "@/app/(app)/documents/analysed-document";
import {
  ANALYSIS_COPY,
  CLAUSE_LABEL,
  CLEAN_COPY,
  COUNTER_OFFER_COPY,
  FAILURE_COPY,
  OBLIGATION_COPY,
  OUTSIDE_COPY,
  RED_LINE_COPY,
  SUMMARY_COPY,
  TIER_LABEL,
  clauseNumberAt,
} from "@/app/(app)/documents/analysis-copy";
import { analyse } from "@/lib/engine/analyse";
import type { Analysis, RedLine } from "@/lib/engine/types";
import { loadFixture } from "../fixtures/index";
import { SIDECAR_COUNTER_OFFERS, analysisPayload, clauseById, scriptedClient } from "../support/model-payloads";
import { CLAUSE_TYPES } from "../fixtures/index";

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

const { text: cleanText, sidecar: cleanSidecar } = loadFixture("clean-document");

async function savedAnalysis(payload: unknown = analysisPayload(sidecar), text = contract, redLines: RedLine[] = []): Promise<Analysis> {
  return (await analyse({ text, redLines, client: scriptedClient(payload) })).analysis;
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

const panelOf = (html: string) => decode(html.match(/<section class="analysis"[\s\S]*?<\/section>\s*(?=<nav|<div class="doc-body)/)![0]);

/** Claims that a clause type is not in the contract. A clean result says what Redline found, never these. */
const ABSENCE_CLAIMS =
  /there\s+(?:is|are)\s+(?:none|no)\b|there['’]s\s+no\b|does\s*n[o']t\s+(?:contain|have|include|exist)|doesn['’]t\s+(?:contain|have|include|exist)|contains\s+no\b|has\s+no\b|no\s+such\b|\b(?:absent|missing)\s+from\b|not\s+(?:present|in\s+the\s+contract)/i;

const tabsOf = (html: string) =>
  [...html.matchAll(/<button[^>]*class="flag-tab flag-tab--(\w+)[^"]*"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({
    colour: m[1],
    lines: [...m[2].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((l) => decode(l[1])),
  }));
const groupsOf = (html: string) => [...html.matchAll(/<h3[^>]*class="flag-group-head"[^>]*>([^<]*)<\/h3>/g)].map((m) => decode(m[1]));
const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const commentOf = (html: string, sentence: string) => {
  const item = html.match(new RegExp(`<mark[^>]*data-items="([fn]\\d+)[^"]*"[^>]*>${escapeHtml(sentence.slice(0, 30)).replace(/[.*+?^${}()|[\]\\$]/g, "\\$&")}`))![1];
  return decode(html.match(new RegExp(`<aside[^>]*data-item="${item}"[^>]*>([\\s\\S]*?)</aside>`))![1]);
};

describe("a saved document with an analysis", () => {
  it("shows every flag as a tab in its tier colour, grouped by tier in ranked order, and marks every citation in the unchanged text", async () => {
    // Flags only here; outside-terms notices and notice obligations have their own tests below.
    const analysis = await savedAnalysis(analysisPayload(sidecar, { outsideTerms: [], noticeObligations: [] }));
    const html = render({ kind: "saved", documentId: "d", run: { analysis, ranAt: "2026-10-06T10:00:00Z", redLines: [] } });

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
    const html = render({ kind: "saved", documentId: "d", run: { analysis: await savedAnalysis(), ranAt: "2026-10-06T10:00:00Z", redLines: [] } });
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
    const html = render({ kind: "saved", documentId: "d", run: { analysis: await savedAnalysis(), ranAt: "2026-10-06T10:00:00Z", redLines: [] } });
    const c6 = clauseById(sidecar, "c6");
    const comment = commentOf(html, c6.sentence);
    expect(comment).toContain(ANALYSIS_COPY.twoReadings);
    for (const reading of c6.readings!) expect(comment).toContain(reading);
    expect(comment).toContain(TIER_LABEL.negotiate);
  });

  it("has no score and no high, medium or low anywhere", async () => {
    const html = decode(render({ kind: "saved", documentId: "d", run: { analysis: await savedAnalysis(), ranAt: "2026-10-06T10:00:00Z", redLines: [] } }));
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
    const html = render({ kind: "saved", documentId: "d", run: { analysis: v1 as unknown as Analysis, ranAt: "2026-10-06T10:00:00Z", redLines: [] } });
    expect(decode(html)).toContain(ANALYSIS_COPY.outdated.title);
    expect(citesOf(html)).toEqual([]);
    expect(html).not.toContain("flag-tab");
  });

  it("shows nothing from a saved analysis whose wording fails the check", async () => {
    const analysis = structuredClone(await savedAnalysis());
    analysis.flags[0].statement = "This renewal is below market.";
    const html = render({ kind: "saved", documentId: "d", run: { analysis, ranAt: "2026-10-06T10:00:00Z", redLines: [] } });
    expect(decode(html)).toContain(ANALYSIS_COPY.rejected.title);
    expect(decode(html)).not.toContain("below market");
    expect(citesOf(html)).toEqual([]);
  });

  it("has words for an analysis that failed the wording check twice", () => {
    expect(FAILURE_COPY["wording-failed"].body).toMatch(/didn’t show it or save it/);
  });

  it("carries the statement that Redline is tuned and checked for vendor contracts only", async () => {
    const html = render({ kind: "saved", documentId: "d", run: { analysis: await savedAnalysis(), ranAt: "2026-10-06T10:00:00Z", redLines: [] } });
    expect(decode(html)).toContain(decode(ANALYSIS_COPY.vendorOnly));
    expect(ANALYSIS_COPY.vendorOnly).toMatch(/vendor, SaaS and service contracts only/);
    expect(ANALYSIS_COPY.vendorOnly).toMatch(/nobody has checked/);
  });

  it("shows the clean result, with every clause type as \"we found none\", when nothing was found", async () => {
    const analysis = await savedAnalysis({ clauses: [], summary: [], notice_obligations: [], outside_terms: [] }, cleanText);
    const html = render({ kind: "saved", documentId: "d", run: { analysis, ranAt: "2026-10-06T10:00:00Z", redLines: [] } }, true, cleanText);
    const panel = panelOf(html);
    expect(panel).toContain("No renewal or exit terms to negotiate");
    expect(checklistOf(html)).toEqual(CLAUSE_TYPES.map((t) => [CLAUSE_LABEL[t], "we found none"]));
    expect(citesOf(html)).toEqual([]);
    expect(html).not.toContain("flag-tab");
    // No tab colour on a clean result.
    expect(html.match(/<section class="clean-result"[\s\S]*?<\/section>/)![0]).not.toMatch(/swatch|flag-tab|tab-blue|tab-yellow/);
  });

  it("never shows a saved flag whose citation does not match the text at its offsets", async () => {
    const analysis = await savedAnalysis();
    const tampered = structuredClone(analysis);
    tampered.flags[0].citation.start += 2;
    const html = render({ kind: "saved", documentId: "d", run: { analysis: tampered, ranAt: "2026-10-06T10:00:00Z", redLines: [] } });
    const underlined = new Set([...analysis.flags.slice(1), ...analysis.outsideTerms, ...analysis.noticeObligations].map((i) => i.citation.text));
    expect(citesOf(html)).toHaveLength(underlined.size);
    expect(citesOf(html)).not.toContain(analysis.flags[0].citation.text);
    expect(docTextOf(html)).toBe(contract);
  });
});

const checklistOf = (html: string) =>
  [...html.matchAll(/<li><span class="checklist-type">([^<]*)<\/span><span class="checklist-status">([\s\S]*?)<\/span><\/li>/g)].map((m) => [
    decode(m[1]),
    decode(m[2]),
  ]);

/** A margin comment's raw markup, found by the item id on the mark over its sentence. */
const rawCommentOf = (html: string, sentence: string) => {
  const item = html.match(new RegExp(`<mark[^>]*data-items="([fn]\\d+)[^"]*"[^>]*>${escapeHtml(sentence.slice(0, 30)).replace(/[.*+?^${}()|[\]\\$]/g, "\\$&")}`))![1];
  return html.match(new RegExp(`<aside[^>]*data-item="${item}"[^>]*>([\\s\\S]*?)</aside>`))![1];
};

describe("counter-offers in each flag's margin comment", () => {
  it("shows the cited sentence struck through and the proposed wording inserted, then the message, with a control to copy it", async () => {
    const html = render({ kind: "saved", documentId: "d", run: { analysis: await savedAnalysis(), ranAt: "2026-10-06T10:00:00Z", redLines: [] } });
    for (const clause of sidecar.clauses) {
      const offer = SIDECAR_COUNTER_OFFERS[clause.id];
      const raw = rawCommentOf(html, clause.sentence);
      const del = decode(raw.match(/<del>([\s\S]*?)<\/del>/)![1]);
      const ins = decode(raw.match(/<ins>([\s\S]*?)<\/ins>/)![1]);
      // The edit answers this flag's own sentence, word for word.
      expect(del, clause.id).toBe(`${COUNTER_OFFER_COPY.now} ${clause.sentence}`);
      expect(ins, clause.id).toBe(`${COUNTER_OFFER_COPY.proposed} ${offer.replacement}`);
      const comment = decode(raw);
      expect(comment).toContain(`${COUNTER_OFFER_COPY.lead} ${COUNTER_OFFER_COPY.leadRest}`);
      expect(comment).toContain(`${COUNTER_OFFER_COPY.messageLabel}${offer.message}`);
      expect(raw).toMatch(new RegExp(`<button type="button" class="text-action">${COUNTER_OFFER_COPY.copy}</button>`));
    }
  });

  it("copies the message with the sentence as it stands and the proposed wording", () => {
    const c2 = clauseById(sidecar, "c2");
    const offer = SIDECAR_COUNTER_OFFERS.c2;
    const sent = COUNTER_OFFER_COPY.toSend(offer.message, c2.sentence, offer.replacement);
    expect(sent.startsWith(offer.message)).toBe(true);
    expect(sent).toContain(`“${c2.sentence}”`);
    expect(sent).toContain(`“${offer.replacement}”`);
    expect(sent.indexOf(c2.sentence)).toBeLessThan(sent.indexOf(offer.replacement));
  });

  it("has no counter-offer area on an outside-terms notice", async () => {
    const html = render({ kind: "saved", documentId: "d", run: { analysis: await savedAnalysis(), ranAt: "2026-10-06T10:00:00Z", redLines: [] } });
    const raw = rawCommentOf(html, sidecar.outsideTerms[0].sentence);
    expect(raw).not.toMatch(/counter-offer|<del>|<ins>|<button/);
    expect(decode(raw)).not.toContain(COUNTER_OFFER_COPY.copy);
  });

  it("has words for an analysis that came back without its counter-offers twice", () => {
    expect(FAILURE_COPY["counter-offer-failed"].body).toMatch(/didn’t show it or save it/);
  });
});

describe("outside-terms notices on the document view", () => {
  const outside = sidecar.outsideTerms[0];

  it("shows a notice as a blue tab, underlines its sentence in place, and names the document to add next in its margin comment", async () => {
    const html = render({ kind: "saved", documentId: "d", run: { analysis: await savedAnalysis(), ranAt: "2026-10-06T10:00:00Z", redLines: [] } });
    expect(citesOf(html)).toContain(outside.sentence);
    const blue = tabsOf(html).filter((t) => t.colour === "outside");
    expect(blue).toEqual([{ colour: "outside", lines: [OUTSIDE_COPY.label, outside.document, OUTSIDE_COPY.tabStatus] }]);
    expect(groupsOf(html)).toEqual([TIER_LABEL.negotiate, TIER_LABEL.know, OUTSIDE_COPY.label]);

    const comment = commentOf(html, outside.sentence);
    expect(comment).toContain(OUTSIDE_COPY.comment);
    expect(comment).toContain(`${OUTSIDE_COPY.uploadNext}${outside.document}`);
    // A notice is not a flag: no tier, no exposure, no counter-offer.
    expect(comment).not.toMatch(/Negotiate before signing|Know before signing|Money|Lock-in|Getting out|Counter-offer/);
    expect(html).toMatch(/<aside[^>]*class="comment comment--outside/);
  });

  it("says the result isn't clean because outside terms weren't read, even with only Know before signing flags", async () => {
    const payload = analysisPayload(sidecar, { omit: ["c1", "c2", "c3", "c4", "c5", "c6"] });
    const html = render({ kind: "saved", documentId: "d", run: { analysis: await savedAnalysis(payload), ranAt: "2026-10-06T10:00:00Z", redLines: [] } });
    const panel = panelOf(html);
    expect(panel).toContain(OUTSIDE_COPY.notClean(1));
    expect(OUTSIDE_COPY.notClean(1)).toMatch(/Redline hasn’t read/);
    expect(OUTSIDE_COPY.notClean(1)).toMatch(/isn’t a clean result/);
    expect(panel).not.toContain(CLEAN_COPY.heading);
    expect(html).not.toContain("clean-result");
  });

  it("shows only the notice when there are no flags at all", async () => {
    const payload = analysisPayload(sidecar, { omit: sidecar.clauses.map((c) => c.id), noticeObligations: [] });
    const html = render({ kind: "saved", documentId: "d", run: { analysis: await savedAnalysis(payload), ranAt: "2026-10-06T10:00:00Z", redLines: [] } });
    expect(tabsOf(html).map((t) => t.colour)).toEqual(["outside"]);
    expect(citesOf(html)).toEqual([outside.sentence]);
    expect(panelOf(html)).toContain(OUTSIDE_COPY.notClean(1));
    expect(panelOf(html)).not.toMatch(/\d+ flags?:|One flag:/);
  });
});

describe("the clean result", () => {
  const knowOnly = () =>
    savedAnalysis(analysisPayload(sidecar, { omit: ["c1", "c2", "c3", "c4", "c5", "c6"], outsideTerms: [] }));

  it("says there is nothing to negotiate in the PRD's words, and lists found types with a link to their sentence", async () => {
    const html = render({ kind: "saved", documentId: "d", run: { analysis: await knowOnly(), ranAt: "2026-10-06T10:00:00Z", redLines: [] } });
    expect(CLEAN_COPY.heading).toBe("No renewal or exit terms to negotiate");
    expect(CLEAN_COPY.none).toBe("we found none");
    expect(CLEAN_COPY.found).toBe("found, low exposure");

    const c7 = clauseById(sidecar, "c7");
    const number = clauseNumberAt(contract, contract.indexOf(c7.sentence))!;
    expect(checklistOf(html)).toEqual(
      CLAUSE_TYPES.map((t) => [CLAUSE_LABEL[t], t === "auto_renewal" ? `found, low exposure${ANALYSIS_COPY.clause(number)}` : "we found none"]),
    );
    // The link goes to the underlined sentence.
    const href = html.match(/<a class="checklist-cite" href="#([^"]+)"/)![1];
    expect(html).toMatch(new RegExp(`<mark id="${href}"[^>]*>${c7.sentence.slice(0, 40).replace(/[.*+?^${}()|[\]\\$]/g, "\\$&")}`));
    expect(panelOf(html)).not.toContain(ANALYSIS_COPY.found(0, 1));
  });

  it.each([
    ["nothing found in the clean document", async () => ({ analysis: await savedAnalysis({ clauses: [], summary: [], notice_obligations: [], outside_terms: [] }, cleanText), body: cleanText })],
    ["only Know before signing flags", async () => ({ analysis: await knowOnly(), body: contract })],
  ])("never claims a clause type is absent from the contract (%s)", async (_label, make) => {
    const { analysis, body } = await make();
    const html = render({ kind: "saved", documentId: "d", run: { analysis, ranAt: "2026-10-06T10:00:00Z", redLines: [] } }, true, body);
    const page = decode(html).replace(body, "");
    expect(page).toContain(CLEAN_COPY.heading);
    expect(page).not.toMatch(ABSENCE_CLAIMS);
    expect(page.toLowerCase()).not.toContain("there is none");
    // And the copy itself, whatever is rendered.
    for (const line of [
      ...Object.values(CLEAN_COPY),
      ...Object.values(SUMMARY_COPY),
      ...Object.values(OBLIGATION_COPY),
      OUTSIDE_COPY.notClean(1),
      OUTSIDE_COPY.notClean(2),
    ]) {
      expect(line).not.toMatch(ABSENCE_CLAIMS);
    }
  });

  it("finds the absence claims it guards against", () => {
    for (const claim of ["There is none.", "there is no auto-renewal", "The contract does not contain one", "It doesn't have a fee", "There are no rollovers", "does not exist"]) {
      expect(claim).toMatch(ABSENCE_CLAIMS);
    }
  });
});

describe("before any analysis", () => {
  it("offers to run one, with the vendor-contracts statement", () => {
    const html = render({ kind: "saved", documentId: "d", run: null });
    expect(html).toContain(ANALYSIS_COPY.run);
    expect(decode(html)).toContain(ANALYSIS_COPY.notRun);
    expect(decode(html)).toContain(decode(ANALYSIS_COPY.vendorOnly));
    expect(docTextOf(html)).toBe(contract);
  });

  it("says analysis isn't set up, with no control to run it, when the model isn't configured", () => {
    const html = render({ kind: "browser", accountsConfigured: true }, false);
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

describe("red lines on the document view", () => {
  const sixtyDays: RedLine = { id: "r1", clauseType: "notice_window", limit: { kind: "max_days", value: 60 } };
  const noAutoRenewal: RedLine = { id: "r2", clauseType: "auto_renewal", limit: { kind: "not_allowed" } };
  const ran = "2026-10-06T10:00:00Z";

  it("names the red line a flag crosses on its tab and in its margin comment, with the cited figure", async () => {
    const redLines = [sixtyDays];
    const analysis = await savedAnalysis(analysisPayload(sidecar), contract, redLines);
    const html = render({ kind: "saved", documentId: "d", run: { analysis, ranAt: ran, redLines } });

    const notice = tabsOf(html).find((t) => t.lines[0] === "Notice window")!;
    expect(notice).toEqual({
      colour: "negotiate",
      lines: ["Notice window", clauseById(sidecar, "c4").exposure.exitDifficulty, "Red line: No notice window longer than 60 days", TIER_LABEL.negotiate],
    });
    const comment = commentOf(html, clauseById(sidecar, "c4").sentence);
    expect(comment).toContain(`${RED_LINE_COPY.crosses}: No notice window longer than 60 days. ${RED_LINE_COPY.citedFigure} ninety (90) days.`);
    expect(html).toContain("<q>ninety (90) days</q>");
    // Only the breaching flag names a red line.
    expect(tabsOf(html).filter((t) => t.lines.some((l) => l.startsWith("Red line:")))).toHaveLength(1);
    expect(commentOf(html, clauseById(sidecar, "c1").sentence)).not.toContain(RED_LINE_COPY.crosses);
  });

  it("puts a Know before signing clause that crosses a red line among the red tabs, naming it", async () => {
    const redLines = [noAutoRenewal];
    const payload = analysisPayload(sidecar, { omit: ["c1", "c2", "c3", "c4", "c5", "c6"], outsideTerms: [] });
    const analysis = await savedAnalysis(payload, contract, redLines);
    const html = render({ kind: "saved", documentId: "d", run: { analysis, ranAt: ran, redLines } });
    expect(groupsOf(html)).toEqual([TIER_LABEL.negotiate]);
    expect(tabsOf(html)).toEqual([
      { colour: "negotiate", lines: ["Auto-renewal", ANALYSIS_COPY.noExposureShort, "Red line: No auto-renewal", TIER_LABEL.negotiate] },
    ]);
    expect(commentOf(html, clauseById(sidecar, "c7").sentence)).toContain(`${RED_LINE_COPY.crosses}: No auto-renewal.`);
    expect(panelOf(html)).not.toContain(CLEAN_COPY.heading);
  });

  it("lists the red lines the run used, and works breaches out again from that snapshot", async () => {
    const analysis = await savedAnalysis(analysisPayload(sidecar), contract, [sixtyDays, noAutoRenewal]);
    const html = render({ kind: "saved", documentId: "d", run: { analysis, ranAt: ran, redLines: [sixtyDays, noAutoRenewal] } });
    const panel = panelOf(html);
    expect(panel).toContain(`${RED_LINE_COPY.usedLabel}No notice window longer than 60 daysNo auto-renewal`);
    expect(panel).toContain(RED_LINE_COPY.rerunHint);
    expect(html).toContain('href="/red-lines"');

    // The same stored result with an empty snapshot shows no breach at all.
    const bare = render({ kind: "saved", documentId: "d", run: { analysis, ranAt: ran, redLines: [] } });
    expect(decode(bare)).not.toContain(RED_LINE_COPY.crosses);
    expect(tabsOf(bare).some((t) => t.lines.some((l) => l.startsWith("Red line:")))).toBe(false);
    expect(panelOf(bare)).toContain(RED_LINE_COPY.noneSet);
    expect(panelOf(bare)).not.toContain(RED_LINE_COPY.usedLabel);
  });

  it("says in one line that red lines need an account when the document is kept in the browser", () => {
    for (const accountsConfigured of [true, false]) {
      const panel = panelOf(render({ kind: "browser", accountsConfigured }));
      expect(panel).toContain(RED_LINE_COPY.needAccount);
      expect(panel).not.toContain(RED_LINE_COPY.usedLabel);
    }
    expect(panelOf(render({ kind: "saved", documentId: "d", run: null }))).not.toContain(RED_LINE_COPY.needAccount);
  });

  it("has words for a run that stopped because the red lines didn't load", () => {
    expect(FAILURE_COPY["red-lines-failed"].body).toMatch(/Nothing was analysed or saved/);
  });
});
