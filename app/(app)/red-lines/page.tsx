import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RED_LINE_COLUMNS, redLinesFromRows } from "@/lib/red-lines/rows";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import { AccountsOff } from "../accounts-off";
import { RED_LINES_PAGE } from "./red-lines-copy";
import { RedLinesEditor } from "./red-lines-editor";

export const metadata: Metadata = { title: "Red lines" };

// The buyer's red lines: add, change and delete. Saved to their account, and
// loaded into every analysis of a saved document.
export default async function RedLinesPage() {
  if (!isSupabaseConfigured()) return <AccountsOff title={RED_LINES_PAGE.title} body={RED_LINES_PAGE.accountsOffBody} />;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/red-lines");

  const supabase = await createServerSupabase();
  // Row-level security limits this to the buyer's own rows; the filter makes it explicit.
  const { data, error } = await supabase
    .from("red_lines")
    .select(RED_LINE_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const redLines = error ? null : redLinesFromRows(data ?? []);

  return (
    <section className="sheet sheet--form" aria-labelledby="red-lines-title">
      <header className="sheet-head">
        <h1 id="red-lines-title">{RED_LINES_PAGE.title}</h1>
        <p>{RED_LINES_PAGE.lede}</p>
      </header>
      {redLines === null ? (
        <p className="message" role="alert">
          <strong>{RED_LINES_PAGE.loadFailed.title}</strong>
          {RED_LINES_PAGE.loadFailed.body}
        </p>
      ) : (
        <RedLinesEditor redLines={redLines} />
      )}
    </section>
  );
}
