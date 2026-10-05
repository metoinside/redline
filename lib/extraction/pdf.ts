import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { countTextChars, MIN_TEXT_CHARS } from "./limits";

// PDF text extraction with pdf.js. The same legacy build runs in the browser
// and under Node (vitest): in the browser it parses in a web worker; in Node,
// where there is no worker, pdf.js runs its worker code in-process.

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    if (typeof window !== "undefined" && typeof Worker !== "undefined" && !pdfjs.GlobalWorkerOptions.workerPort) {
      // pdf.js's worker build is one self-contained module. The bundler sees
      // this `new URL(..., import.meta.url)`, copies the file into the build's
      // static assets and puts its URL here, so the worker is served from
      // this site like any other script.
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
        { type: "module" },
      );
    }
    return pdfjs;
  });
  return pdfjsPromise;
}

export type PdfResult =
  | { ok: true; raw: string }
  | { ok: false; reason: "no-text" }
  | { ok: false; reason: "partly-scanned"; pages: number[] }
  | { ok: false; reason: "password" }
  | { ok: false; reason: "unreadable" };

type Line = { text: string; y: number; right: number; size: number };

export async function extractPdf(bytes: ArrayBuffer): Promise<PdfResult> {
  const pdfjs = await loadPdfJs();
  // pdf.js takes ownership of the buffer it is given, so it gets a copy.
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes.slice(0)),
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });

  try {
    let doc;
    try {
      doc = await task.promise;
    } catch (err) {
      if (err instanceof Error && err.name === "PasswordException") return { ok: false, reason: "password" };
      return { ok: false, reason: "unreadable" };
    }

    const pages: Line[][] = [];
    const scannedPages: number[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      // Normalisation is left to normalizeText, the one place it happens.
      const content = await page.getTextContent({ disableNormalization: true });
      const lines = toLines(content.items.filter((item): item is TextItem => "str" in item));
      pages.push(lines);
      if (countTextChars(lines.map((l) => l.text).join("")) < MIN_TEXT_CHARS && (await paintsImage(page, pdfjs))) {
        scannedPages.push(n);
      }
      page.cleanup();
    }

    const raw = assemble(pages);
    if (countTextChars(raw) < MIN_TEXT_CHARS) return { ok: false, reason: "no-text" };
    if (scannedPages.length > 0) return { ok: false, reason: "partly-scanned", pages: scannedPages };
    return { ok: true, raw };
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    await task.destroy();
  }
}

async function paintsImage(
  page: Awaited<ReturnType<Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>["getPage"]>>,
  pdfjs: PdfJs,
): Promise<boolean> {
  const { OPS } = pdfjs;
  const imageOps = new Set<number>([
    OPS.paintImageXObject,
    OPS.paintInlineImageXObject,
    OPS.paintImageMaskXObject,
    OPS.paintImageXObjectRepeat,
    OPS.paintInlineImageXObjectGroup,
  ]);
  const { fnArray } = await page.getOperatorList();
  return fnArray.some((op) => imageOps.has(op));
}

/** Groups pdf.js text items into visual lines, in content order. */
function toLines(items: TextItem[]): Line[] {
  const lines: Line[] = [];
  let current: Line | null = null;

  const close = () => {
    if (current && current.text.trim() !== "") {
      current.text = current.text.replace(/\s+$/, "");
      lines.push(current);
    }
    current = null;
  };

  for (const item of items) {
    if (item.str !== "") {
      const [, , c, d, x, y] = item.transform as number[];
      const size = Math.hypot(c, d) || item.height || 1;
      if (current && Math.abs(current.y - y) > size * 0.5) close();
      if (!current) current = { text: "", y, right: x, size };
      current.text += item.str;
      if (item.str.trim() !== "") current.right = Math.max(current.right, x + item.width);
      current.size = Math.max(current.size, size);
    }
    if (item.hasEOL) close();
  }
  close();
  return lines;
}

const HYPHEN_END = /[-\u2010\u00AD]$/;
const LOWER_HYPHEN_END = /\p{Ll}[-\u2010\u00AD]$/u;
const SENTENCE_END = /[.:;!?]["')\]]*$/;

/**
 * Rebuilds paragraphs from visual lines. Lines of one paragraph are joined
 * with a space; a blank line separates paragraphs. A line that ends in a
 * hyphen is joined with a line break so that normalizeText decides whether
 * the hyphen splits a word.
 */
function assemble(pages: Line[][]): string {
  // The distance between two lines of one paragraph, as a multiple of the
  // font size: the smallest gap in the document. Paragraph breaks are gaps
  // clearly larger than that.
  const ratios: number[] = [];
  for (const lines of pages) {
    for (let i = 1; i < lines.length; i++) {
      const ratio = (lines[i - 1].y - lines[i].y) / lines[i].size;
      if (ratio >= 0.6) ratios.push(ratio);
    }
  }
  const lineRatio = ratios.length ? Math.min(...ratios) : 1.2;
  const spacedParagraphs = ratios.some((r) => r > lineRatio * 1.3);

  const paragraphs: string[][] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.length) paragraphs.push(paragraph);
    paragraph = [];
  };

  pages.forEach((lines, pageIndex) => {
    const maxRight = Math.max(0, ...lines.map((l) => l.right));
    lines.forEach((line, i) => {
      if (i === 0) {
        // A paragraph runs on to the next page only when the sentence is
        // unfinished and the new page carries on in lowercase.
        const previous = paragraph.at(-1);
        const carriesOn =
          pageIndex > 0 &&
          previous !== undefined &&
          (HYPHEN_END.test(previous) || (!SENTENCE_END.test(previous) && /^\p{Ll}/u.test(line.text)));
        if (!carriesOn) endParagraph();
      } else {
        const prev = lines[i - 1];
        const ratio = (prev.y - line.y) / line.size;
        const gapBreak = ratio < 0.6 || ratio > lineRatio * 1.3 || ratio > 3;
        // With no extra space between paragraphs, a short line ends one.
        const shortLineBreak = !spacedParagraphs && prev.right < maxRight * 0.75;
        if (gapBreak || shortLineBreak) endParagraph();
      }
      paragraph.push(line.text);
    });
  });
  endParagraph();

  return paragraphs.map(joinLines).join("\n\n");
}

function joinLines(lines: string[]): string {
  let text = lines[0];
  for (const line of lines.slice(1)) {
    if (LOWER_HYPHEN_END.test(text) && /^\p{Ll}/u.test(line)) text += `\n${line}`;
    else if (HYPHEN_END.test(text)) text += line;
    else text += ` ${line}`;
  }
  return text;
}
