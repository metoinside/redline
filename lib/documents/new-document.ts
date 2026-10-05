import { countTextChars, MAX_DOCUMENT_CHARS, MAX_TITLE_CHARS, MIN_TEXT_CHARS, SOURCE_KINDS, type SourceKind } from "@/lib/extraction/limits";
import { normalizeText } from "@/lib/extraction/normalize";

// What the browser sends to store a document: the title, the extracted or
// pasted text, and where the text came from. Never a file.
export type NewDocument = { title: string; body: string; sourceKind: SourceKind };

export type NewDocumentCheck =
  | { ok: true; document: NewDocument }
  | { ok: false; reason: "invalid" | "no-text" | "too-long" };

/**
 * Checks a document on the server before it is stored, without trusting the
 * browser: only the three expected strings are read, the text is put through
 * the canonical normalisation again (a no-op for text that came from
 * extractText or normalizePaste, since it is idempotent), and the limits are
 * applied again.
 */
export function checkNewDocument(input: unknown): NewDocumentCheck {
  if (typeof input !== "object" || input === null) return { ok: false, reason: "invalid" };
  const { title, body, sourceKind } = input as Record<string, unknown>;
  if (typeof title !== "string" || typeof body !== "string" || typeof sourceKind !== "string") {
    return { ok: false, reason: "invalid" };
  }
  if (!(SOURCE_KINDS as readonly string[]).includes(sourceKind)) return { ok: false, reason: "invalid" };

  const checked = checkDocumentText(body);
  if (!checked.ok) return checked;
  const text = checked.text;

  const cleanTitle = title.replace(/\s+/g, " ").trim();
  if (cleanTitle.length === 0 || cleanTitle.length > MAX_TITLE_CHARS) return { ok: false, reason: "invalid" };

  return { ok: true, document: { title: cleanTitle, body: text, sourceKind: sourceKind as SourceKind } };
}

export type DocumentTextCheck = { ok: true; text: string } | { ok: false; reason: "invalid" | "no-text" | "too-long" };

/**
 * Checks document text from the browser without trusting it: puts it through
 * the canonical normalisation again (a no-op for text that came from
 * extractText or normalizePaste) and applies the limits again.
 */
export function checkDocumentText(body: unknown): DocumentTextCheck {
  if (typeof body !== "string") return { ok: false, reason: "invalid" };
  // Checked before normalising, so an oversized request costs nothing.
  if (body.length > MAX_DOCUMENT_CHARS * 2) return { ok: false, reason: "too-long" };
  const text = normalizeText(body);
  if (countTextChars(text) < MIN_TEXT_CHARS) return { ok: false, reason: "no-text" };
  if (text.length > MAX_DOCUMENT_CHARS) return { ok: false, reason: "too-long" };
  return { ok: true, text };
}

/** A starting title: the file name without its extension, or the text's first line. */
export function suggestTitle(from: { fileName?: string; text?: string }): string {
  const fromName = from.fileName?.replace(/\.(pdf|docx?)$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  const firstLine = from.text?.split("\n").find((line) => line.trim() !== "")?.trim();
  const title = fromName || firstLine || "";
  return title.length > 80 ? `${title.slice(0, 79).trimEnd()}\u2026` : title;
}
