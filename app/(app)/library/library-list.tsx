import type { HistoryEntry, HistoryResult } from "@/lib/documents/history";
import { describeRedLine } from "@/lib/engine/red-lines";
import { DeleteDocument } from "../documents/delete-document";
import { LIBRARY_COPY, RESULT_COPY } from "./library-copy";

// The library's list: each document, newest first, with its analyses, newest
// first. Each run shows its date, the red lines from its own snapshot and
// what it found, worked out again by analysisHistory (lib/documents/history.ts).
// A run that fails the re-check says it needs a re-run and shows no result.

export type LibraryDocument = { id: string; title: string; createdAt: string; history: HistoryEntry[] };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const ranFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function LibraryList({ documents }: { documents: LibraryDocument[] }) {
  return (
    <ol className="library">
      {documents.map((doc) => (
        <li key={doc.id} id={`doc-${doc.id}`} className="library-doc">
          <div className="library-doc-head">
            <h2>
              <a href={`/documents/${doc.id}`}>{doc.title}</a>
            </h2>
            <p className="library-doc-added">
              {LIBRARY_COPY.added} <time dateTime={doc.createdAt}>{dateFormat.format(new Date(doc.createdAt))}</time>
            </p>
            <DeleteDocument documentId={doc.id} title={doc.title} />
          </div>
          {doc.history.length === 0 ? (
            <p className="library-none">
              {LIBRARY_COPY.notAnalysed} <a href={`/documents/${doc.id}`}>{LIBRARY_COPY.openToAnalyse}</a>
            </p>
          ) : (
            <History documentId={doc.id} title={doc.title} history={doc.history} />
          )}
        </li>
      ))}
    </ol>
  );
}

function History({ documentId, title, history }: { documentId: string; title: string; history: HistoryEntry[] }) {
  return (
    <table className="run-table">
      <caption className="visually-hidden">{LIBRARY_COPY.historyLabel(title)}</caption>
      <thead>
        <tr>
          <th scope="col">{LIBRARY_COPY.colRan}</th>
          <th scope="col">{LIBRARY_COPY.colRedLines}</th>
          <th scope="col">{LIBRARY_COPY.colResult}</th>
        </tr>
      </thead>
      <tbody>
        {history.map((entry, i) => {
          const when = ranFormat.format(new Date(entry.ranAt));
          return (
            <tr key={entry.id}>
              <td className="run-date" data-label={LIBRARY_COPY.colRan}>
                <a href={`/documents/${documentId}?analysis=${entry.id}`} aria-label={LIBRARY_COPY.openLabel(when)}>
                  <time dateTime={entry.ranAt}>{when}</time>
                </a>
                {i === 0 && <span className="run-latest">{LIBRARY_COPY.latest}</span>}
              </td>
              <td className="run-redlines" data-label={LIBRARY_COPY.colRedLines}>
                {entry.redLines === null ? (
                  <span className="run-quiet">{LIBRARY_COPY.redLinesUnreadable}</span>
                ) : entry.redLines.length === 0 ? (
                  <span className="run-quiet">{LIBRARY_COPY.noRedLines}</span>
                ) : (
                  <ul>
                    {entry.redLines.map((redLine, j) => (
                      <li key={redLine.id ?? j}>{describeRedLine(redLine)}</li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="run-result" data-label={LIBRARY_COPY.colResult}>
                <RunResult result={entry.result} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RunResult({ result }: { result: HistoryResult }) {
  if (result.kind === "clean") return <span className="run-clean">{RESULT_COPY.clean}</span>;
  if (result.kind === "needs-rerun") {
    return (
      <span className="run-rerun">
        <strong>{RESULT_COPY.rerun}</strong> {result.reason === "outdated" ? RESULT_COPY.outdated : RESULT_COPY.failed}
      </span>
    );
  }
  const lines: { key: string; swatch: "negotiate" | "know" | "outside" | null; text: string }[] = [];
  if (result.negotiate > 0) lines.push({ key: "negotiate", swatch: "negotiate", text: RESULT_COPY.negotiate(result.negotiate) });
  if (result.know > 0) lines.push({ key: "know", swatch: "know", text: RESULT_COPY.know(result.know) });
  if (result.negotiate + result.know === 0) lines.push({ key: "none", swatch: null, text: RESULT_COPY.noFlags });
  if (result.outsideTerms > 0) lines.push({ key: "outside", swatch: "outside", text: RESULT_COPY.outside(result.outsideTerms) });
  return (
    <ul className="run-counts">
      {lines.map((line) => (
        <li key={line.key}>
          {line.swatch && <span className={`comment-swatch run-swatch run-swatch--${line.swatch}`} aria-hidden="true" />}
          {line.text}
        </li>
      ))}
    </ul>
  );
}
