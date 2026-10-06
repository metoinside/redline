"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { DELETE_COPY, DELETE_FAILURE_COPY } from "../library/library-copy";
import { deleteDocument, type DeleteDocumentState } from "./actions";

const IDLE: DeleteDocumentState = { kind: "idle" };

/**
 * Deletes a saved document, after a confirmation step on the page itself (no
 * browser dialog). The first press only opens the confirmation; the delete
 * runs only from its own button. Escape or "Keep it" closes it and puts focus
 * back on the first button. On success the server action sends the buyer to
 * the library.
 */
export function DeleteDocument({ documentId, title }: { documentId: string; title: string }) {
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteDocument, IDLE);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!open) {
    return (
      <div className="delete-doc">
        <button
          ref={triggerRef}
          type="button"
          className="text-action delete-doc-trigger"
          aria-label={DELETE_COPY.deleteLabel(title)}
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          {DELETE_COPY.delete}
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="delete-doc delete-doc--confirm"
      role="group"
      aria-labelledby={`${ids}-title`}
      aria-describedby={`${ids}-body`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) {
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      <input type="hidden" name="documentId" value={documentId} />
      <p id={`${ids}-title`} className="delete-doc-title">
        {DELETE_COPY.confirmTitle(title)}
      </p>
      <p id={`${ids}-body`} className="delete-doc-body">
        {DELETE_COPY.confirmBody}
      </p>
      <div className="delete-doc-buttons">
        <button type="submit" className="delete-doc-confirm" disabled={pending}>
          {pending ? DELETE_COPY.deleting : DELETE_COPY.confirm}
        </button>
        <button ref={cancelRef} type="button" className="text-action" disabled={pending} onClick={() => setOpen(false)}>
          {DELETE_COPY.cancel}
        </button>
      </div>
      {state.kind === "error" && !pending && (
        <p className="delete-doc-error" role="alert">
          {DELETE_FAILURE_COPY[state.reason]}
        </p>
      )}
    </form>
  );
}
