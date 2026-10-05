// Text extraction (spec, "Text extraction"; ADR 0001). One job: take a file
// the buyer picked and return either its text, in canonical form, or the
// reason it can't be read. It runs in the browser, so the file itself never
// leaves the buyer's machine; only the text this returns is ever sent.
//
// The text it returns is the stored document text that every later citation
// is checked against. normalizeText is applied here, once, and to pasted
// text through normalizePaste.

import { extractDocx } from "./docx";
import { countTextChars, MAX_DOCUMENT_CHARS, MAX_FILE_BYTES, MIN_TEXT_CHARS, type SourceKind } from "./limits";
import { normalizeText } from "./normalize";
import { extractPdf } from "./pdf";

export { normalizeFragment, normalizeText } from "./normalize";
export * from "./limits";

export type ExtractionInput = { name: string; type: string; bytes: ArrayBuffer };

export type ExtractionFailure =
  /** No text layer at all, such as a scanned contract. Redline does not OCR. */
  | { ok: false; reason: "no-text" }
  /** Some pages are pictures with no text (listed, 1-based); reading the rest would miss them. */
  | { ok: false; reason: "partly-scanned"; pages: number[] }
  /** Neither a PDF nor a DOCX. `legacyWord` marks an old .doc file. */
  | { ok: false; reason: "unsupported-type"; legacyWord: boolean }
  /** The PDF is encrypted with a password. */
  | { ok: false; reason: "password" }
  /** The file is damaged or isn't what its name says. */
  | { ok: false; reason: "unreadable" }
  /** The file is larger than MAX_FILE_BYTES. */
  | { ok: false; reason: "too-large" }
  /** The text is longer than MAX_DOCUMENT_CHARS. */
  | { ok: false; reason: "too-long" };

export type ExtractionResult = { ok: true; text: string; sourceKind: SourceKind } | ExtractionFailure;

const PDF_TYPES = new Set(["application/pdf", "application/x-pdf"]);
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fileKind({ name, type, bytes }: ExtractionInput): "pdf" | "docx" | "doc" | null {
  const head = new Uint8Array(bytes.slice(0, 8));
  const lower = name.toLowerCase();
  const startsWith = (sig: number[]) => sig.every((b, i) => head[i] === b);
  // The file's first bytes decide; the name and type only say what was meant.
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return "pdf"; // %PDF
  if (startsWith([0xd0, 0xcf, 0x11, 0xe0])) return lower.endsWith(".doc") || type === "application/msword" ? "doc" : null;
  if (startsWith([0x50, 0x4b])) {
    // A ZIP. Only a DOCX is read; mammoth rejects any other ZIP.
    return lower.endsWith(".docx") || type === DOCX_TYPE ? "docx" : null;
  }
  if (PDF_TYPES.has(type) || lower.endsWith(".pdf")) return "pdf"; // claims to be a PDF; pdf.js will say if not
  if (type === DOCX_TYPE || lower.endsWith(".docx")) return "docx";
  if (type === "application/msword" || lower.endsWith(".doc")) return "doc";
  return null;
}

export async function extractText(input: ExtractionInput): Promise<ExtractionResult> {
  if (input.bytes.byteLength > MAX_FILE_BYTES) return { ok: false, reason: "too-large" };

  const kind = fileKind(input);
  if (kind === null || kind === "doc") return { ok: false, reason: "unsupported-type", legacyWord: kind === "doc" };

  const result = kind === "pdf" ? await extractPdf(input.bytes) : await extractDocx(input.bytes);
  if (!result.ok) return result;

  return finish(result.raw, kind);
}

/** Pasted text goes through the same normalisation and the same checks. */
export function normalizePaste(raw: string): ExtractionResult {
  return finish(raw, "paste");
}

function finish(raw: string, sourceKind: SourceKind): ExtractionResult {
  const text = normalizeText(raw);
  if (countTextChars(text) < MIN_TEXT_CHARS) return { ok: false, reason: "no-text" };
  if (text.length > MAX_DOCUMENT_CHARS) return { ok: false, reason: "too-long" };
  return { ok: true, text, sourceKind };
}
