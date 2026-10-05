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
import { describeRedLine } from "@/lib/engine/red-lines";
import { checkStoredAnalysis } from "@/lib/engine/stored";
import {
  EXPOSURE_PARTS,
  TIERS,
  type Analysis,
  type Citation,
  type Flag,
  type OutsideTermsNotice,
  type RedLine,
  type Tier,
} from "@/lib/engine/types";
import type { SourceKind } from "@/lib/extraction/limits";
import { analyseBrowserDocument, analyseSavedDocument, type AnalysisRun, type RunAnalysisResult } from "./actions";
import {
  ANALYSIS_COPY,
  CLAUSE_LABEL,
  CLEAN_COPY,
  EXPOSURE_LABEL,
  FAILURE_COPY,
  OUTSIDE_COPY,
  RED_LINE_COPY,
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
// Each outside-terms notice is a blue tab after the flags. Its sentence is
// underlined in place the same way, and its margin comment names the document
// to add next. A notice has no tier and no counter-offer. When the engine's
// clean-result rule says the result is clean, the panel says "No renewal or
// exit terms to negotiate" in plain words, with no tab colour, and lists the
// five clause types. When notices are what stops it being clean, the panel
// says so, so the buyer never takes unread terms as checked.
//
// Each flag that crosses one of the buyer's red lines names it in its margin
// comment and on its tab. The panel lists the red lines the run used (its
// snapshot), or says the run had none; a run in the browser only says, in one
// line, that red lines need an account.
//
// Every analysis shown here is read through checkStoredAnalysis against this
// document's own text first, so a citation that doesn't match the text at its
// offsets, an exposure fragment that isn't in its citation, or wording that
// fails the check is never rendered, wherever the analysis came from. Its
// breaches and tiers are worked out again there from the run's red lines.

export type AnalysisSource =
  /** A document in the buyer's library: runs are saved, and the latest is shown on load. */
  | { kind: "saved"; documentId: string; latest: AnalysisRun | null }
  /** A document kept in this browser tab only: runs are not saved, and have no red lines. */
  | { kind: "browser"; accountsConfigured: boolean };

type ShownRun = { analysis: Analysis; ranAt: string; redLines: RedLine[] };

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

/** Anything with a citation marked in the text: a flag ("f1") or an outside-terms notice ("n1"). */
type Marked = { id: string; citation: Citation };

const rangeKey = (c: Citation) => `${c.start}:${c.end}`;
const byPosition = (a: Marked, b: Marked) => a.citation.start - b.citation.start || a.citation.end - b.citation.end;

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
  const [run, setRun] = useState<ShownRun | null>(initial.run);
  const [storedNotice, setStoredNotice] = useState<StoredNotice | null>(initial.notice);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [selected, setSelected] = useState<string | null>(firstItemId(initial.run?.analysis ?? null));
  const [running, startRunning] = useTransition();
  const bodyRef = useRef<HTMLDivElement>(null);
  const marginRef = useRef<HTMLDivElement>(null);

  const flags = run?.analysis.flags ?? [];
  const notices = run?.analysis.outsideTerms ?? [];
  const outcome = run?.analysis.outcome ?? null;
  const items: (Flag | OutsideTermsNotice)[] = useMemo(() => [...flags, ...notices], [flags, notices]);

  // One mark per cited range. Two items citing the same sentence (a sentence
  // flagged as two clause types, or a flag on an outside-terms sentence) share it.
  const markIds = useMemo(() => {
    const ids = new Map<string, string>();
    const byRange = new Map<string, string>();
    for (const item of items) {
      const key = rangeKey(item.citation);
      if (!byRange.has(key)) byRange.set(key, `cite-${item.id}`);
      ids.set(item.id, byRange.get(key)!);
    }
    return ids;
  }, [items]);

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
      setSelected(firstItemId(next.analysis));
    });
  }

  const select = useCallback(
    (id: string, { scroll }: { scroll: boolean }) => {
      setSelected(id);
      if (!scroll) return;
      const markId = markIds.get(id);
      const mark = markId ? document.getElementById(markId) : null;
      if (!mark) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      mark.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      mark.focus({ preventScroll: true });
    },
    [markIds],
  );

  function onBodyClick(event: MouseEvent<HTMLDivElement>) {
    const mark = (event.target as HTMLElement).closest("mark[data-items]");
    const ids = mark?.getAttribute("data-items")?.split(" ") ?? [];
    if (ids.length === 0) return;
    // Clicking a shared sentence again moves to the next item on it.
    const at = selected ? ids.indexOf(selected) : -1;
    select(ids[(at + 1) % ids.length], { scroll: false });
  }

  const marks: TextMark[] = useMemo(() => {
    const byRange = new Map<string, Marked[]>();
    for (const item of [...items].sort(byPosition)) {
      const key = rangeKey(item.citation);
      byRange.set(key, [...(byRange.get(key) ?? []), item]);
    }
    return [...byRange.values()].map((group) => ({
      start: group[0].citation.start,
      end: group[0].citation.end,
      id: markIds.get(group[0].id),
      className: `cite${group.some((i) => i.id === selected) ? " is-selected" : ""}`,
      tabIndex: -1,
      data: { items: group.map((i) => i.id).join(" ") },
    }));
  }, [items, markIds, selected]);

  useMarginLayout(bodyRef, marginRef, items);

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

      {run && !running && outcome && !outcome.clean && flags.length > 0 && (
        <p className="analysis-result">{ANALYSIS_COPY.found(count("negotiate"), count("know"))}</p>
      )}

      {run && !running && outcome && !outcome.clean && outcome.outsideTermsNotices > 0 && (
        <p className="analysis-outside">
          <span className="comment-swatch comment-swatch--outside" aria-hidden="true" />
          {OUTSIDE_COPY.notClean(outcome.outsideTermsNotices)}
        </p>
      )}

      {run && !running && outcome?.clean && (
        <section className="clean-result" aria-labelledby={`${ids}-clean`}>
          <h3 id={`${ids}-clean`}>{CLEAN_COPY.heading}</h3>
          <p>{CLEAN_COPY.body}</p>
          <ul className="checklist" aria-label={CLEAN_COPY.listLabel}>
            {outcome.checklist.map((entry) => (
              <li key={entry.clauseType}>
                <span className="checklist-type">{CLAUSE_LABEL[entry.clauseType]}</span>
                {entry.status === "found_low_exposure" ? (
                  <span className="checklist-status">
                    {CLEAN_COPY.found}
                    {entry.found.map(({ flagId, citation }) => {
                      const number = clauseNumberAt(body, citation.start);
                      return (
                        <a
                          key={flagId}
                          className="checklist-cite"
                          href={`#${markIds.get(flagId) ?? ""}`}
                          onClick={(event) => {
                            event.preventDefault();
                            select(flagId, { scroll: true });
                          }}
                        >
                          {number ? ANALYSIS_COPY.clause(number) : CLEAN_COPY.goTo}
                        </a>
                      );
                    })}
                  </span>
                ) : (
                  <span className="checklist-status">{CLEAN_COPY.none}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="clean-miss">{CLEAN_COPY.miss}</p>
        </section>
      )}

      {source.kind === "browser" ? (
        <p className="analysis-redlines-none">{RED_LINE_COPY.needAccount}</p>
      ) : (
        run &&
        !running &&
        (run.redLines.length === 0 ? (
          <p className="analysis-redlines-none">
            {RED_LINE_COPY.noneSet} <a href="/red-lines">{RED_LINE_COPY.setThem}</a>
          </p>
        ) : (
          <section className="analysis-redlines" aria-labelledby={`${ids}-redlines`}>
            <h3 id={`${ids}-redlines`}>{RED_LINE_COPY.usedLabel}</h3>
            <ul>
              {run.redLines.map((redLine, i) => (
                <li key={redLine.id ?? i}>{describeRedLine(redLine)}</li>
              ))}
            </ul>
            <p className="analysis-redlines-note">
              {RED_LINE_COPY.rerunHint} <a href="/red-lines">{RED_LINE_COPY.edit}</a>
            </p>
          </section>
        ))
      )}

      <p className="analysis-scope">{ANALYSIS_COPY.scope}</p>
      <p className="analysis-vendor">{ANALYSIS_COPY.vendorOnly}</p>
    </section>
  );

  let tabIndex = 0;
  const tabs =
    items.length > 0 ? (
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
                        aria-controls={markIds.get(flag.id)}
                        onClick={() => select(flag.id, { scroll: true })}
                      >
                        <span className="flag-tab-type">{CLAUSE_LABEL[flag.clauseType]}</span>
                        <span className="flag-tab-line">{tabExposure(flag)}</span>
                        {flag.redLineBreaches.length > 0 && (
                          <span className="flag-tab-redline">
                            {RED_LINE_COPY.tab}: {flag.redLineBreaches.map((b) => describeRedLine(b.redLine)).join("; ")}
                          </span>
                        )}
                        <span className="flag-tab-tier">{TIER_LABEL[flag.tier]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          {notices.length > 0 && (
            <section className="flag-group flag-group--outside" aria-labelledby={`${ids}-outside`}>
              <h3 id={`${ids}-outside`} className="flag-group-head">
                {OUTSIDE_COPY.label}
              </h3>
              <p className="flag-group-note">{OUTSIDE_COPY.note}</p>
              <ul>
                {notices.map((notice) => (
                  <li key={notice.id} style={{ ["--i" as string]: tabIndex++ }}>
                    <button
                      type="button"
                      className={`flag-tab flag-tab--outside${notice.id === selected ? " is-selected" : ""}`}
                      aria-pressed={notice.id === selected}
                      aria-controls={markIds.get(notice.id)}
                      onClick={() => select(notice.id, { scroll: true })}
                    >
                      <span className="flag-tab-type">{OUTSIDE_COPY.label}</span>
                      <span className="flag-tab-line">{notice.document}</span>
                      <span className="flag-tab-tier">{OUTSIDE_COPY.tabStatus}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </nav>
    ) : null;

  // In document order, so each comment can sit level with its sentence.
  const inDocumentOrder = [...items].sort(byPosition);

  const margin =
    items.length > 0 ? (
      <div className="margin" ref={marginRef}>
        {inDocumentOrder.map((item) => {
          if (isNotice(item)) return <NoticeComment key={item.id} notice={item} body={body} selected={item.id === selected} />;
          const flag = item;
          const number = clauseNumberAt(body, flag.citation.start);
          const parts = EXPOSURE_PARTS.filter((part) => flag.exposure[part] !== undefined);
          return (
            <aside
              key={flag.id}
              className={`comment comment--${flag.tier}${flag.id === selected ? " is-selected" : ""}`}
              data-item={flag.id}
              aria-label={`${CLAUSE_LABEL[flag.clauseType]}${number ? `, ${ANALYSIS_COPY.clause(number).toLowerCase()}` : ""}`}
            >
              <h3>
                <span className="comment-swatch" aria-hidden="true" />
                {CLAUSE_LABEL[flag.clauseType]}
                {number && <span className="comment-clause">{ANALYSIS_COPY.clause(number)}</span>}
              </h3>
              <p className="comment-tier">{TIER_LABEL[flag.tier]}</p>
              {flag.redLineBreaches.map((breach, i) => (
                <p key={i} className="comment-redline">
                  <strong>{RED_LINE_COPY.crosses}:</strong> {describeRedLine(breach.redLine)}.
                  {breach.cited !== null && (
                    <>
                      {" "}
                      {RED_LINE_COPY.citedFigure} <q>{breach.cited}</q>.
                    </>
                  )}
                </p>
              ))}
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

function isNotice(item: Flag | OutsideTermsNotice): item is OutsideTermsNotice {
  return "document" in item;
}

/** The first item to select: the top-ranked flag, or the first notice when there are no flags. */
function firstItemId(analysis: Analysis | null): string | null {
  return analysis?.flags[0]?.id ?? analysis?.outsideTerms[0]?.id ?? null;
}

/** An outside-terms notice in the margin: what the sentence does and the document to add next. No tier, no counter-offer. */
function NoticeComment({ notice, body, selected }: { notice: OutsideTermsNotice; body: string; selected: boolean }) {
  const number = clauseNumberAt(body, notice.citation.start);
  return (
    <aside
      className={`comment comment--outside${selected ? " is-selected" : ""}`}
      data-item={notice.id}
      aria-label={`${OUTSIDE_COPY.label}${number ? `, ${ANALYSIS_COPY.clause(number).toLowerCase()}` : ""}`}
    >
      <h3>
        <span className="comment-swatch" aria-hidden="true" />
        {OUTSIDE_COPY.label}
        {number && <span className="comment-clause">{ANALYSIS_COPY.clause(number)}</span>}
      </h3>
      <p>{OUTSIDE_COPY.comment}</p>
      <dl className="comment-exposure">
        <div>
          <dt>{OUTSIDE_COPY.uploadNext}</dt>
          <dd className="comment-document">{notice.document}</dd>
        </div>
      </dl>
    </aside>
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
 * piece of wording checked against it and every breach worked out again from
 * the run's red lines, or why a saved one can't be shown.
 */
function checkRun(run: AnalysisRun | null, body: string): { run: ShownRun | null; notice: StoredNotice | null } {
  if (!run) return { run: null, notice: null };
  const check = checkStoredAnalysis(run.analysis, body, run.redLines);
  if (check.ok) return { run: { analysis: check.analysis, ranAt: run.ranAt, redLines: check.redLines }, notice: null };
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
  items: Marked[],
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
        const mark = bodyEl.querySelector<HTMLElement>(`mark[data-items~="${comment.dataset.item}"]`);
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
  }, [bodyRef, marginRef, items]);
}
