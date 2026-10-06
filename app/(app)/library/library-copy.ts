import type { DeleteDocumentFailure } from "../documents/actions";

// What the buyer reads in the library and in the delete control. Every line
// here went through the humanizer skill. Each red line is put in words by
// describeRedLine (lib/engine/red-lines.ts), so the library, the analysis
// view and the red lines page all name it the same way.

export const LIBRARY_COPY = {
  title: "Library",
  lede: "Your contracts, newest first, each with every analysis you’ve run on it. Only you can see them.",
  loadFailed: { title: "We couldn’t load your library.", body: "Reload the page to try again." },
  emptyTitle: "No contracts yet",
  emptyBody: "Add a vendor contract to start your library.",
  add: "Add a document",
  added: "Added",
  deleted: "Document deleted, along with its analyses and questions.",
  notAnalysed: "Not analysed yet.",
  openToAnalyse: "Open it to run an analysis",
  historyLabel: (title: string) => `Analyses of ${title}`,
  historyNote: "Each analysis lists the red lines it ran with, as they were that day.",
  colRan: "Analysed",
  colRedLines: "Red lines checked",
  colResult: "Result",
  openLabel: (when: string) => `Open the analysis from ${when}`,
  latest: "Latest",
  noRedLines: "None set",
  redLinesUnreadable: "Redline couldn’t read them",
} as const;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One run's result, in the library. Counts are worked out again from the checked analysis, never read from storage. */
export const RESULT_COPY = {
  clean: "No renewal or exit terms to negotiate",
  noFlags: "No flags",
  negotiate: (n: number) => `${n} to negotiate before signing`,
  know: (n: number) => `${n} to know before signing`,
  outside: (n: number) => `${count(n, "outside-terms notice", "outside-terms notices")}, so not a clean result`,
  rerun: "Needs a re-run",
  outdated: "An earlier version of Redline saved this one. Open it and analyse again.",
  failed: "It didn’t pass Redline’s checks, so its result isn’t shown. Open it and analyse again.",
} as const;

/** The delete control, on the library and on the document page. */
export const DELETE_COPY = {
  delete: "Delete",
  deleteLabel: (title: string) => `Delete ${title}`,
  confirmTitle: (title: string) => `Delete “${title}”?`,
  confirmBody: "This deletes the document’s text, every analysis of it and every question you asked about it. You can’t undo this.",
  confirm: "Delete for good",
  cancel: "Keep it",
  deleting: "Deleting…",
} as const;

export const DELETE_FAILURE_COPY: Record<DeleteDocumentFailure, string> = {
  "accounts-off": "Accounts aren’t set up on this server, so nothing was deleted.",
  "signed-out": "You’re signed out. Sign in again to delete this document.",
  invalid: "Redline couldn’t tell which document to delete. Reload the page and try again.",
  "not-found": "This document isn’t in your library any more. Reload the page.",
  "delete-failed": "We couldn’t delete the document. Nothing was removed. Try again in a minute.",
};
