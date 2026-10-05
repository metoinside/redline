// Limits shared by the browser (extraction and paste) and the server action
// that stores a document. Kept apart from the parsers so the server can
// import them without pulling in pdf.js or mammoth.

/** The longest document text Redline stores, in characters (UTF-16 units). */
export const MAX_DOCUMENT_CHARS = 300_000;

/** The largest file Redline will open, in bytes. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** The longest title Redline stores, in characters. */
export const MAX_TITLE_CHARS = 200;

/**
 * A page, or a whole document, counts as having text only when it has at
 * least this many letters and digits. A scanned page has none; a stray page
 * number or scanner stamp stays under it.
 */
export const MIN_TEXT_CHARS = 20;

/** Letters and digits in any script: what counts towards MIN_TEXT_CHARS. */
export function countTextChars(text: string): number {
  return text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
}

export type SourceKind = "pdf" | "docx" | "paste";

export const SOURCE_KINDS: readonly SourceKind[] = ["pdf", "docx", "paste"];
