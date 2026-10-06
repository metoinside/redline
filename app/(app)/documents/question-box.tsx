"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { MAX_QUESTION_CHARS, checkQuestion, readStoredAnswer } from "@/lib/engine/answers";
import type { Answer, Citation } from "@/lib/engine/types";
import { askBrowserDocument, askSavedDocument, type AskQuestionResult, type AskedQuestion } from "./actions";
import { ASK_COPY, ASK_FAILURE_COPY } from "./analysis-copy";

// The question box (PRD §3 item 7). The buyer asks in plain English; the
// server runs the engine's ask() and returns either an answer with the
// sentence it relies on, or "the document doesn't say". Every answer shown
// here, saved or new, is read through readStoredAnswer against this
// document's own text first, so an answer whose citation doesn't match the
// text at its offsets is shown as "the document doesn't say", and one whose
// wording fails the check is not shown at all.
//
// The cited sentence of each answer is marked in the document text by the
// analysed document view (AnalysedDocument), which owns the marks. This box
// holds the questions and tells it which answer is selected.

/** A question ready to show: its answer checked against the text, or null when the saved one can't be shown. */
export type ShownQuestion = {
  /** Unique on the page. Also the id of its citation mark ("q-..."). */
  key: string;
  question: string;
  answer: Answer | null;
  askedAt: string;
};

export type QuestionSource =
  | { kind: "saved"; documentId: string }
  | { kind: "browser" };

type Failure = keyof typeof ASK_FAILURE_COPY;

const askedFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** A question from the server, with its answer checked against `body`. */
export function showQuestion(asked: AskedQuestion, body: string, fallbackKey: string): ShownQuestion {
  return {
    key: `q-${asked.id ?? fallbackKey}`,
    question: asked.question,
    answer: readStoredAnswer(asked.result, body),
    askedAt: asked.askedAt,
  };
}

/** The citation each answered question puts in the text, keyed like its question. */
export function answerMarks(questions: readonly ShownQuestion[]): { id: string; citation: Citation }[] {
  return questions.flatMap((q) => (q.answer?.kind === "answered" ? [{ id: q.key, citation: q.answer.citation }] : []));
}

export function QuestionBox({
  source,
  body,
  modelConfigured,
  questions,
  loadFailed,
  selected,
  onAsked,
  sentenceLink,
}: {
  source: QuestionSource;
  body: string;
  modelConfigured: boolean;
  /** Newest first. */
  questions: readonly ShownQuestion[];
  /** The saved document's earlier questions couldn't be loaded. */
  loadFailed: boolean;
  selected: string | null;
  onAsked: (question: ShownQuestion) => void;
  /** A link that selects an answer and scrolls the document to its sentence. */
  sentenceLink: (id: string, citation: Citation, fallback: string, className: string) => ReactNode;
}) {
  const ids = useId();
  const [draft, setDraft] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [running, startRunning] = useTransition();
  const [asked, setAsked] = useState(0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = checkQuestion(draft);
    if (!checked.ok) {
      setFailure(`question-${checked.problem}`);
      return;
    }
    setFailure(null);
    startRunning(async () => {
      let result: AskQuestionResult;
      try {
        result =
          source.kind === "saved"
            ? await askSavedDocument(source.documentId, checked.question)
            : await askBrowserDocument(body, checked.question);
      } catch {
        setFailure("unreachable");
        return;
      }
      if (!result.ok) {
        setFailure(result.reason);
        return;
      }
      const shown = showQuestion(result.asked, body, `new-${asked}`);
      setAsked((n) => n + 1);
      setDraft("");
      onAsked(shown);
    });
  }

  const failureCopy = failure ? ASK_FAILURE_COPY[failure] : null;

  return (
    <section className="ask" aria-labelledby={`${ids}-ask`} aria-busy={running}>
      <h2 id={`${ids}-ask`}>{ASK_COPY.heading}</h2>
      <p className="ask-note">{ASK_COPY.note}</p>

      {modelConfigured ? (
        <form className="ask-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor={`${ids}-question`}>{ASK_COPY.label}</label>
            <input
              id={`${ids}-question`}
              name="question"
              type="text"
              autoComplete="off"
              maxLength={MAX_QUESTION_CHARS}
              placeholder={ASK_COPY.placeholder}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={running}
              aria-describedby={`${ids}-hint`}
            />
            <p className="hint" id={`${ids}-hint`}>
              {ASK_COPY.hint}
              {source.kind === "browser" && <> {ASK_COPY.notSaved}</>}
            </p>
          </div>
          <div className="ask-run">
            <button type="submit" className="action" disabled={running}>
              <span>{ASK_COPY.ask}</span>
            </button>
            <p className="status" role="status" aria-live="polite">
              {running ? ASK_COPY.running : ""}
            </p>
          </div>
        </form>
      ) : (
        <p className="message" role="status">
          <strong>{ASK_COPY.modelOff.title}</strong>
          {ASK_COPY.modelOff.body}
        </p>
      )}

      {failureCopy && (
        <p className="message" role="alert">
          <strong>{failureCopy.title}</strong>
          {failureCopy.body}
        </p>
      )}

      {loadFailed && (
        <p className="message" role="status">
          {ASK_COPY.loadFailed}
        </p>
      )}

      {questions.length > 0 && (
        <section className="asked" aria-labelledby={`${ids}-asked`}>
          <h3 id={`${ids}-asked`}>{source.kind === "saved" ? ASK_COPY.earlier : ASK_COPY.thisVisit}</h3>
          <ul className="asked-list">
            {questions.map((q) => (
              <li key={q.key} className={q.key === selected ? "is-selected" : undefined}>
                <p className="asked-question">{q.question}</p>
                <AnswerView question={q} sentenceLink={sentenceLink} />
                <p className="asked-at">
                  {ASK_COPY.askedAt}{" "}
                  <time dateTime={q.askedAt} suppressHydrationWarning>
                    {askedFormat.format(new Date(q.askedAt))}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function AnswerView({
  question,
  sentenceLink,
}: {
  question: ShownQuestion;
  sentenceLink: (id: string, citation: Citation, fallback: string, className: string) => ReactNode;
}) {
  const { answer } = question;
  if (answer === null) return <p className="asked-answer asked-answer--rejected">{ASK_COPY.rejected}</p>;
  if (answer.kind === "not-said") {
    return (
      <>
        <p className="asked-answer asked-answer--not-said">
          <strong>{ASK_COPY.answerLead}</strong> {ASK_COPY.notSaid}.
        </p>
        <p className="asked-note">{ASK_COPY.notSaidNote}</p>
      </>
    );
  }
  return (
    <>
      <p className="asked-answer">
        <strong>{ASK_COPY.answerLead}</strong> {answer.text}
      </p>
      <figure className="asked-cite">
        <figcaption>{ASK_COPY.citedLabel}</figcaption>
        <blockquote>{answer.citation.text}</blockquote>
      </figure>
      {sentenceLink(question.key, answer.citation, ASK_COPY.goTo, "sentence-link")}
    </>
  );
}
