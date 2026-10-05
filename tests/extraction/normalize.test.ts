import { describe, expect, it } from "vitest";
import { MAX_DOCUMENT_CHARS, normalizePaste, normalizeText } from "@/lib/extraction";
import { FIXTURE_NAMES, loadFixture } from "../fixtures/index";

// normalizeText is the one canonical normalisation (ADR 0001). The stored
// document text and, later, every citation go through it.

describe("normalizeText on the fixtures", () => {
  it.each(FIXTURE_NAMES)("leaves %s unchanged", (name) => {
    const { text } = loadFixture(name);
    expect(normalizeText(text)).toBe(text);
  });
});

describe("the rules", () => {
  it("expands typographic ligatures", () => {
    expect(normalizeText("\uFB01les, \uFB02at fee, e\uFB00ective, o\uFB03ce, ba\uFB04e")).toBe(
      "files, flat fee, effective, office, baffle\n",
    );
  });

  it("straightens curly quotes and apostrophes", () => {
    expect(normalizeText("the \u201CAgreement\u201D and Provider\u2019s \u2018standard\u2019 terms")).toBe(
      "the \"Agreement\" and Provider's 'standard' terms\n",
    );
  });

  it("removes soft hyphens, joining the lines at one that ends a line", () => {
    expect(normalizeText("termi\u00ADnation fee")).toBe("termination fee\n");
    expect(normalizeText("renew\u00AD\nal term")).toBe("renewal term\n");
  });

  it("joins a lowercase word hyphenated across a line break", () => {
    expect(normalizeText("the Subscrip-\ntion Fee is pay-\nable annually")).toBe("the Subscription Fee is payable annually\n");
    expect(normalizeText("ven\u2010\ntory")).toBe("ventory\n");
  });

  it("does not join a hyphen next to a capital, a digit or a blank line", () => {
    expect(normalizeText("Halvard-\nCloud")).toBe("Halvard-\nCloud\n");
    expect(normalizeText("2026-\n2027")).toBe("2026-\n2027\n");
    expect(normalizeText("term-\n\nnext")).toBe("term-\n\nnext\n");
  });

  it("normalises line endings to LF", () => {
    expect(normalizeText("one\r\ntwo\rthree\u2028four")).toBe("one\ntwo\nthree\nfour\n");
  });

  it("collapses runs of spaces and tabs and trims the ends of lines", () => {
    expect(normalizeText("fee  of\t\t$500 \u00A0per year.   \n  Next line")).toBe("fee of $500 per year.\nNext line\n");
  });

  it("keeps paragraph breaks and collapses three or more line breaks to one blank line", () => {
    expect(normalizeText("Clause one.\n\nClause two.\n\n\n\nClause three.\nSame paragraph.")).toBe(
      "Clause one.\n\nClause two.\n\nClause three.\nSame paragraph.\n",
    );
  });

  it("ends with exactly one line break and starts with no blank lines", () => {
    expect(normalizeText("\n\n  Text")).toBe("Text\n");
    expect(normalizeText("Text\n\n\n")).toBe("Text\n");
    expect(normalizeText("")).toBe("");
    expect(normalizeText(" \n \t\n")).toBe("");
  });

  it("leaves dashes, case and punctuation alone", () => {
    const text = "Fees \u2013 annual \u2014 are $42,000 (USD); see Section 5.1.\n";
    expect(normalizeText(text)).toBe(text);
  });
});

describe("idempotence", () => {
  const tricky = [
    "a-\u00AD\nb",
    "a \u00AD\n\nb",
    "a\u00AD-\nb",
    "x- \n y",
    "\uFB01-\nle",
    "word -\n next",
    "a-\nb-\nc",
    "\r\n\r\n\r\n a  \u00A0 b\t\n",
    "\u201Cquote\u201D\u00AD \n\u2019s",
    " \u00AD \n\n\n \u00AD",
  ];

  it.each(tricky)("holds for %j", (input) => {
    const once = normalizeText(input);
    expect(normalizeText(once)).toBe(once);
  });

  it("holds for random mixes of the characters the rules touch", () => {
    const alphabet = ["a", "b", "Z", "1", " ", "\t", "\n", "\r", "-", "\u2010", "\u00AD", "\u00A0", "\uFB01", "\u2019", "\u201C", "."];
    let seed = 42;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let run = 0; run < 2000; run++) {
      let input = "";
      const length = 1 + Math.floor(random() * 30);
      for (let i = 0; i < length; i++) input += alphabet[Math.floor(random() * alphabet.length)];
      const once = normalizeText(input);
      expect(normalizeText(once), JSON.stringify(input)).toBe(once);
    }
  });

  it.each(FIXTURE_NAMES)("holds for %s", (name) => {
    const { text } = loadFixture(name);
    expect(normalizeText(normalizeText(text))).toBe(normalizeText(text));
  });
});

describe("pasted text", () => {
  const { text: contract, sidecar } = loadFixture("adhesion-contract");

  // What a buyer gets when they copy the contract out of a word processor or
  // an email: curly quotes, Windows line endings, doubled spaces, a trailing
  // space here and there.
  function messy(clean: string): string {
    return clean
      .replace(/"([^"\n]*)"/g, "\u201C$1\u201D")
      .replace(/'/g, "\u2019")
      .replace(/\. /g, ".  ")
      .replace(/\n/g, " \r\n");
  }

  it("normalises to the same text as its clean form", () => {
    const pasted = messy(contract);
    expect(pasted).not.toBe(contract);
    expect(pasted).toContain("\u201CAgreement\u201D");
    expect(pasted).toContain("\r\n");
    expect(pasted).toContain(".  ");
    expect(normalizeText(pasted)).toBe(contract);
  });

  it("becomes a document whose cited sentences match word for word", () => {
    const result = normalizePaste(messy(contract));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sourceKind).toBe("paste");
    for (const clause of sidecar.clauses) expect(result.text).toContain(clause.sentence);
  });

  it("is refused when there is no real text in it", () => {
    expect(normalizePaste("   \n\n  ")).toEqual({ ok: false, reason: "no-text" });
    expect(normalizePaste("Page 1")).toEqual({ ok: false, reason: "no-text" });
  });

  it("is refused when it is longer than Redline stores", () => {
    expect(normalizePaste("word ".repeat(MAX_DOCUMENT_CHARS / 4))).toEqual({ ok: false, reason: "too-long" });
  });
});
