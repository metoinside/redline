import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { analysisHistory, type AnalysisRow } from "@/lib/documents/history";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import { AccountsOff } from "../accounts-off";
import { LIBRARY_COPY } from "./library-copy";
import { LibraryList, type LibraryDocument } from "./library-list";

export const metadata: Metadata = { title: "Library" };

type DocumentRow = { id: string; title: string; body: string; created_at: string };
type RunRow = AnalysisRow & { document_id: string };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The buyer's documents, newest first, each with its analyses. The document
 * text is loaded because every run is checked again against it before the
 * library says what that run found (lib/documents/history.ts).
 */
async function loadLibrary(userId: string): Promise<LibraryDocument[] | null> {
  const supabase = await createServerSupabase();
  // Row-level security limits both reads to the buyer's own rows; the filters make it explicit.
  const [documents, analyses] = await Promise.all([
    supabase.from("documents").select("id, title, body, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase
      .from("analyses")
      .select("id, document_id, created_at, result, red_lines")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  if (documents.error || analyses.error || !documents.data || !analyses.data) return null;

  const runs = new Map<string, RunRow[]>();
  for (const row of analyses.data as RunRow[]) {
    const list = runs.get(row.document_id) ?? [];
    list.push(row);
    runs.set(row.document_id, list);
  }
  return (documents.data as DocumentRow[]).map((doc) => ({
    id: doc.id,
    title: doc.title,
    createdAt: doc.created_at,
    history: analysisHistory(runs.get(doc.id) ?? [], doc.body),
  }));
}

export default async function LibraryPage({ searchParams }: Props) {
  // Read first, so the page is rendered per request even on a build without accounts.
  const params = await searchParams;
  if (!isSupabaseConfigured()) return <AccountsOff title={LIBRARY_COPY.title} />;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/library");

  const documents = await loadLibrary(user.id);
  const deleted = params.deleted === "1";

  return (
    <section className="sheet" aria-labelledby="library-title">
      <header className="sheet-head">
        <h1 id="library-title">{LIBRARY_COPY.title}</h1>
        <p>{LIBRARY_COPY.lede}</p>
      </header>
      {deleted && (
        <p className="message library-deleted" role="status">
          {LIBRARY_COPY.deleted}
        </p>
      )}
      {documents === null ? (
        <p className="message" role="alert">
          <strong>{LIBRARY_COPY.loadFailed.title}</strong>
          {LIBRARY_COPY.loadFailed.body}
        </p>
      ) : documents.length === 0 ? (
        <div className="empty">
          <h2>{LIBRARY_COPY.emptyTitle}</h2>
          <p>{LIBRARY_COPY.emptyBody}</p>
          <a className="action" href="/new">
            <span>{LIBRARY_COPY.add}</span>
          </a>
        </div>
      ) : (
        <>
          <p className="library-note">{LIBRARY_COPY.historyNote}</p>
          <LibraryList documents={documents} />
        </>
      )}
    </section>
  );
}
