import type { ReactNode } from "react";

// Renders the stored document text exactly as stored: no reflow, no
// trimming, no character changed. Line breaks show through `white-space:
// pre-wrap`, so the element's text content is the stored string itself.
//
// Later tickets highlight citations by character offsets into that string
// (UTF-16 code units, as String.prototype.indexOf counts them). A mark wraps
// text[start, end) in a <mark>; marks that overlap an earlier one or fall
// outside the text are left out rather than bending the text to fit.

export type TextMark = { start: number; end: number; id?: string; className?: string };

export function DocumentText({ text, marks = [] }: { text: string; marks?: TextMark[] }) {
  const parts: ReactNode[] = [];
  let at = 0;
  const sorted = [...marks].sort((a, b) => a.start - b.start || a.end - b.end);
  for (const mark of sorted) {
    const valid =
      Number.isInteger(mark.start) && Number.isInteger(mark.end) && mark.start >= at && mark.end > mark.start && mark.end <= text.length;
    if (!valid) continue;
    if (mark.start > at) parts.push(text.slice(at, mark.start));
    parts.push(
      <mark key={`${mark.start}-${mark.end}`} id={mark.id} className={mark.className} data-start={mark.start} data-end={mark.end}>
        {text.slice(mark.start, mark.end)}
      </mark>,
    );
    at = mark.end;
  }
  if (at < text.length) parts.push(text.slice(at));

  return (
    <div className="doc-text">
      {parts}
    </div>
  );
}
