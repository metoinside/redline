"use client";

import { useEffect, useState } from "react";
import { loadLocalDocument, type LocalDocument } from "@/lib/documents/local";
import { AnalysedDocument } from "../../analysed-document";

export function LocalDocumentView({
  id,
  accountsConfigured,
  modelConfigured,
}: {
  id: string;
  accountsConfigured: boolean;
  modelConfigured: boolean;
}) {
  // undefined until the browser has looked in sessionStorage.
  const [doc, setDoc] = useState<LocalDocument | null | undefined>(undefined);

  useEffect(() => {
    setDoc(loadLocalDocument(id));
  }, [id]);

  useEffect(() => {
    if (doc) document.title = `${doc.title} · Redline`;
  }, [doc]);

  if (doc === undefined) return <section className="sheet doc-sheet" aria-busy="true" />;

  if (doc === null) {
    return (
      <section className="sheet sheet--narrow" aria-labelledby="local-missing">
        <header className="sheet-head">
          <h1 id="local-missing">This document is gone</h1>
        </header>
        <div className="empty">
          <p>
            A document you add without signing in stays in the browser tab you added it in, and it’s deleted when that tab
            closes. Add it again to read it.
          </p>
          <a className="action" href="/new">
            <span>Add a document</span>
          </a>
        </div>
      </section>
    );
  }

  const notice = accountsConfigured ? (
    <p className="doc-notice">
      Only this browser tab has this document, and closing the tab deletes it.{" "}
      <a href={`/sign-in?next=${encodeURIComponent("/new")}`}>Sign in</a> to keep your documents in your library.
    </p>
  ) : (
    <p className="doc-notice">
      Accounts aren’t set up on this server, so only this browser tab has this document. Closing the tab deletes it.
    </p>
  );

  return (
    <AnalysedDocument
      title={doc.title}
      body={doc.body}
      sourceKind={doc.sourceKind}
      addedAt={doc.addedAt}
      notice={notice}
      source={{ kind: "browser" }}
      modelConfigured={modelConfigured}
    />
  );
}
