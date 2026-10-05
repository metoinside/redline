"use server";

// Saving and deleting the signed-in buyer's red lines. Every field is checked
// again here (lib/red-lines/input.ts), and every write runs under row-level
// security, so a buyer can only ever change their own rows.

import type { User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { readRedLineInput } from "@/lib/red-lines/input";
import { rowValues } from "@/lib/red-lines/rows";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import { RED_LINE_ERRORS, VALUE_ERROR } from "./red-lines-copy";

export type RedLineFormState = { kind: "idle" } | { kind: "error"; message: string } | { kind: "saved"; at: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Session =
  | { ok: false; message: string }
  | { ok: true; user: User; supabase: Awaited<ReturnType<typeof createServerSupabase>> };

async function signedIn(): Promise<Session> {
  if (!isSupabaseConfigured()) return { ok: false, message: RED_LINE_ERRORS.accountsOff };
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: RED_LINE_ERRORS.signedOut };
  return { ok: true, user, supabase: await createServerSupabase() };
}

/** Adds a red line, or changes one when the form carries its id. */
export async function saveRedLine(_prev: RedLineFormState, formData: FormData): Promise<RedLineFormState> {
  const session = await signedIn();
  if (!session.ok) return { kind: "error", message: session.message };

  const input = readRedLineInput(formData);
  if (!input.ok) {
    if (input.error === "value") return { kind: "error", message: VALUE_ERROR[input.kind] };
    return { kind: "error", message: input.error === "clause-type" ? RED_LINE_ERRORS.clauseType : RED_LINE_ERRORS.limitKind };
  }

  const { user, supabase } = session;
  const id = formData.get("id");
  if (id !== null && id !== "") {
    if (typeof id !== "string" || !UUID.test(id)) return { kind: "error", message: RED_LINE_ERRORS.gone };
    const { data, error } = await supabase
      .from("red_lines")
      .update(rowValues(input.redLine))
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");
    if (error) {
      console.error("[red lines] update failed", error.code);
      return { kind: "error", message: RED_LINE_ERRORS.saveFailed };
    }
    if (!data || data.length === 0) return { kind: "error", message: RED_LINE_ERRORS.gone };
  } else {
    const { error } = await supabase.from("red_lines").insert(rowValues(input.redLine));
    if (error) {
      console.error("[red lines] insert failed", error.code);
      return { kind: "error", message: RED_LINE_ERRORS.saveFailed };
    }
  }

  revalidatePath("/red-lines");
  return { kind: "saved", at: Date.now() };
}

export async function deleteRedLine(_prev: RedLineFormState, formData: FormData): Promise<RedLineFormState> {
  const session = await signedIn();
  if (!session.ok) return { kind: "error", message: session.message };

  const id = formData.get("id");
  if (typeof id !== "string" || !UUID.test(id)) return { kind: "error", message: RED_LINE_ERRORS.gone };
  const { user, supabase } = session;
  const { error } = await supabase.from("red_lines").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    console.error("[red lines] delete failed", error.code);
    return { kind: "error", message: RED_LINE_ERRORS.deleteFailed };
  }

  revalidatePath("/red-lines");
  return { kind: "saved", at: Date.now() };
}
