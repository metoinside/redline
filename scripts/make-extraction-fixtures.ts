// Regenerates the sample files in tests/fixtures/extraction/ from the
// adhesion contract fixture, using tools that ship with macOS plus Chrome:
//
//   npx tsx scripts/make-extraction-fixtures.ts
//
//   contract.pdf               the whole contract as a text PDF (headless Chrome)
//   contract.docx              the whole contract as a Word file (textutil)
//   ligatures-hyphenation.pdf  the opening and sections 1, 4, 6 and 13 set in
//                              Source Serif 4 with automatic hyphenation in a
//                              narrow justified column, and every fi, fl, ff,
//                              ffi and ffl written as its ligature character,
//                              so the text layer holds ligature glyphs and
//                              words split across lines
//   scanned.pdf                section 4 as a picture of the page and no text
//                              layer (Chrome screenshot, then sips)
//   partly-scanned.pdf         section 1 as text on page 1, then the same
//                              picture of section 4 alone on page 2
//
// Chrome writes a creation date into each PDF, so the bytes change on every
// run; the extracted text does not.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "tests/fixtures/extraction");
const fontPath = join(root, "public/fonts/source-serif-4-latin.woff2");
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const contract = readFileSync(join(root, "tests/fixtures/adhesion-contract.txt"), "utf8");
const paragraphs = contract.trimEnd().split("\n\n");

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Words that already contain a hyphen (non-exclusive, twenty-five) are kept on
// one line, so a line can only end in a hyphen where the layout added one.
function keepHyphenatedWordsWhole(html: string): string {
  return html.replace(/\S*-\S*/g, (word) => `<span class="nw">${word}</span>`);
}

// Many PDF producers write ligatures into the text layer as their own
// characters (U+FB00 to U+FB04). Typing them into the source puts them there.
function withLigatureCharacters(text: string): string {
  return text
    .replace(/ffi/g, "\uFB03")
    .replace(/ffl/g, "\uFB04")
    .replace(/ff/g, "\uFB00")
    .replace(/fi/g, "\uFB01")
    .replace(/fl/g, "\uFB02");
}

function page(body: string[], css: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
@font-face { font-family: "Source Serif 4"; src: url("file://${fontPath}") format("woff2"); font-weight: 200 900; }
@page { size: Letter; margin: 0.9in; }
body { margin: 0; color: #000; }
p { margin: 0 0 0.85em; break-inside: avoid; }
.nw { white-space: nowrap; }
${css}
</style></head><body>
${body.map((p) => `<p>${keepHyphenatedWordsWhole(escape(p))}</p>`).join("\n")}
</body></html>`;
}

function section(number: number): string[] {
  const start = paragraphs.findIndex((p) => p.startsWith(`${number}. `));
  const end = paragraphs.findIndex((p, i) => i > start && /^\d+\. [A-Z]/.test(p));
  return paragraphs.slice(start, end === -1 ? undefined : end);
}

function printToPdf(htmlFile: string, pdfFile: string) {
  execFileSync(chrome, [
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--allow-file-access-from-files",
    `--print-to-pdf=${pdfFile}`,
    `file://${htmlFile}`,
  ], { stdio: "ignore" });
}

const work = mkdtempSync(join(tmpdir(), "redline-fixtures-"));
try {
  // 1. Text PDF: plain system serif, no ligatures, no hyphenation.
  const textHtml = join(work, "contract.html");
  writeFileSync(textHtml, page(paragraphs, `
    body { font: 11pt/1.35 Georgia, serif; font-variant-ligatures: none; hyphens: none; }`));
  printToPdf(textHtml, join(outDir, "contract.pdf"));

  // 2. DOCX: one Word paragraph per contract paragraph.
  const docHtml = join(work, "contract-doc.html");
  writeFileSync(docHtml, `<!doctype html><html><head><meta charset="utf-8"></head><body>
${paragraphs.map((p) => `<p>${escape(p)}</p>`).join("\n")}
</body></html>`);
  execFileSync("textutil", ["-convert", "docx", "-output", join(outDir, "contract.docx"), docHtml]);

  // 3. Ligatures and hyphenation: Source Serif 4 forms fi, fl and ff
  //    ligatures; a narrow justified column forces hyphenated line ends.
  const ligatureHtml = join(work, "ligatures.html");
  const ligatureBody = [paragraphs[0], paragraphs[1], ...section(1), ...section(4), ...section(6), ...section(13)].map(withLigatureCharacters);
  writeFileSync(ligatureHtml, page(ligatureBody, `
    body { font: 13pt/1.4 "Source Serif 4", serif; font-variant-ligatures: common-ligatures;
           width: 3.1in; text-align: justify; hyphens: auto; -webkit-hyphens: auto; }`));
  printToPdf(ligatureHtml, join(outDir, "ligatures-hyphenation.pdf"));

  // 4. Scanned: a screenshot of section 4, saved as an image-only PDF.
  const scanHtml = join(work, "scan.html");
  writeFileSync(scanHtml, page(section(4), `
    body { font: 15px/1.45 Georgia, serif; padding: 48px 64px; background: #fff; }`));
  const png = join(work, "scan.png");
  execFileSync(chrome, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    "--window-size=1000,1300",
    `--screenshot=${png}`,
    `file://${scanHtml}`,
  ], { stdio: "ignore" });
  execFileSync("sips", ["-s", "format", "pdf", png, "--out", join(outDir, "scanned.pdf")], { stdio: "ignore" });

  // 5. Partly scanned: a text page followed by a page that is only a picture.
  const partHtml = join(work, "partly.html");
  writeFileSync(partHtml, page(section(1), `
    body { font: 11pt/1.35 Georgia, serif; }
    img { display: block; break-before: page; width: 100%; }`).replace("</body>", `<img src="file://${png}" alt=""></body>`));
  printToPdf(partHtml, join(outDir, "partly-scanned.pdf"));
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log(`Wrote the extraction samples to ${outDir}`);
