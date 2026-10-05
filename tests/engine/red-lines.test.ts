import { describe, expect, it } from "vitest";
import { analyse } from "@/lib/engine/analyse";
import { describeRedLine, findBreaches, parseRedLine, parseRedLines } from "@/lib/engine/red-lines";
import { checkStoredAnalysis } from "@/lib/engine/stored";
import type { Flag, RedLine } from "@/lib/engine/types";
import { loadFixture } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import { analysisPayload, clauseById, scriptedClient } from "../support/model-payloads";

// Red lines drive the analysis (#10, ADR 0003). The scripted client stands in
// for the model only: the citation check, the exposure check, the breach rule
// and the tier rule run for real. A breach is worked out in code from the
// words a flag's citation states, never taken from the model, and a breach
// always puts the flag in Negotiate before signing.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const { text: cleanText, sidecar: cleanSidecar } = loadFixture("clean-document");

const noticeMax = (value: number): RedLine => ({ clauseType: "notice_window", limit: { kind: "max_days", value } });
const noAutoRenewal: RedLine = { clauseType: "auto_renewal", limit: { kind: "not_allowed" } };

async function run(redLines: RedLine[], payload: unknown = analysisPayload(sidecar), text = contract) {
  const client = scriptedClient(payload);
  const result = await analyse({ text, redLines, client });
  expectCitationsVerbatim(result.analysis, text);
  for (const flag of result.analysis.flags) {
    for (const breach of flag.redLineBreaches) if (breach.cited !== null) expect(flag.citation.text).toContain(breach.cited);
  }
  return { ...result, client };
}

const flagFor = (flags: Flag[], id: string) => {
  const flag = flags.find((f) => f.citation.text === clauseById(sidecar, id).sentence);
  if (!flag) throw new Error(`no flag for ${id}`);
  return flag;
};

describe("a red-line breach puts a flag in Negotiate before signing", () => {
  it("lifts the benign Know before signing auto-renewal when the buyer allows no auto-renewal", async () => {
    // c7, the Priority Support add-on, cites no sum, period or fee and reads one way.
    const payload = analysisPayload(sidecar, { omit: ["c1", "c2", "c3", "c4", "c5", "c6"], outsideTerms: [] });

    const without = await run([], payload);
    expect(flagFor(without.analysis.flags, "c7").tier).toBe("know");
    expect(without.analysis.outcome.clean).toBe(true);

    const { analysis } = await run([noAutoRenewal], payload);
    const flag = flagFor(analysis.flags, "c7");
    expect(flag.tier).toBe("negotiate");
    expect(flag.redLineBreaches).toEqual([{ redLine: noAutoRenewal, cited: null }]);
    expect(analysis.outcome).toEqual({ clean: false, negotiateFlags: 1, outsideTermsNotices: 0 });
  });

  it("names the red line each breaching flag breaches, and only that red line", async () => {
    const lockIn: RedLine = { clauseType: "multi_year_term", limit: { kind: "max_months", value: 24 } };
    const { analysis } = await run([noticeMax(60), noAutoRenewal, lockIn]);
    expect(flagFor(analysis.flags, "c4").redLineBreaches.map((b) => describeRedLine(b.redLine))).toEqual([
      "No notice window longer than 60 days",
    ]);
    expect(flagFor(analysis.flags, "c1").redLineBreaches).toEqual([{ redLine: lockIn, cited: "thirty-six (36) months" }]);
    for (const id of ["c2", "c7"]) expect(flagFor(analysis.flags, id).redLineBreaches).toEqual([{ redLine: noAutoRenewal, cited: null }]);
    for (const id of ["c3", "c5", "c6"]) expect(flagFor(analysis.flags, id).redLineBreaches).toEqual([]);
  });

  it("leaves every flag without a breach when the buyer has no red lines", async () => {
    const { analysis } = await run([]);
    for (const flag of analysis.flags) expect(flag.redLineBreaches).toEqual([]);
  });
});

describe("figure limits are checked against the figure the citation states", () => {
  it("a 90-day notice window breaches a 60-day limit, citing the words that state it", async () => {
    const { analysis } = await run([noticeMax(60)]);
    const flag = flagFor(analysis.flags, "c4");
    expect(flag.redLineBreaches).toEqual([{ redLine: noticeMax(60), cited: "ninety (90) days" }]);
    expect(flag.tier).toBe("negotiate");
  });

  it("a 90-day notice window does not breach a 120-day or a 90-day limit", async () => {
    for (const limit of [120, 90]) {
      const { analysis } = await run([noticeMax(limit)]);
      expect(flagFor(analysis.flags, "c4").redLineBreaches).toEqual([]);
    }
  });

  it("claims no breach when the figure is not in the cited text", async () => {
    const c4 = clauseById(sidecar, "c4");
    // The model leaves the notice period out of the exposure: nothing cited, nothing claimed.
    const unstated = analysisPayload(sidecar, {
      clauseTypes: ["notice_window"],
      map: (item) => ({ ...item, exposure: { money: null, lock_in: null, exit_difficulty: "by certified mail" } }),
    });
    let flag = flagFor((await run([noticeMax(60)], unstated)).analysis.flags, "c4");
    expect(flag.redLineBreaches).toEqual([]);
    expect(flag.tier).toBe("know");

    // The model reports a figure the sentence doesn't state: the fragment fails the exposure check, so no breach.
    const invented = analysisPayload(sidecar, {
      clauseTypes: ["notice_window"],
      map: (item) => ({ ...item, exposure: { money: null, lock_in: null, exit_difficulty: "one hundred twenty (120) days" } }),
    });
    flag = flagFor((await run([noticeMax(60)], invented)).analysis.flags, "c4");
    expect(c4.sentence).not.toContain("120");
    expect(flag.redLineBreaches).toEqual([]);
    expect(flag.exposure).toEqual({});
  });

  it("checks a lock-in or renewal term in months, and leaves a percentage fee unclaimed against a dollar limit", async () => {
    const rolloverMax: RedLine = { clauseType: "rollover", limit: { kind: "max_months", value: 12 } };
    const feeMax: RedLine = { clauseType: "early_termination_fee", limit: { kind: "max_dollars", value: 5000 } };
    const { analysis } = await run([rolloverMax, feeMax]);
    expect(flagFor(analysis.flags, "c3").redLineBreaches).toEqual([{ redLine: rolloverMax, cited: "thirty-six (36) months" }]);
    // c6 is a rollover with no cited term: nothing to compare.
    expect(flagFor(analysis.flags, "c6").redLineBreaches).toEqual([]);
    // c5's fee is "one hundred percent (100%) of the Subscription Fees remaining": no dollar sum is cited.
    expect(flagFor(analysis.flags, "c5").redLineBreaches).toEqual([]);

    const sameTerm: RedLine = { clauseType: "rollover", limit: { kind: "max_months", value: 36 } };
    expect(flagFor((await run([sameTerm])).analysis.flags, "c3").redLineBreaches).toEqual([]);
  });

  it("leaves a clean document clean, whatever the red lines", async () => {
    const { analysis } = await run(
      [noAutoRenewal, noticeMax(1), { clauseType: "early_termination_fee", limit: { kind: "not_allowed" } }],
      analysisPayload(cleanSidecar),
      cleanText,
    );
    expect(analysis.outcome.clean).toBe(true);
  });
});

describe("findBreaches reads figures from the cited words", () => {
  const flag = (clauseType: Flag["clauseType"], exposure: Flag["exposure"]) => ({ clauseType, exposure });

  it("reads days, weeks, months and years in digits, in words, or both", () => {
    const sixty = noticeMax(60);
    expect(findBreaches(flag("notice_window", { exitDifficulty: "at least ninety (90) days before renewal" }), [sixty])).toHaveLength(1);
    expect(findBreaches(flag("notice_window", { exitDifficulty: "at least 61 days' notice" }), [sixty])).toHaveLength(1);
    expect(findBreaches(flag("notice_window", { exitDifficulty: "at least sixty (60) days" }), [sixty])).toEqual([]);
    expect(findBreaches(flag("notice_window", { exitDifficulty: "one hundred twenty (120) days" }), [noticeMax(119)])).toEqual([
      { redLine: noticeMax(119), cited: "one hundred twenty (120) days" },
    ]);
    expect(findBreaches(flag("notice_window", { exitDifficulty: "nine (9) weeks before the end" }), [sixty])).toEqual([
      { redLine: sixty, cited: "nine (9) weeks" },
    ]);
    expect(findBreaches(flag("notice_window", { exitDifficulty: "three months before the end" }), [sixty])).toHaveLength(1);
    // Two months could be 59 days: not certain, so not claimed.
    expect(findBreaches(flag("notice_window", { exitDifficulty: "two (2) months before the end" }), [sixty])).toEqual([]);

    const year: RedLine = { clauseType: "multi_year_term", limit: { kind: "max_months", value: 12 } };
    expect(findBreaches(flag("multi_year_term", { lockIn: "thirty-six (36) months" }), [year])).toHaveLength(1);
    expect(findBreaches(flag("multi_year_term", { lockIn: "a 36-month term" }), [year])).toEqual([{ redLine: year, cited: "36-month" }]);
    expect(findBreaches(flag("multi_year_term", { lockIn: "five (5) years" }), [year])).toHaveLength(1);
    expect(findBreaches(flag("multi_year_term", { lockIn: "one (1) year" }), [year])).toEqual([]);
    expect(findBreaches(flag("auto_renewal", { lockIn: "successive twelve (12) month terms" }), [{ ...year, clauseType: "auto_renewal" }])).toEqual([]);
  });

  it("reads dollar fees with the money parser, and never a share", () => {
    const fee: RedLine = { clauseType: "early_termination_fee", limit: { kind: "max_dollars", value: 10_000 } };
    expect(findBreaches(flag("early_termination_fee", { money: "a termination fee of $25,000" }), [fee])).toEqual([
      { redLine: fee, cited: "a termination fee of $25,000" },
    ]);
    expect(findBreaches(flag("early_termination_fee", { exitDifficulty: "$10,000" }), [fee])).toEqual([]);
    expect(findBreaches(flag("early_termination_fee", { money: "50% of the remaining fees" }), [fee])).toEqual([]);
  });

  it("checks a red line only against flags of its own clause type", () => {
    expect(findBreaches(flag("rollover", { exitDifficulty: "ninety (90) days" }), [noticeMax(60), noAutoRenewal])).toEqual([]);
  });
});

describe("the red lines reach the model", () => {
  it("lists each red line in the request, so the model points at the figures they need", async () => {
    const lockIn: RedLine = { clauseType: "multi_year_term", limit: { kind: "max_months", value: 24 } };
    const { client } = await run([noticeMax(60), lockIn]);
    const prompt = client.requests[0].messages.map((m) => m.content).join("\n");
    expect(prompt).toContain("notice_window: No notice window longer than 60 days");
    expect(prompt).toContain("multi_year_term: No lock-in longer than 24 months");
  });
});

describe("a stored analysis is checked against the red lines it ran with", () => {
  type Stored = { flags: (Record<string, unknown> & { citation: { text: string } })[] };
  const stored = async (redLines: RedLine[]) =>
    JSON.parse(JSON.stringify((await run(redLines)).analysis)) as Stored & Record<string, unknown>;
  const storedFlag = (s: Stored, id: string) => s.flags.find((f) => f.citation.text === clauseById(sidecar, id).sentence)!;

  it("works breaches and tiers out again from the snapshot, never from the stored flag", async () => {
    const payload = analysisPayload(sidecar, { omit: ["c1", "c2", "c3", "c4", "c5", "c6"], outsideTerms: [] });
    const saved = JSON.parse(JSON.stringify((await run([noAutoRenewal], payload)).analysis));

    const read = checkStoredAnalysis(saved, contract, [noAutoRenewal]);
    expect(read.ok && flagFor(read.analysis.flags, "c7").tier).toBe("negotiate");
    expect(read.ok && read.redLines).toEqual([noAutoRenewal]);

    // A stored breach with no red line behind it in the snapshot is not shown.
    const noSnapshot = checkStoredAnalysis(saved, contract, []);
    expect(noSnapshot.ok && flagFor(noSnapshot.analysis.flags, "c7")).toMatchObject({ tier: "know", redLineBreaches: [] });
    expect(noSnapshot.ok && noSnapshot.analysis.outcome.clean).toBe(true);

    // A snapshot breach the stored flag left out is worked out again.
    storedFlag(saved, "c7").redLineBreaches = [];
    storedFlag(saved, "c7").tier = "know";
    const again = checkStoredAnalysis(saved, contract, [noAutoRenewal]);
    expect(again.ok && flagFor(again.analysis.flags, "c7").redLineBreaches).toEqual([{ redLine: noAutoRenewal, cited: null }]);
  });

  it("reads back an analysis unchanged when its snapshot is the red lines it ran with", async () => {
    const redLines = [noticeMax(60), noAutoRenewal];
    const saved = await stored(redLines);
    const read = checkStoredAnalysis(saved, contract, JSON.parse(JSON.stringify(redLines)));
    expect(read.ok && read.analysis).toEqual(saved);
  });

  it("refuses to show an analysis whose snapshot is not a list of valid red lines", async () => {
    const saved = await stored([]);
    for (const snapshot of [null, {}, [{ clauseType: "liability_cap", limit: { kind: "not_allowed" } }], [{ clauseType: "notice_window", limit: { kind: "max_months", value: 3 } }]]) {
      expect(checkStoredAnalysis(saved, contract, snapshot)).toEqual({ ok: false, reason: "unreadable" });
    }
  });
});

describe("red line shape", () => {
  it("accepts a limit only of a kind its clause type takes, with a whole value in range", () => {
    expect(parseRedLine({ clauseType: "notice_window", limit: { kind: "max_days", value: 60 } })).toEqual(noticeMax(60));
    expect(parseRedLine({ id: "x", clauseType: "auto_renewal", limit: { kind: "not_allowed" } })).toEqual({ ...noAutoRenewal, id: "x" });
    for (const bad of [
      { clauseType: "notice_window", limit: { kind: "max_dollars", value: 60 } },
      { clauseType: "early_termination_fee", limit: { kind: "max_days", value: 60 } },
      { clauseType: "notice_window", limit: { kind: "max_days", value: 0 } },
      { clauseType: "notice_window", limit: { kind: "max_days", value: 60.5 } },
      { clauseType: "notice_window", limit: { kind: "max_days", value: 99999 } },
      { clauseType: "notice_window", limit: { kind: "max_days", value: "60" } },
      { clauseType: "notice_window", limit: "no notice window longer than 60 days" },
      { clauseType: "indemnity", limit: { kind: "not_allowed" } },
    ]) {
      expect(parseRedLine(bad)).toBeNull();
    }
    expect(parseRedLines([noticeMax(60), { clauseType: "x" }])).toBeNull();
    expect(parseRedLines([])).toEqual([]);
  });

  it("puts each red line in plain words", () => {
    expect(describeRedLine(noticeMax(60))).toBe("No notice window longer than 60 days");
    expect(describeRedLine(noticeMax(1))).toBe("No notice window longer than 1 day");
    expect(describeRedLine(noAutoRenewal)).toBe("No auto-renewal");
    expect(describeRedLine({ clauseType: "auto_renewal", limit: { kind: "max_months", value: 12 } })).toBe(
      "No auto-renewal term longer than 12 months",
    );
    expect(describeRedLine({ clauseType: "rollover", limit: { kind: "max_months", value: 1 } })).toBe("No rollover term longer than 1 month");
    expect(describeRedLine({ clauseType: "early_termination_fee", limit: { kind: "max_dollars", value: 25000 } })).toBe(
      "No early termination fee over $25,000",
    );
    expect(describeRedLine({ clauseType: "multi_year_term", limit: { kind: "not_allowed" } })).toBe("No multi-year term");
  });
});
