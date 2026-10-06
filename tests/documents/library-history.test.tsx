import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { deleteDocument } from "@/app/(app)/documents/actions";
import { AnalysedDocument, type AnalysisSource } from "@/app/(app)/documents/analysed-document";
import { HISTORY_COPY } from "@/app/(app)/documents/analysis-copy";
import { DeleteDocument } from "@/app/(app)/documents/delete-document";
import { DELETE_COPY, LIBRARY_COPY, RESULT_COPY } from "@/app/(app)/library/library-copy";
import { LibraryList } from "@/app/(app)/library/library-list";
import { analysisHistory, type AnalysisRow } from "@/lib/documents/history";
import { analyse } from "@/lib/engine/analyse";
import { describeRedLine } from "@/lib/engine/red-lines";
import type { Analysis, RedLine } from "@/lib/engine/types";
import { loadFixture } from "../fixtures/index";
import { analysisPayload, scriptedClient } from "../support/model-payloads";

// The library's analysis history (#11): each saved run of a document, newest
// first, with its run date, the red lines from its own snapshot, and what it
// found, worked out again from the stored result against the document text.
// A run that fails the re-check needs a re-run and shows no result. Opening
// an older run on the document page says so, with the red lines it used.

beforeAll(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

const { text: contract, sidecar } = loadFixture("adhesion-contract");

const NO_AUTO_RENEWAL: RedLine = { id: "r1", clauseType: "auto_renewal", limit: { kind: "not_allowed" } };
const SIXTY_DAYS: RedLine = { id: "r2", clauseType: "notice_window", limit: { kind: "max_days", value: 60 } };

/** Only the benign auto-renewal clause (Know before signing on its own), and no outside terms: a clean result with no red lines. */
const benignOnly = () => analysisPayload(sidecar, { omit: ["c1", "c2", "c3", "c4", "c5", "c6"], outsideTerms: [] });

/** A run as the analyses table stores it: the analysis as JSON and the red lines it ran with. */
async function storedRow(id: string, createdAt: string, redLines: RedLine[], payload: unknown = analysisPayload(sidecar)): Promise<AnalysisRow> {
  const { analysis } = await analyse({ text: contract, redLines, client: scriptedClient(payload) });
  return { id, created_at: createdAt, result: JSON.parse(JSON.stringify(analysis)), red_lines: JSON.parse(JSON.stringify(redLines)) };
}

const decode = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("analysisHistory", () => {
  it("lists runs newest first, each with its run date", async () => {
    const rows = [
      await storedRow("11111111-1111-4111-8111-111111111111", "2026-10-01T09:00:00Z", []),
      await storedRow("33333333-3333-4333-8333-333333333333", "2026-10-05T09:00:00Z", []),
      await storedRow("22222222-2222-4222-8222-222222222222", "2026-10-03T09:00:00Z", []),
    ];
    const history = analysisHistory(rows, contract);
    expect(history.map((e) => e.ranAt)).toEqual(["2026-10-05T09:00:00.000Z", "2026-10-03T09:00:00.000Z", "2026-10-01T09:00:00.000Z"]);
  });

  it("shows the red lines from each run's own snapshot, and works its tiers out from that snapshot", async () => {
    const before = await storedRow("11111111-1111-4111-8111-111111111111", "2026-10-01T09:00:00Z", [], benignOnly());
    const after = await storedRow("22222222-2222-4222-8222-222222222222", "2026-10-02T09:00:00Z", [NO_AUTO_RENEWAL, SIXTY_DAYS], benignOnly());
    const [newer, older] = analysisHistory([before, after], contract);

    expect(older.redLines).toEqual([]);
    expect(older.result).toEqual({ kind: "clean" });
    expect(newer.redLines!.map(describeRedLine)).toEqual(["No auto-renewal", "No notice window longer than 60 days"]);
    expect(newer.result).toEqual({ kind: "flags", negotiate: 1, know: 0, outsideTerms: 0 });
  });

  it("works tiers and the clean result out again, never reading them from storage", async () => {
    const row = await storedRow("11111111-1111-4111-8111-111111111111", "2026-10-01T09:00:00Z", []);
    const fresh = analysisHistory([row], contract)[0].result;
    expect(fresh).toEqual({ kind: "flags", negotiate: 6, know: 1, outsideTerms: 1 });

    const stored = row.result as { flags: { tier: string; redLineBreaches: unknown[] }[]; outcome: unknown };
    for (const flag of stored.flags) {
      flag.tier = "know";
      flag.redLineBreaches = [];
    }
    stored.outcome = { clean: true, checklist: [] };
    expect(analysisHistory([row], contract)[0].result).toEqual(fresh);
  });

  it("counts only the flags whose citations still check out against the text", async () => {
    const row = await storedRow("11111111-1111-4111-8111-111111111111", "2026-10-01T09:00:00Z", []);
    const stored = row.result as { flags: { citation: { start: number } }[] };
    stored.flags[0].citation.start += 1;
    const { result } = analysisHistory([row], contract)[0];
    expect(result.kind === "flags" && result.negotiate + result.know).toBe(6);
  });

  it("labels a run that can't be read again as needing a re-run, with no result", async () => {
    const good = await storedRow("11111111-1111-4111-8111-111111111111", "2026-10-01T09:00:00Z", [SIXTY_DAYS]);
    const garbled: AnalysisRow = { ...good, id: "22222222-2222-4222-8222-222222222222", result: { schemaVersion: 5, flags: "nope" } };
    const outdated: AnalysisRow = { ...good, id: "33333333-3333-4333-8333-333333333333", result: { schemaVersion: 1, flags: [] } };
    const badSnapshot: AnalysisRow = { ...good, id: "44444444-4444-4444-8444-444444444444", red_lines: [{ clauseType: "indemnity" }] };
    const hedged = await storedRow("55555555-5555-4555-8555-555555555555", "2026-10-01T09:00:00Z", []);
    (hedged.result as { flags: { statement: string }[] }).flags[0].statement = "This may renew the contract.";

    const byId = new Map(analysisHistory([good, garbled, outdated, badSnapshot, hedged], contract).map((e) => [e.id, e]));
    expect(byId.get(garbled.id)).toMatchObject({ result: { kind: "needs-rerun", reason: "failed" } });
    expect(byId.get(garbled.id)!.redLines!.map(describeRedLine)).toEqual(["No notice window longer than 60 days"]);
    expect(byId.get(outdated.id)).toMatchObject({ result: { kind: "needs-rerun", reason: "outdated" } });
    expect(byId.get(badSnapshot.id)).toMatchObject({ redLines: null, result: { kind: "needs-rerun", reason: "failed" } });
    expect(byId.get(hedged.id)).toMatchObject({ result: { kind: "needs-rerun", reason: "failed" } });
    expect(byId.get(good.id)!.result.kind).toBe("flags");
  });

  it("checks each run against the document it belongs to", async () => {
    const { text: other } = loadFixture("clean-document");
    const row = await storedRow("11111111-1111-4111-8111-111111111111", "2026-10-01T09:00:00Z", []);
    // Beside another text, none of its citations match: nothing to negotiate, and no notice.
    expect(analysisHistory([row], other)[0].result).toEqual({ kind: "clean" });
  });
});

describe("the library list", () => {
  it("shows each run with a link to it, the red lines it ran with and what it found", async () => {
    const rows = [
      await storedRow("11111111-1111-4111-8111-111111111111", "2026-10-01T09:00:00Z", [], benignOnly()),
      await storedRow("22222222-2222-4222-8222-222222222222", "2026-10-02T09:00:00Z", [NO_AUTO_RENEWAL]),
      { id: "33333333-3333-4333-8333-333333333333", created_at: "2026-10-03T09:00:00Z", result: {}, red_lines: [] },
    ];
    const doc = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const html = renderToStaticMarkup(
      <LibraryList documents={[{ id: doc, title: "Halvard MSA", createdAt: "2026-09-30T09:00:00Z", history: analysisHistory(rows, contract) }]} />,
    );
    const runs = [...html.matchAll(/<tr><td[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => ({ html: m[1], text: decode(m[1]) }));
    expect(runs).toHaveLength(3);

    expect(runs.map((r) => r.html.match(/href="([^"]+)"/)![1])).toEqual([
      `/documents/${doc}?analysis=33333333-3333-4333-8333-333333333333`,
      `/documents/${doc}?analysis=22222222-2222-4222-8222-222222222222`,
      `/documents/${doc}?analysis=11111111-1111-4111-8111-111111111111`,
    ]);
    expect(runs[0].text).toContain(LIBRARY_COPY.latest);
    expect(runs[0].text).toContain(RESULT_COPY.rerun);
    expect(runs[0].text).toContain(RESULT_COPY.failed);
    expect(runs[0].text).not.toMatch(/to negotiate|to know|No renewal or exit/);

    expect(runs[1].text).toContain("No auto-renewal");
    expect(runs[1].text).toContain(RESULT_COPY.negotiate(7));
    expect(runs[1].text).toContain("1 outside-terms notice, so not a clean result");

    expect(runs[2].text).toContain(LIBRARY_COPY.noRedLines);
    expect(runs[2].text).toContain(RESULT_COPY.clean);
  });

  it("says when a document hasn't been analysed, and offers to delete each document", () => {
    const html = renderToStaticMarkup(
      <LibraryList documents={[{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", title: "Halvard MSA", createdAt: "2026-09-30T09:00:00Z", history: [] }]} />,
    );
    expect(decode(html)).toContain(LIBRARY_COPY.notAnalysed);
    expect(html).not.toContain("<table");
    expect(html).toContain(`aria-label="${DELETE_COPY.deleteLabel("Halvard MSA")}"`);
  });
});

describe("deleting a document", () => {
  it("asks first: the first press only opens a confirmation on the page", () => {
    const html = renderToStaticMarkup(<DeleteDocument documentId="dddddddd-dddd-4ddd-8ddd-dddddddddddd" title="Halvard MSA" />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="submit"');
  });

  it("deletes nothing on a server without accounts", async () => {
    const form = new FormData();
    form.set("documentId", "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(await deleteDocument({ kind: "idle" }, form)).toEqual({ kind: "error", reason: "accounts-off" });
  });
});

describe("opening a past analysis on the document page", () => {
  async function analysisWith(redLines: RedLine[]): Promise<Analysis> {
    return (await analyse({ text: contract, redLines, client: scriptedClient(benignOnly()) })).analysis;
  }

  function render(source: AnalysisSource) {
    return decode(
      renderToStaticMarkup(
        <AnalysedDocument title="Halvard MSA" body={contract} sourceKind="pdf" addedAt="2026-09-30T09:00:00Z" source={source} modelConfigured />,
      ),
    );
  }

  it("says an older run is older and lists the red lines from its own snapshot", async () => {
    const text = render({
      kind: "saved",
      documentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      run: { analysis: await analysisWith([NO_AUTO_RENEWAL]), ranAt: "2026-10-01T09:00:00Z", redLines: [NO_AUTO_RENEWAL] },
      older: true,
    });
    expect(text).toContain(HISTORY_COPY.older.title);
    expect(text).toContain(`${HISTORY_COPY.older.redLines} No auto-renewal`);
    expect(text).toContain(HISTORY_COPY.older.latest);
  });

  it("says an older run had no red lines when its snapshot was empty", async () => {
    const text = render({
      kind: "saved",
      documentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      run: { analysis: await analysisWith([]), ranAt: "2026-10-01T09:00:00Z", redLines: [] },
      older: true,
    });
    expect(text).toContain(HISTORY_COPY.older.noRedLines);
  });

  it("says nothing about age when the latest run is shown", async () => {
    const text = render({
      kind: "saved",
      documentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      run: { analysis: await analysisWith([]), ranAt: "2026-10-01T09:00:00Z", redLines: [] },
    });
    expect(text).not.toContain(HISTORY_COPY.older.title);
    expect(text).not.toContain(HISTORY_COPY.missing.title);
  });

  it("says so when the link names a run that isn't in the library", async () => {
    const text = render({
      kind: "saved",
      documentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      run: { analysis: await analysisWith([]), ranAt: "2026-10-01T09:00:00Z", redLines: [] },
      missingRun: true,
    });
    expect(text).toContain(HISTORY_COPY.missing.title);
    expect(text).toContain(HISTORY_COPY.missing.bodyLatest);
  });
});
