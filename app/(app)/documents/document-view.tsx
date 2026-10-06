import type { MouseEventHandler, ReactNode, Ref } from "react";
import type { SourceKind } from "@/lib/extraction/limits";
import { DocumentText, type TextMark } from "./document-text";

const SOURCE_LABEL: Record<SourceKind, string> = {
  pdf: "From a PDF",
  docx: "From a Word file",
  paste: "Pasted text",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * The document view: the stored text on a white sheet, as Redline read it.
 * The analysis view fills the optional slots: `analysis` under the heading,
 * `marks` on the text, `margin` beside it and `tabs` on the sheet's edge.
 */
export function DocumentView({
  title,
  body,
  sourceKind,
  addedAt,
  notice,
  actions,
  analysis,
  marks,
  margin,
  tabs,
  bodyRef,
  onBodyClick,
}: {
  title: string;
  body: string;
  sourceKind: SourceKind;
  addedAt: string;
  notice?: ReactNode;
  /** Controls in the heading, such as deleting a saved document. */
  actions?: ReactNode;
  analysis?: ReactNode;
  marks?: TextMark[];
  margin?: ReactNode;
  tabs?: ReactNode;
  bodyRef?: Ref<HTMLDivElement>;
  onBodyClick?: MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <article className={`sheet doc-sheet${tabs ? " doc-sheet--tabs" : ""}`} aria-labelledby="doc-title">
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
        {actions}
      </header>
      {analysis}
      {tabs}
      <div className={`doc-body${margin ? " doc-body--margin" : ""}`} ref={bodyRef} onClick={onBodyClick}>
        <DocumentText text={body} marks={marks} />
        {margin}
      </div>
    </article>
  );
}
