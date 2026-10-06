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
type StoredNotice = Record<string, unknown> & { citation: { text: string; start: number; end: number }; document: string };
type StoredPoint = Record<string, unknown> & { citation: { text: string; start: number; end: number }; text: string };
type StoredObligation = Record<string, unknown> & {
  citation: { text: string; start: number; end: number };
  description: string;
  deadline: Record<string, unknown>;
};
type Stored = {
  schemaVersion: number;
  summary: StoredPoint[];
  noticeObligations: StoredObligation[];
  flags: StoredFlag[];
  outsideTerms: StoredNotice[];
  outcome: Record<string, unknown>;
};

async function freshAnalysis(payload: unknown = analysisPayload(sidecar)): Promise<Stored> {
  const { analysis } = await analyse({ text: contract, redLines: [], client: scriptedClient(payload) });
  return JSON.parse(JSON.stringify(analysis)) as Stored;
}

/** Only the benign Know before signing clause, and the outside-terms notice. */
const knowAndNotice = () => freshAnalysis(analysisPayload(sidecar, { omit: ["c1", "c2", "c3", "c4", "c5", "c6"] }));

const indexOf = (stored: Stored, id: string) =>
  stored.flags.findIndex((f) => f.citation.text === clauseById(sidecar, id).sentence);

describe("readStoredAnalysis", () => {
  it("returns a saved analysis unchanged when everything still checks out", async () => {
    const stored = await freshAnalysis();
    expect(stored.schemaVersion).toBe(ANALYSIS_SCHEMA_VERSION);
    const read = readStoredAnalysis(stored, contract, []);
    expect(read).toEqual(stored);
    expectCitationsVerbatim(read, contract);
  });

  it("leaves out a flag whose offsets no longer point at its sentence", async () => {
    const stored = await freshAnalysis();
    stored.flags[0].citation.start += 1;
    const read = readStoredAnalysis(stored, contract, [])!;
    expect(read.flags).toHaveLength(stored.flags.length - 1);
    expectCitationsVerbatim(read, contract);
  });

  it("leaves out every flag when shown beside a different document", async () => {
    const read = readStoredAnalysis(await freshAnalysis(), cleanText, [])!;
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
    expect(readStoredAnalysis(stored, contract, [])!.flags).toEqual([good]);
  });

  it("removes a stored exposure fragment that is not in its citation, and works the tier out again", async () => {
    const stored = await freshAnalysis();
    const i = indexOf(stored, "c7");
    stored.flags[i] = { ...stored.flags[i], exposure: { money: "$90,000 per year" }, moneyAmount: 90_000, tier: "negotiate" };
    const read = readStoredAnalysis(stored, contract, [])!;
    const c7 = read.flags.find((f) => f.citation.text === clauseById(sidecar, "c7").sentence)!;
    expect(c7.exposure).toEqual({});
    expect(c7.moneyAmount).toBeNull();
    expect(c7.tier).toBe("know");
  });

  it("reads the money amount from the fragment again instead of the stored number", async () => {
    const stored = await freshAnalysis();
    const i = indexOf(stored, "c2");
    stored.flags[i] = { ...stored.flags[i], moneyAmount: 1 };
    const read = readStoredAnalysis(stored, contract, [])!;
    expect(read.flags[0].moneyAmount).toBe(48_000);
  });

  it("puts the flags back in ranked order whatever order they were stored in", async () => {
    const stored = await freshAnalysis();
    const expected = readStoredAnalysis(stored, contract, [])!.flags.map((f) => f.id);
    stored.flags.reverse();
    expect(readStoredAnalysis(stored, contract, [])!.flags.map((f) => f.id)).toEqual(expected);
  });

  it("shows nothing when stored wording fails the check", async () => {
    const stored = await freshAnalysis();
    stored.flags[1] = { ...stored.flags[1], statement: "This clause is typical for SaaS contracts." };
    expect(readStoredAnalysis(stored, contract, [])).toBeNull();
    expect(checkStoredAnalysis(stored, contract, [])).toEqual({
      ok: false,
      reason: "wording",
    });
  });

  it("leaves out a notice whose offsets no longer point at its sentence, and works out the clean result again", async () => {
    const stored = await knowAndNotice();
    expect(readStoredAnalysis(stored, contract, [])!.outcome.clean).toBe(false);
    stored.outsideTerms[0].citation.start += 1;
    const read = readStoredAnalysis(stored, contract, [])!;
    expect(read.outsideTerms).toEqual([]);
    expect(read.outcome.clean).toBe(true);
    expectCitationsVerbatim(read, contract);
  });

  it("leaves out a malformed notice", async () => {
    const stored = await freshAnalysis();
    const good = stored.outsideTerms[0];
    stored.outsideTerms = [
      { ...good, document: "" },
      { ...good, document: 42 as never },
      { ...good, citation: null as never },
      { ...good, id: undefined as never },
      good,
    ];
    expect(readStoredAnalysis(stored, contract, [])!.outsideTerms).toEqual([good]);
  });

  it("shows nothing when a stored notice's description fails the wording check", async () => {
    const stored = await freshAnalysis();
    stored.outsideTerms[0].document = "a policy that may apply";
    expect(checkStoredAnalysis(stored, contract, [])).toEqual({ ok: false, reason: "wording" });
  });

  it("never trusts a stored clean result", async () => {
    const stored = await freshAnalysis();
    stored.outcome = { clean: true, checklist: [] };
    const read = readStoredAnalysis(stored, contract, [])!;
    expect(read.outcome).toEqual({ clean: false, negotiateFlags: 6, outsideTermsNotices: 1 });

    const notice = await knowAndNotice();
    notice.outcome = { clean: true, checklist: [] };
    expect(readStoredAnalysis(notice, contract, [])!.outcome).toEqual({ clean: false, negotiateFlags: 0, outsideTermsNotices: 1 });
  });

  it("works out a clean result's checklist again from the flags that survive", async () => {
    const stored = await freshAnalysis(analysisPayload(sidecar, { omit: ["c1", "c2", "c3", "c4", "c5", "c6"], outsideTerms: [] }));
    expect(stored.outcome.clean).toBe(true);
    stored.outcome = { clean: true, checklist: [{ clauseType: "rollover", status: "found_low_exposure", found: [] }] };
    const read = readStoredAnalysis(stored, contract, [])!;
    expect(read.outcome.clean && read.outcome.checklist.map((e) => [e.clauseType, e.status])).toEqual([
      ["auto_renewal", "found_low_exposure"],
      ["notice_window", "none_found"],
      ["early_termination_fee", "none_found"],
      ["rollover", "none_found"],
      ["multi_year_term", "none_found"],
    ]);

    // A flag whose citation no longer checks out leaves its type as "we found none".
    stored.flags[0].citation.start += 1;
    const after = readStoredAnalysis(stored, contract, [])!;
    expect(after.outcome.clean && after.outcome.checklist.every((e) => e.status === "none_found")).toBe(true);
  });

  it("leaves out a summary point whose offsets no longer point at its sentence, and keeps the rest", async () => {
    const stored = await freshAnalysis();
    expect(stored.summary.length).toBe(sidecar.summary.length);
    stored.summary[0].citation.start += 1;
    const read = readStoredAnalysis(stored, contract, [])!;
    expect(read.summary.map((p) => p.id)).toEqual(stored.summary.slice(1).map((p) => p.id));
    expectCitationsVerbatim(read, contract);
  });

  it("leaves out a notice obligation whose offsets no longer point at its sentence", async () => {
    const stored = await freshAnalysis();
    stored.noticeObligations[1].citation.end -= 1;
    const read = readStoredAnalysis(stored, contract, [])!;
    expect(read.noticeObligations.map((o) => o.id)).toEqual(["o1"]);
    expectCitationsVerbatim(read, contract);
  });

  it("leaves out every summary point and notice obligation when shown beside a different document", async () => {
    const read = readStoredAnalysis(await freshAnalysis(), cleanText, [])!;
    expect(read.summary).toEqual([]);
    expect(read.noticeObligations).toEqual([]);
  });

  it("leaves out a stored deadline that names a date its sentence doesn't state, or is malformed", async () => {
    const stored = await freshAnalysis();
    const good = stored.noticeObligations[0];
    stored.noticeObligations = [
      { ...good, deadline: { kind: "date", date: "December 1, 2028" } },
      { ...good, deadline: { kind: "rule", rule: "By December 1, 2028", relativeTo: "the end of the then-current term" } },
      { ...good, deadline: { kind: "rule", rule: "90 days before the term ends" } },
      { ...good, deadline: null as never },
      { ...good, description: "" },
      good,
    ];
    expect(readStoredAnalysis(stored, contract, [])!.noticeObligations).toEqual([good]);
  });

  it.each([
    ["a summary point", (s: Stored) => (s.summary[0].text = "This might renew.")],
    ["a notice obligation's description", (s: Stored) => (s.noticeObligations[0].description = "You could potentially owe notice.")],
    ["a deadline rule", (s: Stored) => (s.noticeObligations[0].deadline = { ...s.noticeObligations[0].deadline, rule: "The typical 90 days" })],
  ])("shows nothing when %s fails the wording check", async (_label, spoil) => {
    const stored = await freshAnalysis();
    spoil(stored);
    expect(checkStoredAnalysis(stored, contract, [])).toEqual({ ok: false, reason: "wording" });
  });

  it("re-checks the wording of every stored counter-offer, the replacement and the message", async () => {
    const replacement = await freshAnalysis();
    replacement.flags[0].counterOffer = { ...(replacement.flags[0].counterOffer as object), replacement: "Customer may end this Agreement at any time." };
    expect(checkStoredAnalysis(replacement, contract, [])).toEqual({ ok: false, reason: "wording" });

    const message = await freshAnalysis();
    message.flags[2].counterOffer = { ...(message.flags[2].counterOffer as object), message: "This fee is unusual, so we'd like it gone." };
    expect(checkStoredAnalysis(message, contract, [])).toEqual({ ok: false, reason: "wording" });
  });

  it.each([
    ["no counter-offer", undefined],
    ["a null counter-offer", null],
    ["an empty replacement", { replacement: "", message: "We'd like this changed." }],
    ["no message", { replacement: "Each renewal term shall be twelve (12) months." }],
  ])("shows nothing when a stored flag has %s, rather than show the flag without one", async (_label, offer) => {
    const stored = await freshAnalysis();
    stored.flags[1] = { ...stored.flags[1], counterOffer: offer };
    expect(readStoredAnalysis(stored, contract, [])).toBeNull();
    expect(checkStoredAnalysis(stored, contract, [])).toEqual({ ok: false, reason: "unreadable" });
  });

  it("shows nothing when a stored replacement repeats its sentence unchanged", async () => {
    const stored = await freshAnalysis();
    stored.flags[0].counterOffer = { ...(stored.flags[0].counterOffer as object), replacement: stored.flags[0].citation.text };
    expect(checkStoredAnalysis(stored, contract, [])).toEqual({ ok: false, reason: "unreadable" });
  });

  it("ties every counter-offer to its flag's citation again, whatever sentence was stored with it", async () => {
    const stored = await freshAnalysis();
    const other = stored.flags[3].citation;
    stored.flags[0].counterOffer = { ...(stored.flags[0].counterOffer as object), replaces: { ...other } };
    const read = readStoredAnalysis(stored, contract, [])!;
    for (const flag of read.flags) expect(flag.counterOffer.replaces).toEqual(flag.citation);
    expectCitationsVerbatim(read, contract);
  });

  it("drops a flag whose citation no longer checks out together with its counter-offer", async () => {
    const stored = await freshAnalysis();
    const gone = stored.flags[0];
    const offer = gone.counterOffer as { replacement: string; message: string };
    gone.citation.start += 1;
    const read = readStoredAnalysis(stored, contract, [])!;
    expect(read.flags).toHaveLength(stored.flags.length - 1);
    const shown = JSON.stringify(read);
    expect(shown).not.toContain(offer.replacement);
    expect(shown).not.toContain(offer.message);
  });

  it("never reads a counter-offer stored on an outside-terms notice", async () => {
    const stored = await freshAnalysis();
    stored.outsideTerms[0] = { ...stored.outsideTerms[0], counterOffer: { replacement: "The zebra policy does not apply.", message: "Please drop it." } };
    const read = readStoredAnalysis(stored, contract, [])!;
    expect(read.outsideTerms[0]).not.toHaveProperty("counterOffer");
    expect(JSON.stringify(read)).not.toContain("zebra");
  });

  it("treats an analysis saved before counter-offers existed as needing a re-run", async () => {
    const stored = await freshAnalysis();
    const v4 = {
      ...stored,
      schemaVersion: 4,
      flags: stored.flags.map(({ counterOffer: _gone, ...flag }) => flag),
    };
    expect(readStoredAnalysis(v4, contract, [])).toBeNull();
    expect(checkStoredAnalysis(v4, contract, [])).toEqual({ ok: false, reason: "outdated" });
  });

  it("treats an analysis saved before the summary and notice obligations existed as needing a re-run", async () => {
    const stored = await freshAnalysis();
    const v3 = { schemaVersion: 3, flags: stored.flags, outsideTerms: stored.outsideTerms, outcome: stored.outcome };
    expect(readStoredAnalysis(v3, contract, [])).toBeNull();
    expect(checkStoredAnalysis(v3, contract, [])).toEqual({ ok: false, reason: "outdated" });
  });

  it("treats an analysis saved before outside terms were checked as needing a re-run", async () => {
    const stored = await freshAnalysis();
    const v2 = { schemaVersion: 2, flags: stored.flags };
    expect(readStoredAnalysis(v2, contract, [])).toBeNull();
    expect(checkStoredAnalysis(v2, contract, [])).toEqual({ ok: false, reason: "outdated" });
  });

  it("treats an analysis saved by the first version, with no tiers or exposure, as needing a re-run", () => {
    const c2 = clauseById(sidecar, "c2").sentence;
    const start = contract.indexOf(c2);
    const v1 = { schemaVersion: 1, flags: [{ id: "f1", clauseType: "auto_renewal", citation: { text: c2, start, end: start + c2.length } }] };
    expect(readStoredAnalysis(v1, contract, [])).toBeNull();
    expect(checkStoredAnalysis(v1, contract, [])).toEqual({ ok: false, reason: "outdated" });
  });

  it.each([
    ["null", null],
    ["a string", "analysis"],
    ["an unknown schema version", { schemaVersion: 999, flags: [] }],
    ["no flags list", { schemaVersion: ANALYSIS_SCHEMA_VERSION, outsideTerms: [], summary: [], noticeObligations: [] }],
    ["no outside-terms list", { schemaVersion: ANALYSIS_SCHEMA_VERSION, flags: [], summary: [], noticeObligations: [] }],
    ["no summary", { schemaVersion: ANALYSIS_SCHEMA_VERSION, flags: [], outsideTerms: [], noticeObligations: [] }],
    ["no notice-obligation list", { schemaVersion: ANALYSIS_SCHEMA_VERSION, flags: [], outsideTerms: [], summary: [] }],
  ])("returns null for %s", (_label, value) => {
    expect(readStoredAnalysis(value, contract, [])).toBeNull();
    expect(checkStoredAnalysis(value, contract, [])).toEqual({ ok: false, reason: "unreadable" });
  });
});
