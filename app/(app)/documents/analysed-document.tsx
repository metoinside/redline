"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { readStoredAnalysis } from "@/lib/engine/stored";
import type { Analysis, Flag } from "@/lib/engine/types";
import type { SourceKind } from "@/lib/extraction/limits";
import { analyseBrowserDocument, analyseSavedDocument, type AnalysisRun, type RunAnalysisResult } from "./actions";
import { ANALYSIS_COPY, CLAUSE_COMMENT, CLAUSE_LABEL, FAILURE_COPY, clauseNumberAt } from "./analysis-copy";
import type { TextMark } from "./document-text";
import { DocumentView } from "./document-view";

// The document view with its analysis: a control to run it, the running
// state, and the result. Each flag is a tab on the sheet's edge; selecting one
// scrolls to its citation, which carries the red pen underline in place, and
// its margin comment sits beside the sentence.
//
// Every analysis shown here is read through readStoredAnalysis against this
// document's own text first, so a citation that doesn't match the text at its
// offsets is never rendered, wherever the analysis came from.

export type AnalysisSource =
  /** A document in the buyer's library: runs are saved, and the latest is shown on load. */
  | { kind: "saved"; documentId: string; latest: AnalysisRun | null }
  /** A document kept in this browser tab only: runs are not saved. */
  | { kind: "browser" };

type Failure = keyof typeof FAILURE_COPY;

const ranFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const citeId = (flag: Flag) => `cite-${flag.id}`;

export function AnalysedDocument({
  title,
  body,
  sourceKind,
  addedAt,
  notice,
  source,
  modelConfigured,
}: {
  title: string;
  body: string;
  sourceKind: SourceKind;
  addedAt: string;
  notice?: ReactNode;
  source: AnalysisSource;
  modelConfigured: boolean;
}) {
  const ids = useId();
  const initial = source.kind === "saved" ? source.latest : null;
  const [run, setRun] = useState<{ analysis: Analysis; ranAt: string } | null>(() => checked(initial, body));
  const [failure, setFailure] = useState<Failure | null>(null);
  const [selected, setSelected] = useState<string | null>(() => checked(initial, body)?.analysis.flags[0]?.id ?? null);
  const [running, startRunning] = useTransition();
  const bodyRef = useRef<HTMLDivElement>(null);
  const marginRef = useRef<HTMLDivElement>(null);

  const flags = run?.analysis.flags ?? [];

  function start() {
    setFailure(null);
    startRunning(async () => {
      let result: RunAnalysisResult;
      try {
        result = source.kind === "saved" ? await analyseSavedDocument(source.documentId) : await analyseBrowserDocument(body);
      } catch {
        setFailure("unreachable");
        return;
      }
      if (!result.ok) {
        setFailure(result.reason);
        return;
      }
      const next = checked(result.run, body);
      if (!next) {
        setFailure("model-failed");
        return;
      }
      setRun(next);
      setSelected(next.analysis.flags[0]?.id ?? null);
    });
  }

  const select = useCallback((flag: Flag, { scroll }: { scroll: boolean }) => {
    setSelected(flag.id);
    if (!scroll) return;
    const mark = document.getElementById(citeId(flag));
    if (!mark) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mark.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    mark.focus({ preventScroll: true });
  }, []);

  function onBodyClick(event: MouseEvent<HTMLDivElement>) {
    const mark = (event.target as HTMLElement).closest("mark[data-flag]");
    const flag = flags.find((f) => f.id === mark?.getAttribute("data-flag"));
    if (flag) select(flag, { scroll: false });
  }

  const marks: TextMark[] = useMemo(
    () =>
      flags.map((flag) => ({
        start: flag.citation.start,
        end: flag.citation.end,
        id: citeId(flag),
        className: `cite${flag.id === selected ? " is-selected" : ""}`,
        tabIndex: -1,
        data: { flag: flag.id },
      })),
    [flags, selected],
  );

  useMarginLayout(bodyRef, marginRef, flags);

  const ranOn = run ? (
    <p className="analysis-ran">
      {ANALYSIS_COPY.ranOn}{" "}
      <time dateTime={run.ranAt} suppressHydrationWarning>
        {ranFormat.format(new Date(run.ranAt))}
      </time>
      {source.kind === "browser" && <> · {ANALYSIS_COPY.notSaved}</>}
    </p>
  ) : null;

  const failureCopy = failure ? FAILURE_COPY[failure] : null;

  const panel = (
    <section className="analysis" aria-labelledby={`${ids}-analysis`} aria-busy={running}>
      <div className="analysis-head">
        <h2 id={`${ids}-analysis`}>{ANALYSIS_COPY.heading}</h2>
        {ranOn ?? <p className="analysis-ran">{ANALYSIS_COPY.notRun}</p>}
      </div>

      {modelConfigured ? (
        <div className="analysis-run">
          <button type="button" className="action" onClick={start} disabled={running}>
            <span>{run ? ANALYSIS_COPY.rerun : ANALYSIS_COPY.run}</span>
          </button>
          <p className="status" role="status" aria-live="polite">
            {running ? ANALYSIS_COPY.running : ""}
          </p>
        </div>
      ) : (
        <p className="message" role="status">
          <strong>{ANALYSIS_COPY.modelOff.title}</strong>
          {ANALYSIS_COPY.modelOff.body}
        </p>
      )}

      {failureCopy && (
        <p className="message" role="alert">
          <strong>{failureCopy.title}</strong>
          {failureCopy.body}
        </p>
      )}

      {run && !running && (
        <p className="analysis-result">{flags.length === 0 ? ANALYSIS_COPY.empty : ANALYSIS_COPY.found(flags.length)}</p>
      )}

      <p className="analysis-scope">{ANALYSIS_COPY.scope}</p>
      <p className="analysis-vendor">{ANALYSIS_COPY.vendorOnly}</p>
    </section>
  );

  const tabs =
    flags.length > 0 ? (
      <nav className="flag-tabs" aria-label={ANALYSIS_COPY.flagsLabel}>
        <ul>
          {flags.map((flag, i) => {
            const number = clauseNumberAt(body, flag.citation.start);
            return (
              <li key={flag.id} style={{ ["--i" as string]: i }}>
                <button
                  type="button"
                  className={`flag-tab${flag.id === selected ? " is-selected" : ""}`}
                  aria-pressed={flag.id === selected}
                  aria-controls={citeId(flag)}
                  onClick={() => select(flag, { scroll: true })}
                >
                  <span className="flag-tab-type">{CLAUSE_LABEL[flag.clauseType]}</span>
                  {number && <span className="flag-tab-line">{ANALYSIS_COPY.clause(number)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    ) : null;

  const margin =
    flags.length > 0 ? (
      <div className="margin" ref={marginRef}>
        {flags.map((flag) => {
          const number = clauseNumberAt(body, flag.citation.start);
          return (
            <aside
              key={flag.id}
              className={`comment${flag.id === selected ? " is-selected" : ""}`}
              data-flag={flag.id}
              aria-label={`${CLAUSE_LABEL[flag.clauseType]}${number ? `, ${ANALYSIS_COPY.clause(number).toLowerCase()}` : ""}`}
            >
              <h3>
                {CLAUSE_LABEL[flag.clauseType]}
                {number && <span className="comment-clause">{ANALYSIS_COPY.clause(number)}</span>}
              </h3>
              <p>{CLAUSE_COMMENT[flag.clauseType]}</p>
            </aside>
          );
        })}
      </div>
    ) : null;

  return (
    <DocumentView
      title={title}
      body={body}
      sourceKind={sourceKind}
      addedAt={addedAt}
      notice={notice}
      analysis={panel}
      marks={marks}
      margin={margin}
      tabs={tabs}
      bodyRef={bodyRef}
      onBodyClick={onBodyClick}
    />
  );
}

/** A run to show beside `body`, with every citation checked against it, or null. */
function checked(run: AnalysisRun | null, body: string): { analysis: Analysis; ranAt: string } | null {
  if (!run) return null;
  const analysis = readStoredAnalysis(run.analysis, body);
  return analysis ? { analysis, ranAt: run.ranAt } : null;
}

// Before layout effects exist (the server render), skip measuring.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Places each margin comment level with its citation, pushed down when it
 * would overlap the one above. Only while the margin is a column beside the
 * text; on a narrow screen the CSS stacks the selected comment above the text.
 */
function useMarginLayout(
  bodyRef: RefObject<HTMLDivElement | null>,
  marginRef: RefObject<HTMLDivElement | null>,
  flags: Flag[],
) {
  useIsoLayoutEffect(() => {
    const bodyEl = bodyRef.current;
    const marginEl = marginRef.current;
    if (!bodyEl || !marginEl) return;

    const place = () => {
      const comments = [...marginEl.querySelectorAll<HTMLElement>(".comment")];
      const beside = comments.length > 0 && getComputedStyle(comments[0]).position === "absolute";
      let floor = 0;
      for (const comment of comments) {
        if (!beside) {
          comment.style.top = "";
          continue;
        }
        const mark = bodyEl.querySelector<HTMLElement>(`mark[data-flag="${comment.dataset.flag}"]`);
        const want = mark ? mark.getBoundingClientRect().top - marginEl.getBoundingClientRect().top : floor;
        const top = Math.max(want, floor);
        comment.style.top = `${top}px`;
        floor = top + comment.offsetHeight + 16;
      }
      marginEl.style.minHeight = beside ? `${floor}px` : "";
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(bodyEl);
    return () => observer.disconnect();
  }, [bodyRef, marginRef, flags]);
}
