import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractText, normalizeText, type ExtractionResult } from "@/lib/extraction";
import { loadFixture } from "../fixtures/index";

// Seam 2 (spec): every sample file goes through extractText exactly as the
// browser runs it, with the real pdf.js and mammoth.

const DIR = new URL("../fixtures/extraction/", import.meta.url);
const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function bytesOf(name: string): ArrayBuffer {
  const buf = readFileSync(new URL(name, DIR));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function extract(name: string, type: string): Promise<ExtractionResult> {
  return extractText({ name, type, bytes: bytesOf(name) });
}

async function textOf(name: string, type: string): Promise<string> {
  const result = await extract(name, type);
  if (!result.ok) throw new Error(`${name} was refused: ${JSON.stringify(result)}`);
  return result.text;
}

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const cited = [
  ...sidecar.clauses.map((c) => c.sentence),
  ...sidecar.noticeObligations.map((n) => n.sentence),
  ...sidecar.outsideTerms.map((o) => o.sentence),
];

describe("a text PDF", () => {
  it("yields every cited fixture sentence verbatim", async () => {
    const text = await textOf("contract.pdf", PDF);
    for (const sentence of cited) expect(text, sentence).toContain(sentence);
  });

  it("yields the contract text exactly, paragraphs included", async () => {
    expect(await textOf("contract.pdf", PDF)).toBe(contract);
  });

  it("comes back in canonical form", async () => {
    const text = await textOf("contract.pdf", PDF);
    expect(normalizeText(text)).toBe(text);
  });

  it("is read the same way by its name alone, with no type from the browser", async () => {
    expect(await textOf("contract.pdf", "")).toBe(contract);
  });
});

describe("a DOCX", () => {
  it("yields every cited fixture sentence verbatim", async () => {
    const text = await textOf("contract.docx", DOCX);
    for (const sentence of cited) expect(text, sentence).toContain(sentence);
  });

  it("yields the contract text exactly, paragraphs included", async () => {
    expect(await textOf("contract.docx", DOCX)).toBe(contract);
  });

  it("reports where the text came from", async () => {
    const result = await extract("contract.docx", DOCX);
    expect(result.ok && result.sourceKind).toBe("docx");
  });
});

describe("a scanned PDF", () => {
  it("is refused as having no extractable text", async () => {
    expect(await extract("scanned.pdf", PDF)).toEqual({ ok: false, reason: "no-text" });
  });

  it("with a text page and a picture page is refused, naming the picture page", async () => {
    expect(await extract("partly-scanned.pdf", PDF)).toEqual({ ok: false, reason: "partly-scanned", pages: [2] });
  });
});

describe("a PDF with ligatures and end-of-line hyphenation", () => {
  // The sample's own text layer, read straight from pdf.js, to show the
  // sample really holds what the tests below claim to handle.
  async function rawTextLayer(): Promise<string> {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({ data: new Uint8Array(bytesOf("ligatures-hyphenation.pdf")), verbosity: 0 });
    const doc = await task.promise;
    let raw = "";
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent({ disableNormalization: true });
      for (const item of content.items) if ("str" in item) raw += item.str + (item.hasEOL ? "\n" : "");
    }
    await task.destroy();
    return raw;
  }

  it("really contains ligature glyphs and words split across lines", async () => {
    const raw = await rawTextLayer();
    expect(raw).toMatch(/\uFB01/); // fi
    expect(raw).toMatch(/\uFB02/); // fl
    expect(raw.match(/\p{Ll}-\n\p{Ll}/gu)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it("yields plain fi and fl letters and no ligature characters", async () => {
    const text = await textOf("ligatures-hyphenation.pdf", PDF);
    expect(text).not.toMatch(/[\uFB00-\uFB06]/);
    expect(text).toContain("files");
    expect(text).toContain("certified");
    expect(text).toContain("conflict");
    expect(text).toContain("offices");
  });

  it("joins the words hyphenated at line ends", async () => {
    const text = await textOf("ligatures-hyphenation.pdf", PDF);
    expect(text).not.toMatch(/\p{Ll}-\n/u);
    for (const word of ["inventory", "employee", "begins", "continues", "confidential"]) {
      expect(text).toMatch(new RegExp(`\\b${word}\\b`));
    }
  });

  it("yields known sentences verbatim and every paragraph exactly as in the contract", async () => {
    const text = await textOf("ligatures-hyphenation.pdf", PDF);
    const noticeWindow = sidecar.clauses.find((c) => c.clauseType === "notice_window")!.sentence;
    expect(text).toContain(noticeWindow);
    const paragraphs = text.trimEnd().split("\n\n");
    expect(paragraphs.length).toBeGreaterThan(20);
    for (const paragraph of paragraphs) expect(contract, paragraph).toContain(paragraph);
  });

  it("keeps hyphens that belong to the word", async () => {
    const text = await textOf("ligatures-hyphenation.pdf", PDF);
    expect(text).toContain("thirty-six (36) months");
    expect(text).toContain("non-renewal");
    expect(text).toContain("then-current term");
  });
});

describe("stability", () => {
  it.each([
    ["contract.pdf", PDF],
    ["contract.docx", DOCX],
    ["ligatures-hyphenation.pdf", PDF],
  ])("%s gives identical text on every run", async (name, type) => {
    const bytes = bytesOf(name);
    const first = await extractText({ name, type, bytes });
    const second = await extractText({ name, type, bytes });
    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
  });
});

describe("files Redline can't read", () => {
  it("refuses a picture as an unsupported type", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).buffer;
    expect(await extractText({ name: "scan.png", type: "image/png", bytes: png })).toEqual({
      ok: false,
      reason: "unsupported-type",
      legacyWord: false,
    });
  });

  it("refuses an old Word .doc file, saying it is one", async () => {
    const doc = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]).buffer;
    expect(await extractText({ name: "contract.doc", type: "application/msword", bytes: doc })).toEqual({
      ok: false,
      reason: "unsupported-type",
      legacyWord: true,
    });
  });

  it("refuses a damaged PDF as unreadable", async () => {
    const broken = bytesOf("contract.pdf").slice(0, 600);
    expect(await extractText({ name: "contract.pdf", type: PDF, bytes: broken })).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });

  it("refuses a file named .docx that isn't one as unreadable", async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6]).buffer;
    expect(await extractText({ name: "contract.docx", type: DOCX, bytes: zip })).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });

  it("refuses a file over the size limit before reading it", async () => {
    const huge = new ArrayBuffer(26 * 1024 * 1024);
    expect(await extractText({ name: "big.pdf", type: PDF, bytes: huge })).toEqual({ ok: false, reason: "too-large" });
  });
});
