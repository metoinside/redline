import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentText } from "@/app/(app)/documents/document-text";
import { DocumentView } from "@/app/(app)/documents/document-view";
import { loadFixture } from "../fixtures/index";

// The document view must show the stored text exactly, so the buyer sees what
// Redline read and later tickets can highlight a citation by its offsets.

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

function docTextOf(html: string): string {
  const match = html.match(/<div class="doc-text">([\s\S]*)<\/div>/);
  if (!match) throw new Error("no document text in the page");
  return decode(match[1]);
}

const { text: contract, sidecar } = loadFixture("adhesion-contract");

describe("the document text", () => {
  it("renders the stored string unchanged, every line break and quote included", () => {
    const html = renderToStaticMarkup(<DocumentText text={contract} />);
    expect(docTextOf(html)).toBe(contract);
  });

  it("keeps characters a renderer could be tempted to tidy", () => {
    const text = "  Indented  line\n\n\n<b>not markup</b> & \"quotes\"\ttab\n";
    expect(docTextOf(renderToStaticMarkup(<DocumentText text={text} />))).toBe(text);
  });

  it("highlights a citation by its character offsets without changing the text", () => {
    const sentence = sidecar.clauses[0].sentence;
    const start = contract.indexOf(sentence);
    const html = renderToStaticMarkup(
      <DocumentText text={contract} marks={[{ start, end: start + sentence.length, id: "cite-1", className: "cite" }]} />,
    );
    expect(docTextOf(html)).toBe(contract);
    const marked = html.match(/<mark id="cite-1" class="cite" data-start="(\d+)" data-end="(\d+)">([^<]*)<\/mark>/);
    expect(marked).not.toBeNull();
    expect(decode(marked![3])).toBe(sentence);
    expect(Number(marked![1])).toBe(start);
  });

  it("highlights several ranges in order and leaves out overlapping or out-of-range ones", () => {
    const text = "abcdefghij";
    const html = renderToStaticMarkup(
      <DocumentText
        text={text}
        marks={[
          { start: 6, end: 8 },
          { start: 1, end: 3 },
          { start: 2, end: 5 }, // overlaps 1-3
          { start: 9, end: 40 }, // past the end
        ]}
      />,
    );
    expect(docTextOf(html)).toBe(text);
    expect([...html.matchAll(/<mark[^>]*>([^<]*)<\/mark>/g)].map((m) => m[1])).toEqual(["bc", "gh"]);
  });
});

describe("the document view", () => {
  it("shows the title, where the text came from and the text itself", () => {
    const html = renderToStaticMarkup(
      <DocumentView title="Halvard MSA" body={contract} sourceKind="pdf" addedAt="2026-10-06T09:00:00Z" />,
    );
    expect(html).toContain("Halvard MSA");
    expect(html).toContain("From a PDF");
    expect(html).toContain("6 Oct 2026");
    expect(docTextOf(html)).toBe(contract);
  });
});
