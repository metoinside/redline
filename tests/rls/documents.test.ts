import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_DOCUMENT_CHARS, MAX_TITLE_CHARS } from "@/lib/extraction/limits";
import { asAnon, asUser, createDatabase, createUser } from "./harness";

// Runs the real migration SQL and the real policies in Postgres (PGlite).
// Nothing here is mocked: each query runs as Supabase would run it for a
// signed-in buyer, under the `authenticated` role with their user id as the
// JWT subject.

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let db: PGlite;
let aDoc: string;
let bDoc: string;

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

/** Reads a row with no policies in the way, to see what really happened. */
async function rawRow(id: string) {
  const { rows } = await db.query<{ user_id: string; title: string }>(
    "select user_id, title from public.documents where id = $1",
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
  await db.exec("delete from public.documents");
  aDoc = await addDocument(A, "A's cleaning contract");
  bDoc = await addDocument(B, "B's software subscription");
});

describe("documents row-level security, user A against user B's rows", () => {
  it("A cannot select B's documents", async () => {
    const titles = await asUser(db, A, async (tx) => {
      const { rows } = await tx.query<{ title: string }>("select title from public.documents");
      return rows.map((r) => r.title);
    });
    expect(titles).toEqual(["A's cleaning contract"]);

    const byId = await asUser(db, A, async (tx) => {
      const { rows } = await tx.query("select * from public.documents where id = $1", [bDoc]);
      return rows;
    });
    expect(byId).toEqual([]);
  });

  it("A cannot update B's documents", async () => {
    const affected = await asUser(
      db,
      A,
      async (tx) => {
        const res = await tx.query("update public.documents set title = 'hijacked', body = 'x' where id = $1", [bDoc]);
        return res.affectedRows;
      },
      { commit: true },
    );
    expect(affected).toBe(0);
    expect((await rawRow(bDoc)).title).toBe("B's software subscription");
  });

  it("A cannot delete B's documents", async () => {
    const affected = await asUser(
      db,
      A,
      async (tx) => {
        const res = await tx.query("delete from public.documents where id = $1", [bDoc]);
        return res.affectedRows;
      },
      { commit: true },
    );
    expect(affected).toBe(0);
    expect(await rawRow(bDoc)).toBeDefined();
  });

  it("A cannot insert a document owned by B", async () => {
    await expect(
      asUser(db, A, (tx) =>
        tx.query("insert into public.documents (user_id, title, body, source_kind) values ($1, 'planted', 'planted', 'paste')", [B]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("A cannot hand one of A's documents over to B", async () => {
    await expect(
      asUser(db, A, (tx) => tx.query("update public.documents set user_id = $1 where id = $2", [B, aDoc])),
    ).rejects.toThrow(/row-level security/);
    expect((await rawRow(aDoc)).user_id).toBe(A);
  });
});

describe("documents row-level security, user A on A's own rows", () => {
  it("A can insert, select, update and delete A's own documents", async () => {
    const result = await asUser(db, A, async (tx) => {
      const inserted = await tx.query<{ id: string; user_id: string }>(
        "insert into public.documents (title, body, source_kind) values ('New MSA', 'The term is 12 months.', 'pdf') returning id, user_id",
      );
      const newId = inserted.rows[0].id;

      const selected = await tx.query<{ title: string }>(
        "select title from public.documents order by created_at desc, title",
      );
      const updated = await tx.query("update public.documents set title = 'Renamed MSA' where id = $1", [newId]);
      const afterUpdate = await tx.query<{ title: string }>("select title from public.documents where id = $1", [newId]);
      const deleted = await tx.query("delete from public.documents where id = $1", [aDoc]);
      const remaining = await tx.query<{ title: string }>("select title from public.documents");

      return {
        owner: inserted.rows[0].user_id,
        selected: selected.rows.map((r) => r.title).sort(),
        updated: updated.affectedRows,
        afterUpdate: afterUpdate.rows[0].title,
        deleted: deleted.affectedRows,
        remaining: remaining.rows.map((r) => r.title),
      };
    });

    expect(result.owner).toBe(A);
    expect(result.selected).toEqual(["A's cleaning contract", "New MSA"]);
    expect(result.updated).toBe(1);
    expect(result.afterUpdate).toBe("Renamed MSA");
    expect(result.deleted).toBe(1);
    expect(result.remaining).toEqual(["Renamed MSA"]);
  });
});

describe("documents for signed-out visitors", () => {
  it("anon cannot read or write documents at all", async () => {
    await expect(asAnon(db, (tx) => tx.query("select * from public.documents"))).rejects.toThrow(/permission denied/);
    await expect(
      asAnon(db, (tx) => tx.query("insert into public.documents (user_id, title, body, source_kind) values ($1, 't', 'b', 'paste')", [A])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("documents table shape", () => {
  it("stores extracted text only, with no place for the original file", async () => {
    const { rows } = await db.query<{ column_name: string; data_type: string }>(
      `select column_name, data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'documents' order by ordinal_position`,
    );
    expect(rows).toEqual([
      { column_name: "id", data_type: "uuid" },
      { column_name: "user_id", data_type: "uuid" },
      { column_name: "title", data_type: "text" },
      { column_name: "body", data_type: "text" },
      { column_name: "created_at", data_type: "timestamp with time zone" },
      { column_name: "source_kind", data_type: "text" },
    ]);
  });

  it("records where the text came from as pdf, docx or paste, and nothing else", async () => {
    const insert = (kind: string | null) =>
      asUser(db, A, (tx) =>
        tx.query("insert into public.documents (title, body, source_kind) values ('t', 'b', $1)", [kind]),
      );
    for (const kind of ["pdf", "docx", "paste"]) await expect(insert(kind)).resolves.toBeDefined();
    await expect(insert("png")).rejects.toThrow(/documents_source_kind_check/);
    await expect(insert(null)).rejects.toThrow(/not-null|null value/);
  });

  it("refuses an empty title or body, and a title or body longer than the app allows", async () => {
    const insert = (title: string, body: string) =>
      asUser(db, A, (tx) =>
        tx.query("insert into public.documents (title, body, source_kind) values ($1, $2, 'paste')", [title, body]),
      );
    await expect(insert("", "Some text.")).rejects.toThrow(/documents_title_length_check/);
    await expect(insert("Contract", "")).rejects.toThrow(/documents_body_length_check/);
    await expect(insert("Contract", "x".repeat(MAX_DOCUMENT_CHARS + 1))).rejects.toThrow(/documents_body_length_check/);
    await expect(insert("Contract", "x".repeat(MAX_DOCUMENT_CHARS))).resolves.toBeDefined();
    await expect(insert("t".repeat(MAX_TITLE_CHARS + 1), "Some text.")).rejects.toThrow(/documents_title_length_check/);
    await expect(insert("t".repeat(MAX_TITLE_CHARS), "Some text.")).resolves.toBeDefined();
  });
});
