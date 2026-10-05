import type { Metadata } from "next";
import { isModelConfigured } from "@/lib/engine/openrouter";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LocalDocumentView } from "./local-document-view";

export const metadata: Metadata = { title: "Document" };

// An analysis can take a minute or two; the run is a server action on this page.
export const maxDuration = 120;

// A document added without an account. Its text is in this browser tab's
// sessionStorage only; the server never sees it, so this page only sends the
// shell and the code that reads it there. Running an analysis sends the text
// to the server, which analyses it and keeps nothing.
export default async function LocalDocumentPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <LocalDocumentView id={key} accountsConfigured={isSupabaseConfigured()} modelConfigured={isModelConfigured()} />;
}
