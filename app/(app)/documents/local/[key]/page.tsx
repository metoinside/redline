import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LocalDocumentView } from "./local-document-view";

export const metadata: Metadata = { title: "Document" };

// A document added without an account. Its text is in this browser tab's
// sessionStorage only; the server never sees it, so this page only sends the
// shell and the code that reads it there.
export default async function LocalDocumentPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <LocalDocumentView id={key} accountsConfigured={isSupabaseConfigured()} />;
}
