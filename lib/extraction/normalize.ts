// The one canonical normalisation (ADR 0001). It runs once, when a document's
// text is extracted or pasted, and the result is the stored document text
// that every citation is checked against. The citation verifier puts each
// quote through the same rules (normalizeFragment, below), so a quote and the
// document are always compared in the same form. It must stay idempotent:
// normalizeText(normalizeText(x)) equals normalizeText(x) for every x.
//
// The rules, in the order they run:
//  1. Line endings become LF (CRLF, lone CR, U+2028, U+2029, form feed).
//  2. Byte-order marks and zero-width spaces are removed.
//  3. Typographic ligatures are expanded (ff, fi, fl, ffi, ffl, long st, st).
//  4. Curly quotes and apostrophes become straight ones (' and ").
//  5. Tabs, no-break spaces and other Unicode spaces become plain spaces.
//  6. A soft hyphen at the end of a line joins the two lines.
//  7. Other soft hyphens are removed.
//  8. Spaces at the start and end of every line are removed.
//  9. A hyphen at the end of a line between two lowercase letters joins the
//     word split across the lines ("ven-\ntory" becomes "ventory").
// 10. Runs of spaces become one space.
// 11. Three or more line breaks become one blank line; paragraph breaks stay.
// 12. Blank lines at the start are removed, and the text ends with exactly
//     one line break (empty text stays empty).
//
// normalizeFragment applies rules 1-12 except the final line break, for a
// piece of text that is compared against the stored text rather than stored
// itself, such as the sentence a model quotes. normalizeText is that plus the
// line break, so the two can never drift apart.
//
// Nothing else changes: dashes, digits, case, punctuation and single line
// breaks are kept as they are.

const LIGATURES: Record<string, string> = {
  "\uFB00": "ff",
  "\uFB01": "fi",
  "\uFB02": "fl",
  "\uFB03": "ffi",
  "\uFB04": "ffl",
  "\uFB05": "st",
  "\uFB06": "st",
};

export function normalizeFragment(raw: string): string {
  return raw
    // 1. Line endings.
    .replace(/\r\n?|[\u2028\u2029\f]/g, "\n")
    // 2. Invisible characters that only get in the way of matching.
    .replace(/[\uFEFF\u200B]/g, "")
    // 3. Ligatures.
    .replace(/[\uFB00-\uFB06]/g, (lig) => LIGATURES[lig])
    // 4. Quotes and apostrophes.
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    // 5. Spaces of every kind.
    .replace(/[\t\v\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    // 6-7. Soft hyphens (spaces after one are ignored).
    .replace(/\u00AD *\n(?=[^\n])/g, "")
    .replace(/\u00AD/g, "")
    // 8. Spaces at the edges of lines.
    .replace(/ +\n/g, "\n")
    .replace(/\n +/g, "\n")
    // 9. A lowercase word split across two lines.
    .replace(/(?<=\p{Ll})[-\u2010]\n(?=\p{Ll})/gu, "")
    // 10. Runs of spaces.
    .replace(/ {2,}/g, " ")
    // 11. Paragraph breaks.
    .replace(/\n{3,}/g, "\n\n")
    // 12. The edges of the document.
    .replace(/^[ \n]+/, "")
    .replace(/[ \n]+$/, "");
}

export function normalizeText(raw: string): string {
  const text = normalizeFragment(raw);
  return text === "" ? "" : `${text}\n`;
}
