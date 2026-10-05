import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { isModelConfigured } from "@/lib/engine/openrouter";
import type { SourceKind } from "@/lib/extraction/limits";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import { AccountsOff } from "../../accounts-off";
import type { AnalysisRun } from "../actions";
import { AnalysedDocument } from "../analysed-document";

type Params = { params: Promise<{ id: string }> };
type DocumentRow = { id: string; title: string; body: string; source_kind: SourceKind; created_at: string };

// An analysis can take a minute or two; the run is a server action on this page.
export const maxDuration = 120;

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

// The latest saved analysis of a document, with the red lines it ran with, or
// null when there is none or it can't be read. Its citations are checked
// again, and its breaches worked out again from that snapshot, before they
// are shown.
async function loadLatestAnalysis(documentId: string): Promise<AnalysisRun | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("analyses")
    .select("result, created_at, red_lines")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    analysis: data.result as AnalysisRun["analysis"],
    ranAt: new Date(data.created_at as string).toISOString(),
    // Checked on the way in by checkStoredAnalysis, like the result.
    redLines: data.red_lines as AnalysisRun["redLines"],
  };
}

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

  const latest = await loadLatestAnalysis(doc.id);

  return (
    <AnalysedDocument
      title={doc.title}
      body={doc.body}
      sourceKind={doc.source_kind}
      addedAt={doc.created_at}
      source={{ kind: "saved", documentId: doc.id, latest }}
      modelConfigured={isModelConfigured()}
    />
  );
}
