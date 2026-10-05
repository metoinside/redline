import { describe, expect, it } from "vitest";
import { analyse } from "@/lib/engine/analyse";
import { readStoredAnalysis } from "@/lib/engine/stored";
import { loadFixture } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import { analysisPayload, scriptedClient } from "../support/model-payloads";

// A saved analysis comes back from the database (or from the server to the
// browser) as plain JSON. Before it is shown, every citation is checked again
// against the document text it is shown beside: a flag that fails is not shown.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const { text: cleanText } = loadFixture("clean-document");

async function freshAnalysis() {
  const { analysis } = await analyse({ text: contract, redLines: [], client: scriptedClient(analysisPayload(sidecar)) });
  return JSON.parse(JSON.stringify(analysis)) as unknown;
}

describe("readStoredAnalysis", () => {
  it("returns a saved analysis unchanged when every citation still matches", async () => {
    const stored = await freshAnalysis();
    const read = readStoredAnalysis(stored, contract);
    expect(read).toEqual(stored);
    expectCitationsVerbatim(read, contract);
  });

  it("leaves out a flag whose offsets no longer point at its sentence", async () => {
    const stored = (await freshAnalysis()) as { flags: { citation: { start: number; end: number } }[] };
    expect(stored.flags.length).toBeGreaterThan(1);
    stored.flags[0].citation.start += 1;
    const read = readStoredAnalysis(stored, contract)!;
    expect(read.flags).toHaveLength(stored.flags.length - 1);
    expectCitationsVerbatim(read, contract);
  });

  it("leaves out every flag when shown beside a different document", async () => {
    const read = readStoredAnalysis(await freshAnalysis(), cleanText)!;
    expect(read.flags).toEqual([]);
  });

  it("leaves out a flag with a clause type outside the family or a malformed citation", async () => {
    const stored = (await freshAnalysis()) as { flags: Record<string, unknown>[] };
    const good = stored.flags[0];
    stored.flags = [
      { ...good, clauseType: "liability_cap" },
      { ...good, citation: { text: (good.citation as { text: string }).text, start: "0", end: 10 } },
      { ...good, citation: null },
      good,
    ];
    expect(readStoredAnalysis(stored, contract)!.flags).toEqual([good]);
  });

  it.each([
    ["null", null],
    ["a string", "analysis"],
    ["an unknown schema version", { schemaVersion: 999, flags: [] }],
    ["no flags list", { schemaVersion: 1 }],
  ])("returns null for %s", (_label, value) => {
    expect(readStoredAnalysis(value, contract)).toBeNull();
  });
});
