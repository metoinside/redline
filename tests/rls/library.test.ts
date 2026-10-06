import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { analysisHistory } from "@/lib/documents/history";
import { runSavedAnalysis } from "@/lib/documents/saved-run";
import { describeRedLine } from "@/lib/engine/red-lines";
import { RED_LINE_COLUMNS } from "@/lib/red-lines/rows";
import { loadFixture } from "../fixtures/index";
import { analysisPayload, scriptedClient } from "../support/model-payloads";
import { asUser, createDatabase, createUser } from "./harness";

// The library (#11), run on the real migration SQL in Postgres (PGlite), as
// Supabase would run each query for a signed-in buyer:
//  - deleting a document is owner-only, and takes its analyses and questions
//    with it (the foreign keys cascade);
//  - an analysis keeps the red lines it ran with: later edits to red_lines
//    don't touch the snapshot, and the library history reads the snapshot.

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const RESULT = JSON.stringify({ schemaVersion: 1, flags: [] });
const ANSWER = JSON.stringify({ schemaVersion: 1, kind: "not-said" });

let db: PGlite;

type Owned = { doc: string; analysis: string; question: string };
let a: Owned;
let b: Owned;

async function addOwned(owner: string, title: string): Promise<Owned> {
  return asUser(
    db,
    owner,
    async (tx) => {
      const doc = (
        await tx.query<{ id: string }>(
          "insert into public.documents (title, body, source_kind) values ($1, $2, 'paste') returning id",
          [title, `${title} body text.`],
        )
      ).rows[0].id;
      const analysis = (
        await tx.query<{ id: string }>("insert into public.analyses (document_id, result) values ($1, $2::jsonb) returning id", [doc, RESULT])
      ).rows[0].id;
      const question = (
        await tx.query<{ id: string }>(
          "insert into public.questions (document_id, question, result) values ($1, 'How do I cancel?', $2::jsonb) returning id",
          [doc, ANSWER],
        )
      ).rows[0].id;
      return { doc, analysis, question };
    },
    { commit: true },
  );
}

/** What is really in the tables, with no policies in the way. */
async function exists(table: "documents" | "analyses" | "questions", id: string): Promise<boolean> {
  const { rows } = await db.query(`select 1 from public.${table} where id = $1`, [id]);
  return rows.length === 1;
}

const deleteDocumentAs = (user: string, id: string) =>
  asUser(db, user, async (tx) => (await tx.query("delete from public.documents where id = $1", [id])).affectedRows, { commit: true });

beforeAll(async () => {
  db = await createDatabase();
  await createUser(db, A, "a@example.com");
  await createUser(db, B, "b@example.com");
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec("delete from public.questions; delete from public.analyses; delete from public.documents; delete from public.red_lines;");
  a = await addOwned(A, "A's cleaning contract");
  b = await addOwned(B, "B's software subscription");
});

describe("deleting a document", () => {
  it("A cannot delete B's document, and B's analyses and questions survive the attempt", async () => {
    expect(await deleteDocumentAs(A, b.doc)).toBe(0);
    expect(await exists("documents", b.doc)).toBe(true);
    expect(await exists("analyses", b.analysis)).toBe(true);
    expect(await exists("questions", b.question)).toBe(true);
  });

  it("A cannot delete B's document even by naming B as the owner", async () => {
    const affected = await asUser(
      db,
      A,
      async (tx) => (await tx.query("delete from public.documents where id = $1 and user_id = $2", [b.doc, B])).affectedRows,
      { commit: true },
    );
    expect(affected).toBe(0);
    expect(await exists("documents", b.doc)).toBe(true);
  });

  it("when A deletes A's own document, its text, analyses and questions are gone, and B's are untouched", async () => {
    expect(await deleteDocumentAs(A, a.doc)).toBe(1);
    expect(await exists("documents", a.doc)).toBe(false);
    expect(await exists("analyses", a.analysis)).toBe(false);
    expect(await exists("questions", a.question)).toBe(false);

    expect(await exists("documents", b.doc)).toBe(true);
    expect(await exists("analyses", b.analysis)).toBe(true);
    expect(await exists("questions", b.question)).toBe(true);
  });

  it("a deleted document's runs no longer show up for its owner", async () => {
    await deleteDocumentAs(A, a.doc);
    const seen = await asUser(db, A, async (tx) => ({
      documents: (await tx.query("select id from public.documents")).rows,
      analyses: (await tx.query("select id from public.analyses")).rows,
      questions: (await tx.query("select id from public.questions")).rows,
    }));
    expect(seen).toEqual({ documents: [], analyses: [], questions: [] });
  });
});

describe("an analysis's red-line snapshot", () => {
  const { text: contract, sidecar } = loadFixture("adhesion-contract");
  // Only the benign auto-renewal clause (Know before signing on its own), and no outside terms.
  const payload = () => analysisPayload(sidecar, { omit: ["c1", "c2", "c3", "c4", "c5", "c6"], outsideTerms: [] });

  it("is unaffected by later edits to red_lines, and the library history reads it", async () => {
    const { doc, lines } = await asUser(
      db,
      A,
      async (tx) => {
        const docId = (
          await tx.query<{ id: string }>(
            "insert into public.documents (title, body, source_kind) values ('Halvard MSA', $1, 'paste') returning id",
            [contract],
          )
        ).rows[0].id;
        await tx.query("insert into public.red_lines (clause_type, limit_kind, limit_value) values ('auto_renewal', 'not_allowed', null)");
        await tx.query("insert into public.red_lines (clause_type, limit_kind, limit_value) values ('notice_window', 'max_days', 60)");
        const rows = (await tx.query(`select ${RED_LINE_COLUMNS} from public.red_lines order by created_at`)).rows;
        return { doc: docId, lines: rows };
      },
      { commit: true },
    );

    // The run the server action makes: the buyer's red lines go in, and the row keeps a snapshot of them.
    const saved = await runSavedAnalysis({ documentId: doc, body: contract, redLineRows: lines, client: scriptedClient(payload()) });
    if (!saved.ok) throw new Error("red lines unreadable");
    const snapshot = saved.run.redLines.map(describeRedLine);
    expect(snapshot).toEqual(["No auto-renewal", "No notice window longer than 60 days"]);

    const analysisId = await asUser(
      db,
      A,
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            "insert into public.analyses (document_id, result, red_lines) values ($1, $2::jsonb, $3::jsonb) returning id",
            [doc, JSON.stringify(saved.run.insert.result), JSON.stringify(saved.run.insert.red_lines)],
          )
        ).rows[0].id,
      { commit: true },
    );

    // The buyer changes one red line and deletes the other.
    await asUser(
      db,
      A,
      async (tx) => {
        await tx.query("update public.red_lines set limit_value = 30 where clause_type = 'notice_window'");
        await tx.query("delete from public.red_lines where clause_type = 'auto_renewal'");
      },
      { commit: true },
    );

    const row = await asUser(db, A, async (tx) => {
      const { rows } = await tx.query<{ id: string; created_at: Date; result: unknown; red_lines: unknown }>(
        "select id, created_at, result, red_lines from public.analyses where id = $1",
        [analysisId],
      );
      return rows[0];
    });
    expect(row.red_lines).toEqual(saved.run.insert.red_lines);

    const [entry] = analysisHistory([{ ...row, created_at: row.created_at.toISOString() }], contract);
    expect(entry.redLines!.map(describeRedLine)).toEqual(snapshot);
    // The snapshot's "No auto-renewal" still puts the benign renewal in the top tier,
    // although the buyer has since deleted that red line.
    expect(entry.result).toEqual({ kind: "flags", negotiate: 1, know: 0, outsideTerms: 0 });
  });
});
