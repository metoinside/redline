import { describe, expect, it } from "vitest";
import { runSavedAnalysis } from "@/lib/documents/saved-run";
import { describeRedLine } from "@/lib/engine/red-lines";
import { checkStoredAnalysis } from "@/lib/engine/stored";
import { loadFixture } from "../fixtures/index";
import { expectCitationsVerbatim } from "../support/citations";
import { analysisPayload, clauseById, scriptedClient } from "../support/model-payloads";

// What "Analyse" and "Analyse again" on a saved document run: the buyer's
// current red lines, as rows from the red_lines table, go into the analysis
// and the model request, and the saved row carries a snapshot of them. The
// server action loads the rows under row-level security and calls this; with
// no Supabase project, the rows are given here in the shape the table returns.

const { text: contract, sidecar } = loadFixture("adhesion-contract");
const DOC = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const rows = [
  { id: "11111111-1111-4111-8111-111111111111", clause_type: "notice_window", limit_kind: "max_days", limit_value: 60, created_at: "2026-10-06T09:00:00+00:00", updated_at: "2026-10-06T09:00:00+00:00" },
  { id: "22222222-2222-4222-8222-222222222222", clause_type: "auto_renewal", limit_kind: "not_allowed", limit_value: null, created_at: "2026-10-06T09:01:00+00:00", updated_at: "2026-10-06T09:05:00+00:00" },
];

describe("running an analysis of a saved document", () => {
  it("passes the buyer's current red lines to the model and the breach rule, and saves the snapshot", async () => {
    const client = scriptedClient(analysisPayload(sidecar));
    const result = await runSavedAnalysis({ documentId: DOC, body: contract, redLineRows: rows, client });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { run } = result;

    const prompt = client.requests[0].messages.map((m) => m.content).join("\n");
    expect(prompt).toContain("notice_window: No notice window longer than 60 days");
    expect(prompt).toContain("auto_renewal: No auto-renewal");

    expect(run.redLines).toEqual([
      { id: rows[0].id, clauseType: "notice_window", limit: { kind: "max_days", value: 60 } },
      { id: rows[1].id, clauseType: "auto_renewal", limit: { kind: "not_allowed" } },
    ]);
    const notice = run.analysis.flags.find((f) => f.citation.text === clauseById(sidecar, "c4").sentence)!;
    expect(notice.redLineBreaches.map((b) => describeRedLine(b.redLine))).toEqual(["No notice window longer than 60 days"]);
    const addOn = run.analysis.flags.find((f) => f.citation.text === clauseById(sidecar, "c7").sentence)!;
    expect(addOn.tier).toBe("negotiate");
    expectCitationsVerbatim(run.analysis, contract);

    expect(run.insert).toEqual({ document_id: DOC, result: run.analysis, red_lines: run.redLines });
    // The saved row reads back the same, breaches worked out again from its own snapshot.
    const stored = JSON.parse(JSON.stringify(run.insert));
    const read = checkStoredAnalysis(stored.result, contract, stored.red_lines);
    expect(read.ok && read.analysis).toEqual(run.analysis);
  });

  it("runs with no red lines, and saves an empty snapshot, when the buyer has none", async () => {
    const client = scriptedClient(analysisPayload(sidecar));
    const result = await runSavedAnalysis({ documentId: DOC, body: contract, redLineRows: [], client });
    expect(result.ok && result.run.insert.red_lines).toEqual([]);
    expect(client.requests[0].messages.at(-1)!.content).toContain("- none");
  });

  it("does not run, and calls nothing, when a red line row can't be read", async () => {
    for (const bad of [null, [{ ...rows[0], limit_kind: "max_months" }], [{ ...rows[0], clause_type: "indemnity" }], [{ ...rows[0], limit_value: "60" }]]) {
      const client = scriptedClient(analysisPayload(sidecar));
      expect(await runSavedAnalysis({ documentId: DOC, body: contract, redLineRows: bad, client })).toEqual({
        ok: false,
        reason: "red-lines-unreadable",
      });
      expect(client.requests).toHaveLength(0);
    }
  });
});
