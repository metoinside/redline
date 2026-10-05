import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite, type Transaction } from "@electric-sql/pglite";

// In-process Postgres with a minimal stand-in for what a Supabase project
// provides before any migration runs: the auth schema, auth.users, auth.uid(),
// and the anon and authenticated roles with Supabase's default grants.
// Test code only; it never goes in a migration.
const AUTH_SHIM = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;

  create table auth.users (
    id uuid primary key,
    email text unique
  );

  create function auth.uid() returns uuid
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export const MIGRATIONS_DIR = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** A fresh database with the auth shim and every migration applied in order. */
export async function createDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(AUTH_SHIM);
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

/** Inserts a row into auth.users, as Supabase does on sign-up. */
export async function createUser(db: PGlite, id: string, email: string): Promise<void> {
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
}

/**
 * Runs `fn` as a signed-in user would reach the database through Supabase:
 * role `authenticated`, with the JWT subject set. Rolled back afterwards
 * unless `commit` is true.
 */
export async function asUser<T>(
  db: PGlite,
  userId: string,
  fn: (tx: Transaction) => Promise<T>,
  { commit = false }: { commit?: boolean } = {},
): Promise<T> {
  return asRole(db, "authenticated", userId, fn, commit);
}

/** Runs `fn` as a signed-out visitor (role `anon`, no JWT subject). */
export async function asAnon<T>(db: PGlite, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return asRole(db, "anon", null, fn, false);
}

const ROLLBACK = Symbol("rollback");

async function asRole<T>(
  db: PGlite,
  role: "anon" | "authenticated",
  sub: string | null,
  fn: (tx: Transaction) => Promise<T>,
  commit: boolean,
): Promise<T> {
  let result: T | undefined;
  try {
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [sub ?? ""]);
      await tx.exec(`set local role ${role}`);
      result = await fn(tx);
      if (!commit) throw ROLLBACK;
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
  return result as T;
}
