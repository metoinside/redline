import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { SourceKind } from "@/lib/extraction/limits";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import { AccountsOff } from "../../accounts-off";
import { DocumentView } from "../document-view";

type Params = { params: Promise<{ id: string }> };
type DocumentRow = { id: string; title: string; body: string; source_kind: SourceKind; created_at: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One lookup per request, shared by the page and its title.
const loadDocument = cache(async (id: string): Promise<DocumentRow | null | "error"> => {
  if (!UUID.test(id)) return null;
  const supabase = await createServerSupabase();
  // Row-level security returns the row only to its owner.
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, body, source_kind, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return "error";
  return (data as DocumentRow | null) ?? null;
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!isSupabaseConfigured() || !(await getCurrentUser())) return { title: "Document" };
  const doc = await loadDocument((await params).id);
  return { title: doc && doc !== "error" ? doc.title : "Document" };
}

export default async function DocumentPage({ params }: Params) {
  if (!isSupabaseConfigured()) return <AccountsOff title="Document" />;

  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/documents/${id}`)}`);

  const doc = await loadDocument(id);
  if (doc === "error") {
    return (
      <section className="sheet sheet--narrow" aria-labelledby="doc-error">
        <header className="sheet-head">
          <h1 id="doc-error">Document</h1>
        </header>
        <p className="message" role="alert">
          <strong>We couldn’t load this document.</strong>
          Reload the page to try again.
        </p>
      </section>
    );
  }
  if (!doc) notFound();

  return <DocumentView title={doc.title} body={doc.body} sourceKind={doc.source_kind} addedAt={doc.created_at} />;
}
