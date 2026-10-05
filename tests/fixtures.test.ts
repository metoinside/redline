import { describe, expect, it } from "vitest";
import { CLAUSE_TYPES, FIXTURE_NAMES, loadFixture, type FixtureSidecar } from "./fixtures/index";

function countOccurrences(text: string, needle: string): number {
  let count = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) count++;
  return count;
}

function citedSentences(sidecar: FixtureSidecar): string[] {
  return [
    ...sidecar.clauses.map((c) => c.sentence),
    ...sidecar.noticeObligations.map((n) => n.sentence),
    ...sidecar.outsideTerms.map((o) => o.sentence),
    ...sidecar.decoys.map((d) => d.sentence),
    ...sidecar.questions.flatMap((q) => (q.answerable ? [q.sentence] : [])),
  ];
}

function sidecarProse(sidecar: FixtureSidecar): string[] {
  return [
    ...sidecar.clauses.flatMap((c) => [c.why, ...(c.readings ?? [])]),
    ...sidecar.noticeObligations.flatMap((n) => [n.description, n.deadline]),
    ...sidecar.decoys.map((d) => d.why),
    ...sidecar.questions.flatMap((q) => (q.answerable ? [q.answer] : [])),
  ];
}

const BANNED = /\b(may|might|could|unusual|non-standard|below market|typical|standard)\b/i;

describe.each(FIXTURE_NAMES)("fixture %s", (name) => {
  const { text, sidecar } = loadFixture(name);

  it("is in canonical form", () => {
    expect(text).toMatch(/^[\n\x20-\x7e]+$/);
    expect(text).not.toMatch(/ {2}|\n{3}|[ \t]\n|\n /);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });

  it("cites every sidecar sentence exactly once in the document", () => {
    const sentences = citedSentences(sidecar);
    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(countOccurrences(text, sentence), sentence).toBe(1);
    }
  });

  it("takes every exposure fragment from its own sentence", () => {
    for (const clause of sidecar.clauses) {
      for (const fragment of Object.values(clause.exposure)) {
        expect(clause.sentence, clause.id).toContain(fragment);
      }
    }
  });

  it("has answerable and unanswerable questions", () => {
    expect(sidecar.questions.filter((q) => q.answerable).length).toBeGreaterThanOrEqual(3);
    expect(sidecar.questions.filter((q) => !q.answerable).length).toBeGreaterThanOrEqual(3);
  });

  it("writes its labels as plain statements", () => {
    for (const line of sidecarProse(sidecar)) {
      expect(line).not.toMatch(BANNED);
    }
  });
});

describe("adhesion contract labels", () => {
  const { sidecar } = loadFixture("adhesion-contract");

  it("covers all five clause types", () => {
    expect(new Set(sidecar.clauses.map((c) => c.clauseType))).toEqual(new Set(CLAUSE_TYPES));
  });

  it("has clauses in both tiers and one that reads two ways", () => {
    expect(sidecar.clauses.some((c) => c.expectedTier === "negotiate")).toBe(true);
    expect(sidecar.clauses.some((c) => c.expectedTier === "know")).toBe(true);
    const ambiguous = sidecar.clauses.filter((c) => c.readings !== undefined);
    expect(ambiguous).toHaveLength(1);
    expect(ambiguous[0].readings).toHaveLength(2);
    expect(ambiguous[0].expectedTier).toBe("negotiate");
  });

  it("backs every top-tier clause with a cited exposure or two readings", () => {
    for (const clause of sidecar.clauses.filter((c) => c.expectedTier === "negotiate")) {
      const cited = Object.keys(clause.exposure).length > 0;
      expect(cited || clause.readings?.length === 2, clause.id).toBe(true);
    }
  });

  it("has notice obligations and an outside-terms sentence", () => {
    expect(sidecar.noticeObligations.length).toBeGreaterThan(0);
    expect(sidecar.outsideTerms.length).toBeGreaterThan(0);
  });

  it("keeps decoys apart from the planted clauses", () => {
    const planted = new Set(sidecar.clauses.map((c) => c.sentence));
    expect(sidecar.decoys.length).toBeGreaterThan(0);
    for (const decoy of sidecar.decoys) expect(planted.has(decoy.sentence)).toBe(false);
  });
});

describe("clean document labels", () => {
  const { text, sidecar } = loadFixture("clean-document");

  it("has no clauses, notice obligations or outside terms", () => {
    expect(sidecar.clauses).toEqual([]);
    expect(sidecar.noticeObligations).toEqual([]);
    expect(sidecar.outsideTerms).toEqual([]);
  });

  it("contains no renewal, termination or outside-document wording", () => {
    expect(text).not.toMatch(/renew|terminat|rollover|order form|policy|https?:|www\.|terms of service/i);
  });
});
