import type { ReactNode } from "react";
import type { SourceKind } from "@/lib/extraction/limits";
import { DocumentText } from "./document-text";

const SOURCE_LABEL: Record<SourceKind, string> = {
  pdf: "From a PDF",
  docx: "From a Word file",
  paste: "Pasted text",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** The document view: the stored text on a white sheet, as Redline read it. */
export function DocumentView({
  title,
  body,
  sourceKind,
  addedAt,
  notice,
}: {
  title: string;
  body: string;
  sourceKind: SourceKind;
  addedAt: string;
  notice?: ReactNode;
}) {
  return (
    <article className="sheet doc-sheet" aria-labelledby="doc-title">
      <p className="sheet-label">Document text</p>
      <header className="doc-head">
        <h1 id="doc-title">{title}</h1>
        <p className="doc-meta">
          {SOURCE_LABEL[sourceKind]} · Added <time dateTime={addedAt}>{dateFormat.format(new Date(addedAt))}</time>
        </p>
        <p className="doc-check">
          This is the text Redline read, word for word. Check it’s the contract you meant to add.
        </p>
        {notice}
      </header>
      <DocumentText text={body} />
    </article>
  );
}
