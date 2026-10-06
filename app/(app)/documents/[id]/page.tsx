import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { isModelConfigured } from "@/lib/engine/openrouter";
import type { SourceKind } from "@/lib/extraction/limits";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import { AccountsOff } from "../../accounts-off";
import type { AnalysisRun, AskedQuestion } from "../actions";
import { AnalysedDocument } from "../analysed-document";
import { DeleteDocument } from "../delete-document";

type Params = { params: Promise<{ id: string }> };
type Props = Params & { searchParams: Promise<Record<string, string | string[] | undefined>> };
type DocumentRow = { id: string; title: string; body: string; source_kind: SourceKind; created_at: string };

// An analysis can take a minute or two; the run, and each question, is a server action on this page.
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

/**
 * The analysis to show on load: the one the link names (?analysis=<id>), or
 * the latest. `older` is true when it isn't the latest run; `missing` is true
 * when the link names a run that isn't this document's (deleted, or a wrong
 * link), and the latest is shown instead. run is null when there is none or it
 * can't be loaded. Its citations are checked again, and its breaches worked
 * out again from its own red-line snapshot, before they are shown.
 */
async function loadAnalysis(
  documentId: string,
  requested: string | null,
): Promise<{ run: AnalysisRun | null; older: boolean; missing: boolean }> {
  const supabase = await createServerSupabase();
  const { data: runs, error } = await supabase
    .from("analyses")
    .select("id")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  if (error || !runs || runs.length === 0) return { run: null, older: false, missing: requested !== null };

  const ids = runs.map((r) => r.id as string);
  const missing = requested !== null && !ids.includes(requested);
  const chosen = requested !== null && !missing ? requested : ids[0];

  const { data, error: loadError } = await supabase
    .from("analyses")
    .select("result, created_at, red_lines")
    .eq("id", chosen)
    .eq("document_id", documentId)
    .maybeSingle();
  if (loadError || !data) return { run: null, older: false, missing };
  return {
    run: {
      analysis: data.result as AnalysisRun["analysis"],
      ranAt: new Date(data.created_at as string).toISOString(),
      // Checked on the way in by checkStoredAnalysis, like the result.
      redLines: data.red_lines as AnalysisRun["redLines"],
    },
    older: chosen !== ids[0],
    missing,
  };
}

/** How many earlier questions a document shows, newest first. */
const QUESTION_LIMIT = 50;

// The questions asked about a document, newest first, or null when they
// couldn't be loaded. Each answer's citation is checked again against the
// document text before it is shown (readStoredAnswer).
async function loadQuestions(documentId: string): Promise<AskedQuestion[] | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("questions")
    .select("id, question, result, created_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(QUESTION_LIMIT);
  if (error || !data) return null;
  return data.map((row) => ({
    id: row.id as string,
    question: row.question as string,
    // Checked on the way in by readStoredAnswer, like an analysis.
    result: row.result as AskedQuestion["result"],
    askedAt: new Date(row.created_at as string).toISOString(),
  }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!isSupabaseConfigured() || !(await getCurrentUser())) return { title: "Document" };
  const doc = await loadDocument((await params).id);
  return { title: doc && doc !== "error" ? doc.title : "Document" };
}

export default async function DocumentPage({ params, searchParams }: Props) {
  if (!isSupabaseConfigured()) return <AccountsOff title="Document" />;

  const [{ id }, query] = await Promise.all([params, searchParams]);
  // Any value that isn't one id is a link to no run, so the latest is shown and the page says so.
  const requested = query.analysis === undefined ? null : typeof query.analysis === "string" && UUID.test(query.analysis) ? query.analysis : "";
  const user = await getCurrentUser();
  if (!user) {
    const back = requested ? `/documents/${id}?analysis=${requested}` : `/documents/${id}`;
    redirect(`/sign-in?next=${encodeURIComponent(back)}`);
  }

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

  const [shown, questions] = await Promise.all([loadAnalysis(doc.id, requested), loadQuestions(doc.id)]);

  return (
    <AnalysedDocument
      title={doc.title}
      body={doc.body}
      sourceKind={doc.source_kind}
      addedAt={doc.created_at}
      source={{ kind: "saved", documentId: doc.id, run: shown.run, older: shown.older, missingRun: shown.missing, questions }}
      modelConfigured={isModelConfigured()}
      headerActions={<DeleteDocument documentId={doc.id} title={doc.title} />}
    />
  );
}
