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
import { checkStoredAnalysis } from "@/lib/engine/stored";
import { EXPOSURE_PARTS, TIERS, type Analysis, type Flag, type Tier } from "@/lib/engine/types";
import type { SourceKind } from "@/lib/extraction/limits";
import { analyseBrowserDocument, analyseSavedDocument, type AnalysisRun, type RunAnalysisResult } from "./actions";
import {
  ANALYSIS_COPY,
  CLAUSE_LABEL,
  EXPOSURE_LABEL,
  FAILURE_COPY,
  TIER_LABEL,
  TIER_NOTE,
  clauseNumberAt,
} from "./analysis-copy";
import type { TextMark } from "./document-text";
import { DocumentView } from "./document-view";

// The document view with its analysis: a control to run it, the running
// state, and the result. Each flag is a tab on the sheet's edge, in its tier's
// colour (red for Negotiate before signing, yellow for Know before signing),
// grouped by tier in ranked order. Selecting one scrolls to its citation,
// which carries the red pen underline in place, and its margin comment sits
// beside the sentence with the plain statement, the cited exposure and, for a
// clause that reads two ways, both readings.
//
// Every analysis shown here is read through checkStoredAnalysis against this
// document's own text first, so a citation that doesn't match the text at its
// offsets, an exposure fragment that isn't in its citation, or wording that
// fails the check is never rendered, wherever the analysis came from.

export type AnalysisSource =
  /** A document in the buyer's library: runs are saved, and the latest is shown on load. */
  | { kind: "saved"; documentId: string; latest: AnalysisRun | null }
  /** A document kept in this browser tab only: runs are not saved. */
  | { kind: "browser" };

type Failure = keyof typeof FAILURE_COPY;

/** Why a saved analysis isn't shown on load. */
type StoredNotice = "outdated" | "rejected";

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
  const [initial] = useState(() => checkRun(source.kind === "saved" ? source.latest : null, body));
  const [run, setRun] = useState<{ analysis: Analysis; ranAt: string } | null>(initial.run);
  const [storedNotice, setStoredNotice] = useState<StoredNotice | null>(initial.notice);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [selected, setSelected] = useState<string | null>(initial.run?.analysis.flags[0]?.id ?? null);
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
      const next = checkRun(result.run, body).run;
      if (!next) {
        setFailure("model-failed");
        return;
      }
      setStoredNotice(null);
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
  const storedCopy = storedNotice ? ANALYSIS_COPY[storedNotice] : null;
  const byTier = TIERS.map((tier) => ({ tier, flags: flags.filter((f) => f.tier === tier) }));
  const count = (tier: Tier) => flags.filter((f) => f.tier === tier).length;

  const panel = (
    <section className="analysis" aria-labelledby={`${ids}-analysis`} aria-busy={running}>
      <div className="analysis-head">
        <h2 id={`${ids}-analysis`}>{ANALYSIS_COPY.heading}</h2>
        {ranOn ?? (storedNotice ? null : <p className="analysis-ran">{ANALYSIS_COPY.notRun}</p>)}
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

      {storedCopy && !run && (
        <p className="message" role="status">
          <strong>{storedCopy.title}</strong>
          {storedCopy.body}
        </p>
      )}

      {failureCopy && (
        <p className="message" role="alert">
          <strong>{failureCopy.title}</strong>
          {failureCopy.body}
        </p>
      )}

      {run && !running && (
        <p className="analysis-result">
          {flags.length === 0 ? ANALYSIS_COPY.empty : ANALYSIS_COPY.found(count("negotiate"), count("know"))}
        </p>
      )}

      <p className="analysis-scope">{ANALYSIS_COPY.scope}</p>
      <p className="analysis-vendor">{ANALYSIS_COPY.vendorOnly}</p>
    </section>
  );

  let tabIndex = 0;
  const tabs =
    flags.length > 0 ? (
      <nav className="flag-tabs" aria-label={ANALYSIS_COPY.flagsLabel}>
        <div className="flag-groups">
          {byTier
            .filter((group) => group.flags.length > 0)
            .map(({ tier, flags: tierFlags }) => (
              <section key={tier} className={`flag-group flag-group--${tier}`} aria-labelledby={`${ids}-tier-${tier}`}>
                <h3 id={`${ids}-tier-${tier}`} className="flag-group-head">
                  {TIER_LABEL[tier]}
                </h3>
                <p className="flag-group-note">{TIER_NOTE[tier]}</p>
                <ul>
                  {tierFlags.map((flag) => (
                    <li key={flag.id} style={{ ["--i" as string]: tabIndex++ }}>
                      <button
                        type="button"
                        className={`flag-tab flag-tab--${flag.tier}${flag.id === selected ? " is-selected" : ""}`}
                        aria-pressed={flag.id === selected}
                        aria-controls={citeId(flag)}
                        onClick={() => select(flag, { scroll: true })}
                      >
                        <span className="flag-tab-type">{CLAUSE_LABEL[flag.clauseType]}</span>
                        <span className="flag-tab-line">{tabExposure(flag)}</span>
                        <span className="flag-tab-tier">{TIER_LABEL[flag.tier]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </nav>
    ) : null;

  // In document order, so each comment can sit level with its sentence.
  const inDocumentOrder = [...flags].sort((a, b) => a.citation.start - b.citation.start || a.citation.end - b.citation.end);

  const margin =
    flags.length > 0 ? (
      <div className="margin" ref={marginRef}>
        {inDocumentOrder.map((flag) => {
          const number = clauseNumberAt(body, flag.citation.start);
          const parts = EXPOSURE_PARTS.filter((part) => flag.exposure[part] !== undefined);
          return (
            <aside
              key={flag.id}
              className={`comment comment--${flag.tier}${flag.id === selected ? " is-selected" : ""}`}
              data-flag={flag.id}
              aria-label={`${CLAUSE_LABEL[flag.clauseType]}${number ? `, ${ANALYSIS_COPY.clause(number).toLowerCase()}` : ""}`}
            >
              <h3>
                <span className="comment-swatch" aria-hidden="true" />
                {CLAUSE_LABEL[flag.clauseType]}
                {number && <span className="comment-clause">{ANALYSIS_COPY.clause(number)}</span>}
              </h3>
              <p className="comment-tier">{TIER_LABEL[flag.tier]}</p>
              <p>{flag.statement}</p>
              {parts.length > 0 ? (
                <dl className="comment-exposure">
                  {parts.map((part) => (
                    <div key={part}>
                      <dt>{EXPOSURE_LABEL[part]}</dt>
                      <dd>
                        <q>{flag.exposure[part]}</q>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="comment-none">{ANALYSIS_COPY.noExposure}</p>
              )}
              {flag.readings.length === 2 && (
                <div className="comment-readings">
                  <p>{ANALYSIS_COPY.twoReadings}</p>
                  <ol>
                    {flag.readings.map((reading) => (
                      <li key={reading}>{reading}</li>
                    ))}
                  </ol>
                </div>
              )}
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

/** The exposure line on a flag's tab: the first part its sentence cites, in the document's words. */
function tabExposure(flag: Flag): string {
  const part = EXPOSURE_PARTS.find((p) => flag.exposure[p] !== undefined);
  if (part) return flag.exposure[part]!;
  return flag.readings.length === 2 ? ANALYSIS_COPY.twoReadingsShort : ANALYSIS_COPY.noExposureShort;
}

/**
 * A run to show beside `body`, with every citation, exposure fragment and
 * piece of wording checked against it, or why a saved one can't be shown.
 */
function checkRun(
  run: AnalysisRun | null,
  body: string,
): { run: { analysis: Analysis; ranAt: string } | null; notice: StoredNotice | null } {
  if (!run) return { run: null, notice: null };
  const check = checkStoredAnalysis(run.analysis, body);
  if (check.ok) return { run: { analysis: check.analysis, ranAt: run.ranAt }, notice: null };
  return { run: null, notice: check.reason === "outdated" ? "outdated" : "rejected" };
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
