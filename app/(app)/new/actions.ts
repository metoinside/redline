"use server";

import { redirect } from "next/navigation";
import { checkNewDocument } from "@/lib/documents/new-document";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";

export type SaveDocumentResult = {
  ok: false;
  reason: "accounts-off" | "signed-out" | "invalid" | "no-text" | "too-long" | "failed";
};

/**
 * Stores a document in the signed-in buyer's library and opens it. It
 * receives only { title, body, sourceKind }: the browser reads the file and
 * sends its text, and there is nowhere here for a file to go.
 */
export async function saveDocument(input: unknown): Promise<SaveDocumentResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "accounts-off" };

  const check = checkNewDocument(input);
  if (!check.ok) return { ok: false, reason: check.reason };

  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "signed-out" };

  const supabase = await createServerSupabase();
  // Row-level security makes the row the buyer's own (user_id defaults to auth.uid()).
  const { data, error } = await supabase
    .from("documents")
    .insert({ title: check.document.title, body: check.document.body, source_kind: check.document.sourceKind })
    .select("id")
    .single();
  if (error || !data) return { ok: false, reason: "failed" };

  redirect(`/documents/${data.id as string}`);
}
