import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asAnon, asUser, createDatabase, createUser } from "./harness";

// Row-level security on questions, run on the real migration SQL in Postgres
// (PGlite). Each query runs as Supabase would run it for a signed-in buyer.
// A question is a record of one answer the buyer saw: its owner can read and
// delete it, never change it, and can only ask about a document they own.

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const RESULT = JSON.stringify({ schemaVersion: 1, kind: "not-said" });

let db: PGlite;
let aDoc: string;
let bDoc: string;
let aQuestion: string;
let bQuestion: string;

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

async function addQuestion(owner: string, documentId: string, question: string): Promise<string> {
  return asUser(
    db,
    owner,
    async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.questions (document_id, question, result) values ($1, $2, $3::jsonb) returning id",
        [documentId, question, RESULT],
      );
      return rows[0].id;
    },
    { commit: true },
  );
}

/** Reads a row with no policies in the way, to see what really happened. */
async function rawQuestion(id: string) {
  const { rows } = await db.query<{ user_id: string; document_id: string; question: string; result: unknown }>(
    "select user_id, document_id, question, result from public.questions where id = $1",
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
  await db.exec("delete from public.questions; delete from public.documents;");
  aDoc = await addDocument(A, "A's cleaning contract");
  bDoc = await addDocument(B, "B's software subscription");
  aQuestion = await addQuestion(A, aDoc, "How do I cancel?");
  bQuestion = await addQuestion(B, bDoc, "How much is the fee?");
});

describe("questions row-level security, user A against user B's rows", () => {
  it("A cannot read B's questions", async () => {
    const ids = await asUser(db, A, async (tx) => {
      const { rows } = await tx.query<{ id: string }>("select id from public.questions");
      return rows.map((r) => r.id);
    });
    expect(ids).toEqual([aQuestion]);

    const byDocument = await asUser(db, A, async (tx) => {
      const { rows } = await tx.query("select * from public.questions where document_id = $1", [bDoc]);
      return rows;
    });
    expect(byDocument).toEqual([]);
  });

  it("A cannot ask a question against B's document", async () => {
    await expect(
      asUser(db, A, (tx) =>
        tx.query("insert into public.questions (document_id, question, result) values ($1, $2, $3::jsonb)", [bDoc, "Fee?", RESULT]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("A cannot save a question as B's, on either document", async () => {
    for (const doc of [aDoc, bDoc]) {
      await expect(
        asUser(db, A, (tx) =>
          tx.query("insert into public.questions (user_id, document_id, question, result) values ($1, $2, $3, $4::jsonb)", [
            B,
            doc,
            "Fee?",
            RESULT,
          ]),
        ),
      ).rejects.toThrow(/row-level security/);
    }
  });

  it("A cannot change B's questions", async () => {
    await expect(
      asUser(db, A, (tx) => tx.query("update public.questions set question = 'Changed' where id = $1", [bQuestion])),
    ).rejects.toThrow(/permission denied/);
    expect((await rawQuestion(bQuestion)).question).toBe("How much is the fee?");
  });

  it("A cannot delete B's questions", async () => {
    const affected = await asUser(
      db,
      A,
      async (tx) => (await tx.query("delete from public.questions where id = $1", [bQuestion])).affectedRows,
      { commit: true },
    );
    expect(affected).toBe(0);
    expect(await rawQuestion(bQuestion)).toBeDefined();
  });
});

describe("questions for their owner", () => {
  it("A can ask about A's document and read the question back with its answer and time", async () => {
    const row = await asUser(db, A, async (tx) => {
      const inserted = await tx.query<{ user_id: string; created_at: Date; question: string; result: unknown }>(
        "insert into public.questions (document_id, question, result) values ($1, $2, $3::jsonb) returning user_id, created_at, question, result",
        [aDoc, "Which law applies?", RESULT],
      );
      return inserted.rows[0];
    });
    expect(row.user_id).toBe(A);
    expect(row.created_at).toBeInstanceOf(Date);
    expect(row.question).toBe("Which law applies?");
    expect(row.result).toEqual(JSON.parse(RESULT));
  });

  it("A can delete A's own question but not change it", async () => {
    await expect(
      asUser(db, A, (tx) => tx.query("update public.questions set result = '{}'::jsonb where id = $1", [aQuestion])),
    ).rejects.toThrow(/permission denied/);
    const deleted = await asUser(
      db,
      A,
      async (tx) => (await tx.query("delete from public.questions where id = $1", [aQuestion])).affectedRows,
      { commit: true },
    );
    expect(deleted).toBe(1);
  });

  it("deleting a document deletes its questions", async () => {
    await asUser(db, A, (tx) => tx.query("delete from public.documents where id = $1", [aDoc]), { commit: true });
    expect(await rawQuestion(aQuestion)).toBeUndefined();
    expect(await rawQuestion(bQuestion)).toBeDefined();
  });

  it("refuses an empty or overlong question, and a result that is not a JSON object", async () => {
    const insert = (question: string, result: string) =>
      asUser(db, A, (tx) =>
        tx.query("insert into public.questions (document_id, question, result) values ($1, $2, $3::jsonb)", [aDoc, question, result]),
      );
    await expect(insert("", RESULT)).rejects.toThrow(/questions_question_length_check/);
    await expect(insert("x".repeat(501), RESULT)).rejects.toThrow(/questions_question_length_check/);
    await expect(insert("Fee?", "[]")).rejects.toThrow(/questions_result_object_check/);
    await expect(insert("x".repeat(500), RESULT)).resolves.toBeDefined();
  });
});

describe("questions for signed-out visitors", () => {
  it("anon cannot read or write questions at all", async () => {
    await expect(asAnon(db, (tx) => tx.query("select * from public.questions"))).rejects.toThrow(/permission denied/);
    await expect(
      asAnon(db, (tx) =>
        tx.query("insert into public.questions (user_id, document_id, question, result) values ($1, $2, $3, $4::jsonb)", [
          A,
          aDoc,
          "Fee?",
          RESULT,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
