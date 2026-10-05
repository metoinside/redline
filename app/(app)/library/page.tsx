import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import { AccountsOff } from "../accounts-off";

export const metadata: Metadata = { title: "Library" };

type DocumentRow = { id: string; title: string; created_at: string };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function LibraryPage() {
  if (!isSupabaseConfigured()) return <AccountsOff title="Library" />;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/library");

  const supabase = await createServerSupabase();
  // Row-level security limits this to the buyer's own rows; the filter makes it explicit.
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <section className="sheet" aria-labelledby="library-title">
      <header className="sheet-head">
        <h1 id="library-title">Library</h1>
        <p>Your contracts, newest first. Only you can see them.</p>
      </header>
      {error ? (
        <p className="message" role="alert">
          <strong>We couldn’t load your library.</strong>
          Reload the page to try again.
        </p>
      ) : !data || data.length === 0 ? (
        <div className="empty">
          <h2>No contracts yet</h2>
          <p>Add a vendor contract to start your library.</p>
          <a className="action" href="/new">
            <span>Add a document</span>
          </a>
        </div>
      ) : (
        <table className="doc-table">
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Added</th>
            </tr>
          </thead>
          <tbody>
            {(data as DocumentRow[]).map((doc) => (
              <tr key={doc.id}>
                <td>
                  <a href={`/documents/${doc.id}`}>{doc.title}</a>
                </td>
                <td className="date">
                  <time dateTime={doc.created_at}>{dateFormat.format(new Date(doc.created_at))}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
