import { expect } from "vitest";
import type { Citation } from "@/lib/engine/types";

// The ADR 0001 assertion: every citation in an engine result is an exact
// substring of the stored document text, at the offsets it records. It walks
// the whole result, so it covers whatever later tickets add (notice
// obligations, outside-terms notices, answers) without being rewritten.

function isCitation(value: unknown): value is Citation {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.text === "string" && typeof v.start === "number" && typeof v.end === "number";
}

/** Every citation-shaped object anywhere in `value`. */
export function collectCitations(value: unknown): Citation[] {
  const found: Citation[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    if (isCitation(node)) found.push(node);
    for (const child of Object.values(node)) walk(child);
  };
  walk(value);
  return found;
}

/** Fails unless every citation in `result` matches `text` word for word at its offsets. Returns the citations. */
export function expectCitationsVerbatim(result: unknown, text: string): Citation[] {
  const citations = collectCitations(result);
  for (const c of citations) {
    expect(Number.isInteger(c.start) && Number.isInteger(c.end), `offsets of ${JSON.stringify(c)}`).toBe(true);
    expect(c.start).toBeGreaterThanOrEqual(0);
    expect(c.end).toBeGreaterThan(c.start);
    expect(c.end).toBeLessThanOrEqual(text.length);
    expect(text.slice(c.start, c.end), "the text at the citation's offsets").toBe(c.text);
    expect(text.includes(c.text)).toBe(true);
  }
  return citations;
}
