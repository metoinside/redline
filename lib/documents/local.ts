"use client";

import type { SourceKind } from "@/lib/extraction/limits";

// Documents added without an account live in this browser tab only
// (sessionStorage), and are gone when the tab closes. Nothing here is sent
// anywhere.

export type LocalDocument = { title: string; body: string; sourceKind: SourceKind; addedAt: string };

const PREFIX = "redline:document:";

export function saveLocalDocument(doc: LocalDocument): string | null {
  const id = crypto.randomUUID();
  const value = JSON.stringify(doc);
  try {
    sessionStorage.setItem(PREFIX + id, value);
    return id;
  } catch {
    // Out of room: drop the documents added earlier in this tab and try once more.
    try {
      for (const key of Object.keys(sessionStorage)) if (key.startsWith(PREFIX)) sessionStorage.removeItem(key);
      sessionStorage.setItem(PREFIX + id, value);
      return id;
    } catch {
      return null;
    }
  }
}

export function loadLocalDocument(id: string): LocalDocument | null {
  try {
    const value = sessionStorage.getItem(PREFIX + id);
    if (!value) return null;
    const doc = JSON.parse(value) as Partial<LocalDocument>;
    if (typeof doc.title !== "string" || typeof doc.body !== "string" || typeof doc.addedAt !== "string") return null;
    if (doc.sourceKind !== "pdf" && doc.sourceKind !== "docx" && doc.sourceKind !== "paste") return null;
    return doc as LocalDocument;
  } catch {
    return null;
  }
}
