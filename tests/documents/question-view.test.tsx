import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AskedQuestion } from "@/app/(app)/documents/actions";
import { AnalysedDocument, type AnalysisSource } from "@/app/(app)/documents/analysed-document";
import { ASK_COPY } from "@/app/(app)/documents/analysis-copy";
import { ask } from "@/lib/engine/ask";
import { NOT_SAID } from "@/lib/engine/answers";
import type { Answer } from "@/lib/engine/types";
import { loadFixture, type FixtureQuestion } from "../fixtures/index";
import { answerPayload, scriptedClient } from "../support/model-payloads";

// What the buyer sees in the question box on the document view: the box and
// its promise to answer only from this document, the earlier questions of a
// saved document with their answers, each answer's sentence marked in the
// text, and "the document doesn't say" when that is the answer. Rendered on
// the server, as the first paint of the page is.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const [fee, renewal] = sidecar.questions.filter((q): q is Extract<FixtureQuestion, { answerable: true }> => q.answerable);
const unanswerable = sidecar.questions.find((q) => !q.answerable)!;

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
const marksOf = (html: string) =>
  [...html.matchAll(/<mark[^>]*class="([^"]*)"[^>]*>([^<]*)<\/mark>/g)].map((m) => ({ className: m[1], text: decode(m[2]) }));
const askBoxOf = (html: string) => html.match(/<section class="ask"[\s\S]*?<\/section>\s*(?=<div class="doc-body)/)?.[0] ?? html;
const itemsOf = (html: string) => [...askBoxOf(html).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => decode(m[1]));

async function answerTo(question: FixtureQuestion): Promise<Answer> {
  const result = await ask({ text: contract, question: question.question, client: scriptedClient(answerPayload(question)) });
  if (!result.ok) throw new Error("not ok");
  return result.answer;
}

async function saved(question: FixtureQuestion, id: string, askedAt = "2026-10-06T11:00:00Z"): Promise<AskedQuestion> {
  return { id, question: question.question, result: await answerTo(question), askedAt };
}

function render(source: AnalysisSource, modelConfigured = true) {
  return renderToStaticMarkup(
    <AnalysedDocument
      title="Halvard MSA"
      body={contract}
      sourceKind="pdf"
      addedAt="2026-10-06T09:00:00Z"
      source={source}
      modelConfigured={modelConfigured}
    />,
  );
}

describe("the question box on a saved document", () => {
  it("offers the box and says it answers only from this document", () => {
    const html = render({ kind: "saved", documentId: "d", latest: null, questions: [] });
    const box = decode(askBoxOf(html));
    expect(box).toContain(ASK_COPY.heading);
    expect(box).toContain(ASK_COPY.note);
    const input = html.match(/<input[^>]*name="question"[^>]*>/)?.[0] ?? "";
    expect(input).toMatch(/maxLength="500"/i);
    expect(box).toContain(ASK_COPY.ask);
    expect(box).not.toContain(ASK_COPY.notSaved);
  });

  it("lists earlier questions newest first, each answer with its sentence, and marks each sentence in the unchanged text", async () => {
    const questions = [await saved(renewal, "22222222-2222-4222-8222-222222222222"), await saved(fee, "11111111-1111-4111-8111-111111111111")];
    const html = render({ kind: "saved", documentId: "d", latest: null, questions });

    expect(docTextOf(html)).toBe(contract);
    const items = itemsOf(html);
    expect(items).toHaveLength(2);
    expect(items[0]).toContain(renewal.question);
    expect(items[0]).toContain(`${ASK_COPY.answerLead} ${renewal.answer}`);
    expect(items[0]).toContain(renewal.sentence);
    expect(items[1]).toContain(fee.question);
    expect(items[1]).toContain(fee.answer);

    const marked = marksOf(html).map((m) => m.text);
    expect(marked).toEqual(expect.arrayContaining([fee.sentence, renewal.sentence]));
    // Each answer links to its mark in the text.
    const links = [...askBoxOf(html).matchAll(/<a class="sentence-link" href="#([^"]+)"/g)].map((m) => m[1]);
    expect(links).toHaveLength(2);
    for (const id of links) expect(html).toContain(`<mark id="${id}"`);
  });

  it("shows the document doesn't say, and marks nothing, for a question the document doesn't answer", async () => {
    const html = render({ kind: "saved", documentId: "d", latest: null, questions: [await saved(unanswerable, "33333333-3333-4333-8333-333333333333")] });
    const [item] = itemsOf(html);
    expect(item).toContain(unanswerable.question);
    expect(item).toContain(`${ASK_COPY.answerLead} ${NOT_SAID}.`);
    expect(item).toContain(ASK_COPY.notSaidNote);
    expect(marksOf(html)).toEqual([]);
  });

  it("shows the document doesn't say for a saved answer whose citation no longer matches the text", async () => {
    const answer = await answerTo(fee);
    if (answer.kind !== "answered") throw new Error("not answered");
    const stale: AskedQuestion = {
      id: "44444444-4444-4444-8444-444444444444",
      question: fee.question,
      result: { ...answer, citation: { ...answer.citation, text: answer.citation.text.replace("$42,000", "$40,000") } },
      askedAt: "2026-10-06T11:00:00Z",
    };
    const html = render({ kind: "saved", documentId: "d", latest: null, questions: [stale] });
    const [item] = itemsOf(html);
    expect(item).toContain(NOT_SAID);
    expect(item).not.toContain(fee.answer);
    expect(decode(askBoxOf(html))).not.toContain("$40,000");
    expect(marksOf(html)).toEqual([]);
  });

  it("does not show a saved answer that fails the wording check", async () => {
    const answer = await answerTo(fee);
    const hedged: AskedQuestion = {
      id: "55555555-5555-4555-8555-555555555555",
      question: fee.question,
      result: { ...answer, text: "It might be $42,000 per year." } as Answer,
      askedAt: "2026-10-06T11:00:00Z",
    };
    const [item] = itemsOf(render({ kind: "saved", documentId: "d", latest: null, questions: [hedged] }));
    expect(item).toContain(ASK_COPY.rejected);
    expect(item).not.toContain("might");
  });

  it("says when the earlier questions couldn't be loaded", () => {
    expect(decode(render({ kind: "saved", documentId: "d", latest: null, questions: null }))).toContain(ASK_COPY.loadFailed);
  });

  it("says questions aren't set up, with no box, when no model is connected", () => {
    const html = render({ kind: "saved", documentId: "d", latest: null, questions: [] }, false);
    expect(decode(askBoxOf(html))).toContain(ASK_COPY.modelOff.title);
    expect(html).not.toMatch(/name="question"/);
  });
});

describe("the question box on a document kept in the browser", () => {
  it("offers the box and says questions aren't saved", () => {
    const box = decode(askBoxOf(render({ kind: "browser", accountsConfigured: false })));
    expect(box).toContain(ASK_COPY.note);
    expect(box).toContain(ASK_COPY.notSaved);
    expect(itemsOf(render({ kind: "browser", accountsConfigured: false }))).toEqual([]);
  });
});
