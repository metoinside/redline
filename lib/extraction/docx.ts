import { countTextChars, MIN_TEXT_CHARS } from "./limits";

// DOCX text extraction with mammoth. Its raw-text mode returns each Word
// paragraph followed by a blank line, which is the paragraph break we keep.

export type DocxResult = { ok: true; raw: string } | { ok: false; reason: "no-text" | "unreadable" };

export async function extractDocx(bytes: ArrayBuffer): Promise<DocxResult> {
  const mod = await import("mammoth");
  const mammoth = mod.default ?? mod;
  let raw: string;
  try {
    // The browser build of mammoth reads `arrayBuffer`, the Node build reads
    // `buffer`; both accept an ArrayBuffer.
    const copy = bytes.slice(0);
    const input = { arrayBuffer: copy, buffer: copy } as unknown as { arrayBuffer: ArrayBuffer };
    raw = (await mammoth.extractRawText(input)).value;
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (countTextChars(raw) < MIN_TEXT_CHARS) return { ok: false, reason: "no-text" };
  return { ok: true, raw };
}
