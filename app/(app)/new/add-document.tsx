"use client";

import { useId, useRef, useState, useTransition, type ChangeEvent, type KeyboardEvent } from "react";
import { saveLocalDocument } from "@/lib/documents/local";
import { suggestTitle } from "@/lib/documents/new-document";
import { extractText, normalizePaste } from "@/lib/extraction";
import { MAX_FILE_BYTES, MAX_TITLE_CHARS, type SourceKind } from "@/lib/extraction/limits";
import { saveDocument, type SaveDocumentResult } from "./actions";
import { fileRefusal, pasteRefusal, saveRefusal, type Refusal } from "./refusals";

// Where a new document goes: the buyer's library (signed in), or this browser
// tab only (signed out, or no accounts on this server).
export type SaveMode = "library" | "signed-out" | "no-accounts";

type Tab = "upload" | "paste";

type Upload =
  | { status: "idle" }
  | { status: "reading"; name: string }
  | { status: "refused"; name: string; refusal: Refusal }
  | { status: "read"; name: string; text: string; sourceKind: SourceKind };

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const words = (text: string) => (text.match(/\S+/g)?.length ?? 0).toLocaleString("en-US");

export function AddDocument({ mode }: { mode: SaveMode }) {
  const ids = useId();
  const [tab, setTab] = useState<Tab>("upload");
  const [upload, setUpload] = useState<Upload>({ status: "idle" });
  const [paste, setPaste] = useState("");
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [problem, setProblem] = useState<Refusal | null>(null);
  const [saving, startSaving] = useTransition();
  const readCount = useRef(0);
  const tabRefs = { upload: useRef<HTMLButtonElement>(null), paste: useRef<HTMLButtonElement>(null) };

  const toLibrary = mode === "library";

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setProblem(null);
    if (!file) {
      setUpload({ status: "idle" });
      return;
    }
    // Only the newest pick counts if the buyer picks again while one is read.
    const thisRead = ++readCount.current;
    if (file.size > MAX_FILE_BYTES) {
      setUpload({ status: "refused", name: file.name, refusal: fileRefusal({ ok: false, reason: "too-large" }) });
      return;
    }
    setUpload({ status: "reading", name: file.name });
    // The file is read here, in the browser. Only the text below is ever sent.
    const result = await extractText({ name: file.name, type: file.type, bytes: await file.arrayBuffer() });
    if (thisRead !== readCount.current) return;
    if (!result.ok) {
      setUpload({ status: "refused", name: file.name, refusal: fileRefusal(result) });
      return;
    }
    setUpload({ status: "read", name: file.name, text: result.text, sourceKind: result.sourceKind });
    if (!titleEdited) setTitle(suggestTitle({ fileName: file.name }));
  }

  function chooseTab(next: Tab) {
    setTab(next);
    setProblem(null);
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const next: Tab = tab === "upload" ? "paste" : "upload";
    chooseTab(next);
    tabRefs[next].current?.focus();
  }

  function submit() {
    setProblem(null);
    let body: string;
    let sourceKind: SourceKind;
    if (tab === "upload") {
      if (upload.status !== "read") return;
      body = upload.text;
      sourceKind = upload.sourceKind;
    } else {
      const result = normalizePaste(paste);
      if (!result.ok) {
        setProblem(pasteRefusal(result));
        return;
      }
      body = result.text;
      sourceKind = "paste";
    }
    const finalTitle =
      title.trim() ||
      suggestTitle(tab === "upload" && upload.status === "read" ? { fileName: upload.name } : { text: body }) ||
      "Untitled document";

    const keepHere = () => {
      const id = saveLocalDocument({ title: finalTitle, body, sourceKind, addedAt: new Date().toISOString() });
      if (!id) {
        setProblem({
          title: "This browser tab is out of room.",
          body: "Close some other Redline tabs and try again, or sign in to keep documents in your library.",
        });
        return;
      }
      window.location.assign(`/documents/local/${id}`);
    };

    if (!toLibrary) {
      keepHere();
      return;
    }
    startSaving(async () => {
      // Only these three strings go to the server; on success it opens the document.
      const result: SaveDocumentResult | undefined = await saveDocument({ title: finalTitle, body, sourceKind });
      if (!result) return;
      if (result.reason === "signed-out" || result.reason === "accounts-off") keepHere();
      else setProblem(saveRefusal(result.reason));
    });
  }

  const canSubmit = !saving && (tab === "upload" ? upload.status === "read" : paste.trim() !== "");
  const fileId = `${ids}-file`;
  const pasteId = `${ids}-paste`;
  const titleId = `${ids}-title`;

  return (
    <div className="add-doc">
      <div className="tabs" role="tablist" aria-label="How to add the document">
        {(["upload", "paste"] as const).map((t) => (
          <button
            key={t}
            ref={tabRefs[t]}
            type="button"
            role="tab"
            id={`${ids}-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`${ids}-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            className="tab-button"
            onClick={() => chooseTab(t)}
            onKeyDown={onTabKey}
          >
            {t === "upload" ? "Upload a file" : "Paste the text"}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${ids}-panel-upload`}
        aria-labelledby={`${ids}-tab-upload`}
        className="tab-panel"
        hidden={tab !== "upload"}
      >
        <div className="field">
          <label htmlFor={fileId}>Contract file</label>
          {/* No name and no form: the file can't be submitted anywhere. */}
          <input
            id={fileId}
            type="file"
            accept={ACCEPT}
            onChange={onFile}
            aria-describedby={`${fileId}-hint`}
            disabled={saving}
          />
          <p id={`${fileId}-hint`} className="hint">
            PDF or Word (.docx), up to 25 MB.
          </p>
        </div>
        <div aria-live="polite">
          {upload.status === "reading" && <p className="status">Reading {upload.name}…</p>}
          {upload.status === "read" && (
            <p className="status status--done">
              Read {upload.name}: {words(upload.text)} words.
            </p>
          )}
        </div>
        {upload.status === "refused" && (
          <div className="message" role="alert">
            <strong>{upload.refusal.title}</strong>
            {upload.refusal.body}
          </div>
        )}
      </div>

      <div
        role="tabpanel"
        id={`${ids}-panel-paste`}
        aria-labelledby={`${ids}-tab-paste`}
        className="tab-panel"
        hidden={tab !== "paste"}
      >
        <div className="field">
          <label htmlFor={pasteId}>Contract text</label>
          <textarea
            id={pasteId}
            rows={14}
            spellCheck={false}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            aria-describedby={`${pasteId}-hint`}
            disabled={saving}
          />
          <p id={`${pasteId}-hint`} className="hint">
            Paste the whole contract, from the title to the signatures.
          </p>
        </div>
      </div>

      <div className="field">
        <label htmlFor={titleId}>Title</label>
        <input
          id={titleId}
          type="text"
          maxLength={MAX_TITLE_CHARS}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleEdited(true);
          }}
          aria-describedby={`${titleId}-hint`}
          disabled={saving}
        />
        <p id={`${titleId}-hint`} className="hint">
          {toLibrary ? "How the document is listed in your library." : "Shown at the top of the document."}
        </p>
      </div>

      {problem && (
        <div className="message" role="alert">
          <strong>{problem.title}</strong>
          {problem.body}
        </div>
      )}

      {mode === "signed-out" && (
        <p className="keep-note">
          You’re not signed in, so this document stays in this browser tab and is deleted when you close it.{" "}
          <a href={`/sign-in?next=${encodeURIComponent("/new")}`}>Sign in</a> to keep it in your library.
        </p>
      )}
      {mode === "no-accounts" && (
        <p className="keep-note">
          Accounts aren’t set up on this server, so this document stays in this browser tab and is deleted when you close
          it.
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="action" onClick={submit} disabled={!canSubmit} aria-busy={saving}>
          <span>{saving ? "Adding…" : toLibrary ? "Add to library" : "Open the document"}</span>
        </button>
      </div>
    </div>
  );
}
