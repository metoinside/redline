import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { AddDocument, type SaveMode } from "./add-document";

export const metadata: Metadata = { title: "Add a document" };

export default async function NewDocumentPage() {
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;
  const mode: SaveMode = !configured ? "no-accounts" : user ? "library" : "signed-out";

  return (
    <section className="sheet sheet--form" aria-labelledby="new-title">
      <header className="sheet-head">
        <h1 id="new-title">Add a document</h1>
        <p>
          Upload a PDF or Word file, or paste the text. Redline reads the file in your browser, so it never leaves your
          computer. Only the text is kept.
        </p>
      </header>
      <AddDocument mode={mode} />
    </section>
  );
}
