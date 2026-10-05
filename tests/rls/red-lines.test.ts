import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asAnon, asUser, createDatabase, createUser } from "./harness";

// Row-level security on red lines, run on the real migration SQL in Postgres
// (PGlite). Each query runs as Supabase would run it for a signed-in buyer.
// A buyer's red lines are theirs alone: nobody else can read, add to, change
// or delete them.

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let db: PGlite;
let aLine: string;
let bLine: string;

async function addRedLine(owner: string, clauseType: string, kind: string, value: number | null): Promise<string> {
  return asUser(
    db,
    owner,
    async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.red_lines (clause_type, limit_kind, limit_value) values ($1, $2, $3) returning id",
        [clauseType, kind, value],
      );
      return rows[0].id;
    },
    { commit: true },
  );
}

/** Reads a row with no policies in the way, to see what really happened. */
async function rawRedLine(id: string) {
  const { rows } = await db.query<{ user_id: string; clause_type: string; limit_kind: string; limit_value: number | null; updated_at: Date }>(
    "select user_id, clause_type, limit_kind, limit_value, updated_at from public.red_lines where id = $1",
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
  await db.exec("delete from public.red_lines;");
  aLine = await addRedLine(A, "notice_window", "max_days", 60);
  bLine = await addRedLine(B, "auto_renewal", "not_allowed", null);
});

describe("red lines row-level security, user A against user B's rows", () => {
  it("A cannot read B's red lines", async () => {
    const ids = await asUser(db, A, async (tx) => (await tx.query<{ id: string }>("select id from public.red_lines")).rows.map((r) => r.id));
    expect(ids).toEqual([aLine]);
    const byOwner = await asUser(db, A, async (tx) => (await tx.query("select * from public.red_lines where user_id = $1", [B])).rows);
    expect(byOwner).toEqual([]);
  });

  it("A cannot add a red line as B", async () => {
    await expect(
      asUser(db, A, (tx) =>
        tx.query("insert into public.red_lines (user_id, clause_type, limit_kind) values ($1, 'rollover', 'not_allowed')", [B]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("A cannot change B's red lines", async () => {
    const affected = await asUser(
      db,
      A,
      async (tx) =>
        (await tx.query("update public.red_lines set limit_kind = 'max_months', limit_value = 120 where id = $1", [bLine])).affectedRows,
      { commit: true },
    );
    expect(affected).toBe(0);
    expect(await rawRedLine(bLine)).toMatchObject({ limit_kind: "not_allowed", limit_value: null });
  });

  it("A cannot take B's red line by moving it to A, or give A's to B", async () => {
    await expect(asUser(db, A, (tx) => tx.query("update public.red_lines set user_id = $1 where id = $2", [B, aLine]))).rejects.toThrow(
      /permission denied/,
    );
    const moved = await asUser(
      db,
      A,
      async (tx) => (await tx.query("update public.red_lines set clause_type = 'auto_renewal' where id = $1", [bLine])).affectedRows,
    );
    expect(moved).toBe(0);
    expect((await rawRedLine(aLine)).user_id).toBe(A);
  });

  it("A cannot delete B's red lines", async () => {
    const affected = await asUser(
      db,
      A,
      async (tx) => (await tx.query("delete from public.red_lines where id = $1", [bLine])).affectedRows,
      { commit: true },
    );
    expect(affected).toBe(0);
    expect(await rawRedLine(bLine)).toBeDefined();
  });
});

describe("red lines for their owner", () => {
  it("A can add, change and delete A's own red lines, and a change moves updated_at", async () => {
    const before = (await rawRedLine(aLine)).updated_at;
    await new Promise((r) => setTimeout(r, 5));
    const changed = await asUser(
      db,
      A,
      async (tx) => (await tx.query("update public.red_lines set limit_value = 45 where id = $1", [aLine])).affectedRows,
      { commit: true },
    );
    expect(changed).toBe(1);
    const after = await rawRedLine(aLine);
    expect(after.limit_value).toBe(45);
    expect(after.updated_at.getTime()).toBeGreaterThan(before.getTime());

    const extra = await addRedLine(A, "early_termination_fee", "max_dollars", 5000);
    expect((await rawRedLine(extra)).user_id).toBe(A);
    const deleted = await asUser(
      db,
      A,
      async (tx) => (await tx.query("delete from public.red_lines where id = $1", [extra])).affectedRows,
      { commit: true },
    );
    expect(deleted).toBe(1);
  });

  it("refuses a clause type outside the family, or a limit that doesn't suit its clause type", async () => {
    const insert = (clauseType: string, kind: string, value: number | null) =>
      asUser(db, A, (tx) =>
        tx.query("insert into public.red_lines (clause_type, limit_kind, limit_value) values ($1, $2, $3)", [clauseType, kind, value]),
      );
    await expect(insert("indemnity", "not_allowed", null)).rejects.toThrow(/red_lines_(clause_type|limit)_check/);
    await expect(insert("notice_window", "max_weeks", 3)).rejects.toThrow(/red_lines_limit(_kind)?_check/);
    for (const [clauseType, kind, value] of [
      ["notice_window", "max_months", 3],
      ["early_termination_fee", "max_days", 30],
      ["auto_renewal", "max_dollars", 100],
      ["notice_window", "max_days", null],
      ["notice_window", "max_days", 0],
      ["notice_window", "max_days", 3651],
      ["multi_year_term", "max_months", 241],
      ["early_termination_fee", "max_dollars", 100000001],
      ["rollover", "not_allowed", 12],
    ] as const) {
      await expect(insert(clauseType, kind, value)).rejects.toThrow(/red_lines_limit_check/);
    }
    for (const [clauseType, kind, value] of [
      ["notice_window", "max_days", 3650],
      ["auto_renewal", "max_months", 12],
      ["rollover", "max_months", 1],
      ["multi_year_term", "max_months", 240],
      ["early_termination_fee", "max_dollars", 100000000],
      ["multi_year_term", "not_allowed", null],
    ] as const) {
      await expect(insert(clauseType, kind, value)).resolves.toBeDefined();
    }
  });

  it("deleting the account deletes its red lines", async () => {
    await db.query("delete from auth.users where id = $1", [A]);
    expect(await rawRedLine(aLine)).toBeUndefined();
    expect(await rawRedLine(bLine)).toBeDefined();
    await createUser(db, A, "a@example.com");
  });
});

describe("red lines for signed-out visitors", () => {
  it("anon cannot read or write red lines at all", async () => {
    await expect(asAnon(db, (tx) => tx.query("select * from public.red_lines"))).rejects.toThrow(/permission denied/);
    await expect(
      asAnon(db, (tx) =>
        tx.query("insert into public.red_lines (user_id, clause_type, limit_kind) values ($1, 'rollover', 'not_allowed')", [A]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
