import { describe, expect, it } from "vitest";
import { analyse } from "@/lib/engine/analyse";
import type { Analysis, ChecklistEntry } from "@/lib/engine/types";
import { CLAUSE_TYPES, loadFixture } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import { analysisPayload, clauseById, itemFor, scriptedClient } from "../support/model-payloads";

// The clean-result rule (ADR 0006; PRD §4 hard requirement 5), at the engine
// seam. Clean only when there is no Negotiate before signing flag and no
// outside-terms notice; the five-type checklist is worked out in code from
// the verified flags. The scripted client stands in for the model only.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const { text: cleanText, sidecar: cleanSidecar } = loadFixture("clean-document");
const outside = sidecar.outsideTerms[0];
const TOP_TIER = ["c1", "c2", "c3", "c4", "c5", "c6"];

async function analysisOf(payload: unknown, text = contract): Promise<Analysis> {
  const { analysis } = await analyse({ text, redLines: [], client: scriptedClient(payload) });
  expectCitationsVerbatim(analysis, text);
  return analysis;
}

/** Every family clause in the contract, reported with no exposure and one reading: all Know before signing. */
const allKnow = (outsideTerms?: unknown[]) =>
  analysisPayload(sidecar, {
    map: (item, clause) => ({ ...item, exposure: { money: null, lock_in: null, exit_difficulty: null }, readings: [clause.statement] }),
    ...(outsideTerms ? { outsideTerms } : {}),
  });

/** Claims that a clause type is not in the contract. The clean result never makes one. */
const ABSENCE_CLAIMS =
  /there\s+(?:is|are)\s+(?:none|no)\b|there['’]s\s+no\b|does\s*n[o']t\s+(?:contain|have|include|exist)|doesn['’]t\s+(?:contain|have|include|exist)|contains\s+no\b|has\s+no\b|no\s+such\b|\b(?:absent|missing)\s+from\b|not\s+(?:present|in\s+the\s+contract)/i;

describe("an outside-terms notice blocks the clean result", () => {
  it("even when every flag is Know before signing", async () => {
    const analysis = await analysisOf(allKnow());
    expect(analysis.flags.length).toBe(sidecar.clauses.length);
    expect(analysis.flags.every((f) => f.tier === "know")).toBe(true);
    expect(analysis.outsideTerms).toHaveLength(1);
    expect(analysis.outcome).toEqual({ clean: false, negotiateFlags: 0, outsideTermsNotices: 1 });
  });

  it("with only the benign Know before signing clause and the notice", async () => {
    const analysis = await analysisOf(analysisPayload(sidecar, { omit: TOP_TIER }));
    expect(analysis.flags.map((f) => f.tier)).toEqual(["know"]);
    expect(analysis.outcome.clean).toBe(false);
  });

  it("with no flags at all", async () => {
    const analysis = await analysisOf(analysisPayload(sidecar, { omit: sidecar.clauses.map((c) => c.id) }));
    expect(analysis.flags).toEqual([]);
    expect(analysis.outcome).toEqual({ clean: false, negotiateFlags: 0, outsideTermsNotices: 1 });
  });
});

describe("a Negotiate before signing flag blocks the clean result", () => {
  it("and the result says how many there are", async () => {
    const analysis = await analysisOf(analysisPayload(sidecar, { outsideTerms: [] }));
    expect(analysis.outcome).toEqual({ clean: false, negotiateFlags: 6, outsideTermsNotices: 0 });
  });
});

describe("only verified notices count", () => {
  it("a notice whose citation fails the check cannot block a clean result", async () => {
    const fake = { sentence: outside.sentence.replace("Acceptable Use Policy", "Master Terms"), document: "the Master Terms" };
    const analysis = await analysisOf(allKnow([fake]));
    expect(analysis.outsideTerms).toEqual([]);
    expect(analysis.outcome.clean).toBe(true);
  });

  it("a dropped notice cannot make a result clean that has a Negotiate before signing flag", async () => {
    const fake = { sentence: "Customer's use of the Services is subject to terms nobody wrote.", document: "the terms" };
    const analysis = await analysisOf(analysisPayload(sidecar, { outsideTerms: [fake] }));
    expect(analysis.outcome).toEqual({ clean: false, negotiateFlags: 6, outsideTermsNotices: 0 });
  });

  it("a flag that fails the citation check cannot block a clean result either", async () => {
    const invented = itemFor("auto_renewal", "This Agreement renews automatically for $90,000 per year.", {
      exposure: { money: "$90,000 per year", lock_in: null, exit_difficulty: null },
    });
    const analysis = await analysisOf(analysisPayload(sidecar, { omit: TOP_TIER, outsideTerms: [], extra: [invented] }));
    expect(analysis.flags.map((f) => f.tier)).toEqual(["know"]);
    expect(analysis.outcome.clean).toBe(true);
  });
});

describe("a clean result", () => {
  it("for the clean document with nothing found lists all five clause types as \"we found none\"", async () => {
    const analysis = await analysisOf(analysisPayload(cleanSidecar), cleanText);
    expect(analysisPayload(cleanSidecar)).toMatchObject({ clauses: [], outside_terms: [], notice_obligations: [] });
    expect(analysis.flags).toEqual([]);
    expect(analysis.outsideTerms).toEqual([]);
    expect(analysis.outcome).toEqual({
      clean: true,
      checklist: CLAUSE_TYPES.map((clauseType) => ({ clauseType, status: "none_found" })),
    });
  });

  it("with only Know before signing flags and no notices lists their types as found, low exposure with their citations", async () => {
    const analysis = await analysisOf(allKnow([]));
    expect(analysis.outcome.clean).toBe(true);
    if (!analysis.outcome.clean) return;
    const { checklist } = analysis.outcome;
    expect(checklist.map((e) => e.clauseType)).toEqual([...CLAUSE_TYPES]);
    for (const entry of checklist) {
      const labelled = sidecar.clauses.filter((c) => c.clauseType === entry.clauseType);
      expect(entry.status).toBe("found_low_exposure");
      if (entry.status !== "found_low_exposure") continue;
      expect(entry.found.map((f) => f.citation.text).sort()).toEqual(labelled.map((c) => c.sentence).sort());
      for (const { flagId, citation } of entry.found) {
        const flag = analysis.flags.find((f) => f.id === flagId)!;
        expect(flag.tier).toBe("know");
        expect(flag.citation).toEqual(citation);
      }
    }
  });

  it("lists a type as found only for the flags that survived, and \"we found none\" for every other type", async () => {
    const analysis = await analysisOf(analysisPayload(sidecar, { omit: TOP_TIER, outsideTerms: [] }));
    expect(analysis.outcome.clean).toBe(true);
    if (!analysis.outcome.clean) return;
    const c7 = clauseById(sidecar, "c7");
    const start = contract.indexOf(c7.sentence);
    const expected: ChecklistEntry[] = CLAUSE_TYPES.map((clauseType) =>
      clauseType === "auto_renewal"
        ? { clauseType, status: "found_low_exposure", found: [{ flagId: analysis.flags[0].id, citation: { text: c7.sentence, start, end: start + c7.sentence.length } }] }
        : { clauseType, status: "none_found" },
    );
    expect(analysis.outcome.checklist).toEqual(expected);
  });

  it("is worked out from the flags, never from anything the model says about cleanliness", async () => {
    const payload = { ...analysisPayload(sidecar), clean: true, checklist: [] };
    const analysis = await analysisOf(payload);
    expect(analysis.outcome.clean).toBe(false);
  });

  it.each([
    ["the clean document", () => analysisPayload(cleanSidecar), cleanText],
    ["only Know before signing flags", () => allKnow([]), contract],
  ])("never claims a clause type is absent from the contract (%s)", async (_label, payload, text) => {
    const analysis = await analysisOf(payload(), text);
    expect(analysis.outcome.clean).toBe(true);
    // The engine's own output, with the document's words taken out: none of it says a type isn't there.
    const generated = JSON.stringify(analysis.outcome, (key, value) => (key === "text" ? undefined : value));
    expect(generated).not.toMatch(ABSENCE_CLAIMS);
    expect(generated.toLowerCase()).not.toContain("there is none");
    const all = JSON.stringify(analysis, (key, value) => (key === "text" ? undefined : value));
    expect(all).not.toMatch(ABSENCE_CLAIMS);
  });
});
