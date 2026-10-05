import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asAnon, asUser, createDatabase, createUser } from "./harness";

// Row-level security on analyses, run on the real migration SQL in Postgres
// (PGlite). Each query runs as Supabase would run it for a signed-in buyer.
// An analysis is a record of one run: its owner can read and delete it, never
// change it, and can only attach it to a document they own.

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const RESULT = JSON.stringify({ schemaVersion: 1, flags: [] });

let db: PGlite;
let aDoc: string;
let bDoc: string;
let aAnalysis: string;
let bAnalysis: string;

async function addDocument(owner: string, title: string): Promise<string> {
  return asUser(
    db,
    owner,
    async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.documents (title, body, source_kind) values ($1, $2, 'paste') returning id",
        [title, `${title} body text.`],
      );
      return rows[0].id;
    },
    { commit: true },
  );
}

async function addAnalysis(owner: string, documentId: string): Promise<string> {
  return asUser(
    db,
    owner,
    async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.analyses (document_id, result) values ($1, $2::jsonb) returning id",
        [documentId, RESULT],
      );
      return rows[0].id;
    },
    { commit: true },
  );
}

/** Reads a row with no policies in the way, to see what really happened. */
async function rawAnalysis(id: string) {
  const { rows } = await db.query<{ user_id: string; document_id: string; result: unknown }>(
    "select user_id, document_id, result from public.analyses where id = $1",
    [id],
  );
  return rows[0];
}

beforeAll(async () => {
  db = await createDatabase();
  await createUser(db, A, "a@example.com");
  await createUser(db, B, "b@example.com");
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec("delete from public.analyses; delete from public.documents;");
  aDoc = await addDocument(A, "A's cleaning contract");
  bDoc = await addDocument(B, "B's software subscription");
  aAnalysis = await addAnalysis(A, aDoc);
  bAnalysis = await addAnalysis(B, bDoc);
});

describe("analyses row-level security, user A against user B's rows", () => {
  it("A cannot read B's analyses", async () => {
    const ids = await asUser(db, A, async (tx) => {
      const { rows } = await tx.query<{ id: string }>("select id from public.analyses");
      return rows.map((r) => r.id);
    });
    expect(ids).toEqual([aAnalysis]);

    const byDocument = await asUser(db, A, async (tx) => {
      const { rows } = await tx.query("select * from public.analyses where document_id = $1", [bDoc]);
      return rows;
    });
    expect(byDocument).toEqual([]);
  });

  it("A cannot change B's analyses", async () => {
    await expect(
      asUser(db, A, (tx) => tx.query("update public.analyses set result = '{}'::jsonb where id = $1", [bAnalysis])),
    ).rejects.toThrow(/permission denied/);
    expect((await rawAnalysis(bAnalysis)).result).toEqual(JSON.parse(RESULT));
  });

  it("A cannot delete B's analyses", async () => {
    const affected = await asUser(
      db,
      A,
      async (tx) => (await tx.query("delete from public.analyses where id = $1", [bAnalysis])).affectedRows,
      { commit: true },
    );
    expect(affected).toBe(0);
    expect(await rawAnalysis(bAnalysis)).toBeDefined();
  });

  it("A cannot attach an analysis to B's document", async () => {
    await expect(
      asUser(db, A, (tx) =>
        tx.query("insert into public.analyses (document_id, result) values ($1, $2::jsonb)", [bDoc, RESULT]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("A cannot save an analysis as B's, on either document", async () => {
    for (const doc of [aDoc, bDoc]) {
      await expect(
        asUser(db, A, (tx) =>
          tx.query("insert into public.analyses (user_id, document_id, result) values ($1, $2, $3::jsonb)", [B, doc, RESULT]),
        ),
      ).rejects.toThrow(/row-level security/);
    }
  });
});

describe("analyses for their owner", () => {
  it("A can save an analysis of A's document and read it back with its run date and red lines", async () => {
    const row = await asUser(db, A, async (tx) => {
      const inserted = await tx.query<{ id: string; user_id: string; created_at: Date; red_lines: unknown; result: unknown }>(
        "insert into public.analyses (document_id, result) values ($1, $2::jsonb) returning id, user_id, created_at, red_lines, result",
        [aDoc, RESULT],
      );
      return inserted.rows[0];
    });
    expect(row.user_id).toBe(A);
    expect(row.created_at).toBeInstanceOf(Date);
    expect(row.red_lines).toEqual([]);
    expect(row.result).toEqual(JSON.parse(RESULT));
  });

  it("A can delete A's own analysis but not change it", async () => {
    await expect(
      asUser(db, A, (tx) => tx.query("update public.analyses set result = '{}'::jsonb where id = $1", [aAnalysis])),
    ).rejects.toThrow(/permission denied/);
    const deleted = await asUser(
      db,
      A,
      async (tx) => (await tx.query("delete from public.analyses where id = $1", [aAnalysis])).affectedRows,
      { commit: true },
    );
    expect(deleted).toBe(1);
  });

  it("deleting a document deletes its analyses", async () => {
    await asUser(db, A, (tx) => tx.query("delete from public.documents where id = $1", [aDoc]), { commit: true });
    expect(await rawAnalysis(aAnalysis)).toBeUndefined();
    expect(await rawAnalysis(bAnalysis)).toBeDefined();
  });

  it("refuses a result that is not a JSON object, or red lines that are not a list", async () => {
    const insert = (result: string, redLines: string) =>
      asUser(db, A, (tx) =>
        tx.query("insert into public.analyses (document_id, result, red_lines) values ($1, $2::jsonb, $3::jsonb)", [aDoc, result, redLines]),
      );
    await expect(insert("[]", "[]")).rejects.toThrow(/analyses_result_object_check/);
    await expect(insert(RESULT, "{}")).rejects.toThrow(/analyses_red_lines_array_check/);
    await expect(insert(RESULT, "[]")).resolves.toBeDefined();
  });
});

describe("analyses for signed-out visitors", () => {
  it("anon cannot read or write analyses at all", async () => {
    await expect(asAnon(db, (tx) => tx.query("select * from public.analyses"))).rejects.toThrow(/permission denied/);
    await expect(
      asAnon(db, (tx) =>
        tx.query("insert into public.analyses (user_id, document_id, result) values ($1, $2, $3::jsonb)", [A, aDoc, RESULT]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
