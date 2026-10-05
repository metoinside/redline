import { describe, expect, it } from "vitest";
import { analyse } from "@/lib/engine/analyse";
import { checkStoredAnalysis, readStoredAnalysis } from "@/lib/engine/stored";
import { ANALYSIS_SCHEMA_VERSION } from "@/lib/engine/types";
import { loadFixture } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import { analysisPayload, clauseById, scriptedClient } from "../support/model-payloads";

// A saved analysis comes back from the database (or from the server to the
// browser) as plain JSON. Before it is shown, every citation is checked again
// against the document text it is shown beside, every exposure fragment is
// checked against its citation, tiers and order are worked out again, and the
// wording check runs again. Nothing stored is taken on trust.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const { text: cleanText } = loadFixture("clean-document");

type StoredFlag = Record<string, unknown> & { citation: { text: string; start: number; end: number } };
type Stored = { schemaVersion: number; flags: StoredFlag[] };

async function freshAnalysis(): Promise<Stored> {
  const { analysis } = await analyse({ text: contract, redLines: [], client: scriptedClient(analysisPayload(sidecar)) });
  return JSON.parse(JSON.stringify(analysis)) as Stored;
}

const indexOf = (stored: Stored, id: string) =>
  stored.flags.findIndex((f) => f.citation.text === clauseById(sidecar, id).sentence);

describe("readStoredAnalysis", () => {
  it("returns a saved analysis unchanged when everything still checks out", async () => {
    const stored = await freshAnalysis();
    expect(stored.schemaVersion).toBe(ANALYSIS_SCHEMA_VERSION);
    const read = readStoredAnalysis(stored, contract);
    expect(read).toEqual(stored);
    expectCitationsVerbatim(read, contract);
  });

  it("leaves out a flag whose offsets no longer point at its sentence", async () => {
    const stored = await freshAnalysis();
    stored.flags[0].citation.start += 1;
    const read = readStoredAnalysis(stored, contract)!;
    expect(read.flags).toHaveLength(stored.flags.length - 1);
    expectCitationsVerbatim(read, contract);
  });

  it("leaves out every flag when shown beside a different document", async () => {
    const read = readStoredAnalysis(await freshAnalysis(), cleanText)!;
    expect(read.flags).toEqual([]);
  });

  it("leaves out a flag that is malformed", async () => {
    const stored = await freshAnalysis();
    const good = stored.flags[0];
    stored.flags = [
      { ...good, clauseType: "liability_cap" },
      { ...good, citation: { text: good.citation.text, start: "0", end: 10 } as never },
      { ...good, citation: null as never },
      { ...good, statement: "" },
      { ...good, readings: [] },
      { ...good, readings: ["a", "b", "c"] },
      { ...good, exposure: "lots" },
      good,
    ];
    expect(readStoredAnalysis(stored, contract)!.flags).toEqual([good]);
  });

  it("removes a stored exposure fragment that is not in its citation, and works the tier out again", async () => {
    const stored = await freshAnalysis();
    const i = indexOf(stored, "c7");
    stored.flags[i] = { ...stored.flags[i], exposure: { money: "$90,000 per year" }, moneyAmount: 90_000, tier: "negotiate" };
    const read = readStoredAnalysis(stored, contract)!;
    const c7 = read.flags.find((f) => f.citation.text === clauseById(sidecar, "c7").sentence)!;
    expect(c7.exposure).toEqual({});
    expect(c7.moneyAmount).toBeNull();
    expect(c7.tier).toBe("know");
  });

  it("reads the money amount from the fragment again instead of the stored number", async () => {
    const stored = await freshAnalysis();
    const i = indexOf(stored, "c2");
    stored.flags[i] = { ...stored.flags[i], moneyAmount: 1 };
    const read = readStoredAnalysis(stored, contract)!;
    expect(read.flags[0].moneyAmount).toBe(48_000);
  });

  it("puts the flags back in ranked order whatever order they were stored in", async () => {
    const stored = await freshAnalysis();
    const expected = readStoredAnalysis(stored, contract)!.flags.map((f) => f.id);
    stored.flags.reverse();
    expect(readStoredAnalysis(stored, contract)!.flags.map((f) => f.id)).toEqual(expected);
  });

  it("shows nothing when stored wording fails the check", async () => {
    const stored = await freshAnalysis();
    stored.flags[1] = { ...stored.flags[1], statement: "This clause is typical for SaaS contracts." };
    expect(readStoredAnalysis(stored, contract)).toBeNull();
    expect(checkStoredAnalysis(stored, contract)).toEqual({
      ok: false,
      reason: "wording",
    });
  });

  it("treats an analysis saved by the first version, with no tiers or exposure, as needing a re-run", () => {
    const c2 = clauseById(sidecar, "c2").sentence;
    const start = contract.indexOf(c2);
    const v1 = { schemaVersion: 1, flags: [{ id: "f1", clauseType: "auto_renewal", citation: { text: c2, start, end: start + c2.length } }] };
    expect(readStoredAnalysis(v1, contract)).toBeNull();
    expect(checkStoredAnalysis(v1, contract)).toEqual({ ok: false, reason: "outdated" });
  });

  it.each([
    ["null", null],
    ["a string", "analysis"],
    ["an unknown schema version", { schemaVersion: 999, flags: [] }],
    ["no flags list", { schemaVersion: ANALYSIS_SCHEMA_VERSION }],
  ])("returns null for %s", (_label, value) => {
    expect(readStoredAnalysis(value, contract)).toBeNull();
    expect(checkStoredAnalysis(value, contract)).toEqual({ ok: false, reason: "unreadable" });
  });
});
