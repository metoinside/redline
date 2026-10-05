import { describe, expect, it } from "vitest";
import { MIN_CITATION_CHARS, findCitation } from "@/lib/engine/citations";
import { loadFixture } from "../fixtures/index";
import { changeWord, curlyQuotes, messySpacing } from "../support/model-payloads";

// The citation verifier (ADR 0001): a quote counts only if, after the one
// canonical normalisation, it is an exact substring of the stored text.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const sentence = sidecar.clauses.find((c) => c.id === "c4")!.sentence;

describe("findCitation", () => {
  it("finds a verbatim sentence and returns its offsets in the stored text", () => {
    const start = contract.indexOf(sentence);
    expect(findCitation(contract, sentence)).toEqual({ text: sentence, start, end: start + sentence.length });
  });

  it("finds every labelled sentence in both fixtures at its own offsets", () => {
    for (const name of ["adhesion-contract", "clean-document"] as const) {
      const { text, sidecar: labels } = loadFixture(name);
      const sentences = [...labels.clauses.map((c) => c.sentence), ...labels.decoys.map((d) => d.sentence)];
      for (const s of sentences) {
        const found = findCitation(text, s);
        expect(found).not.toBeNull();
        expect(text.slice(found!.start, found!.end)).toBe(s);
      }
    }
  });

  it("matches a quote whose quote marks or spacing differ only in ways the normalisation removes", () => {
    const expected = findCitation(contract, sentence);
    expect(findCitation(contract, curlyQuotes(sentence))).toEqual(expected);
    expect(findCitation(contract, messySpacing(sentence))).toEqual(expected);
  });

  it("returns null for a quote with one word changed, a letter dropped or a different case", () => {
    expect(findCitation(contract, changeWord(sentence, "ninety", "sixty"))).toBeNull();
    expect(findCitation(contract, sentence.replace("certified", "certifed"))).toBeNull();
    expect(findCitation(contract, sentence.replace("To prevent", "to prevent"))).toBeNull();
    expect(findCitation(contract, sentence.replace(/\.$/, ";"))).toBeNull();
  });

  it("returns null for a quote stitched from two sentences", () => {
    const [a, b] = sidecar.clauses.slice(1, 3).map((c) => c.sentence);
    expect(findCitation(contract, `${a} ${b}`)).toBeNull();
  });

  it("returns null for a quote too short to stand as a citation", () => {
    expect(findCitation(contract, "the")).toBeNull();
    expect(findCitation(contract, "  ")).toBeNull();
    expect(findCitation(contract, "")).toBeNull();
    const short = "shall automatically";
    expect(short.replace(/[^\p{L}\p{N}]/gu, "").length).toBeLessThan(MIN_CITATION_CHARS);
    expect(contract).toContain(short);
    expect(findCitation(contract, short)).toBeNull();
  });

  it("returns the first occurrence when a quote appears more than once", () => {
    const text = "The term renews each year automatically.\n\nThe term renews each year automatically.\n";
    expect(findCitation(text, "The term renews each year automatically.")).toEqual({
      text: "The term renews each year automatically.",
      start: 0,
      end: 40,
    });
  });
});
