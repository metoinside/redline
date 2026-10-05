"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { describeRedLine } from "@/lib/engine/red-lines";
import { CLAUSE_TYPES, NUMERIC_LIMIT_KIND, type ClauseType, type RedLine } from "@/lib/engine/types";
import { CLAUSE_LABEL } from "../documents/analysis-copy";
import { deleteRedLine, saveRedLine, type RedLineFormState } from "./actions";
import { LIMIT_FIELD, RED_LINES_PAGE, RED_LINE_FORM } from "./red-lines-copy";

// The red lines list and its forms. Each red line is a clause type from the
// family plus a limit that suits it: "not allowed at all", or a figure in the
// one unit that clause type states (days for a notice window, dollars for a
// fee, months for the rest). The server checks every field again.

const IDLE: RedLineFormState = { kind: "idle" };

export function RedLinesEditor({ redLines }: { redLines: RedLine[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  // A new key empties the add form after each save.
  const [addKey, setAddKey] = useState(0);

  return (
    <div className="redlines">
      <p className="redlines-note">{RED_LINES_PAGE.howChecked}</p>

      {redLines.length === 0 ? (
        <div className="empty">
          <h2>{RED_LINES_PAGE.emptyTitle}</h2>
          <p>{RED_LINES_PAGE.emptyBody}</p>
        </div>
      ) : (
        <>
          <ul className="redline-list" aria-label={RED_LINES_PAGE.listLabel}>
            {redLines.map((redLine) => (
              <li key={redLine.id}>
                {editing === redLine.id ? (
                  <RedLineForm initial={redLine} onDone={() => setEditing(null)} />
                ) : (
                  <div className="redline-row">
                    <span className="redline-text">{describeRedLine(redLine)}</span>
                    <span className="redline-actions">
                      <button type="button" className="text-action" onClick={() => setEditing(redLine.id ?? null)}>
                        {RED_LINE_FORM.edit}
                      </button>
                      <DeleteRedLine id={redLine.id!} />
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="redlines-note">{RED_LINES_PAGE.rerun}</p>
        </>
      )}

      <section className="redline-add" aria-labelledby="red-line-add">
        <h2 id="red-line-add">{RED_LINES_PAGE.addHeading}</h2>
        <RedLineForm key={addKey} onDone={() => setAddKey((k) => k + 1)} />
      </section>
    </div>
  );
}

function RedLineForm({ initial, onDone }: { initial?: RedLine; onDone: () => void }) {
  const ids = useId();
  const [state, action, pending] = useActionState(saveRedLine, IDLE);
  const [clauseType, setClauseType] = useState<ClauseType>(initial?.clauseType ?? "notice_window");
  const [limitKind, setLimitKind] = useState<"not_allowed" | "limit">(initial?.limit.kind === "not_allowed" ? "not_allowed" : "limit");
  const initialValue = initial && initial.limit.kind !== "not_allowed" ? String(initial.limit.value) : "";

  // Only a new save calls onDone, whatever onDone's identity.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (state.kind === "saved") done.current();
  }, [state]);

  const unitChanged = initial !== undefined && NUMERIC_LIMIT_KIND[initial.clauseType] !== NUMERIC_LIMIT_KIND[clauseType];

  return (
    <form className="form redline-form" action={action}>
      {state.kind === "error" && (
        <p className="message" role="alert">
          {state.message}
        </p>
      )}
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="field">
        <label htmlFor={`${ids}-type`}>{RED_LINE_FORM.clauseType}</label>
        <select
          id={`${ids}-type`}
          name="clauseType"
          value={clauseType}
          onChange={(event) => setClauseType(event.target.value as ClauseType)}
          disabled={pending}
        >
          {CLAUSE_TYPES.map((type) => (
            <option key={type} value={type}>
              {CLAUSE_LABEL[type]}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="field choice" disabled={pending}>
        <legend>{RED_LINE_FORM.limit}</legend>
        <label>
          <input type="radio" name="limitKind" value="not_allowed" checked={limitKind === "not_allowed"} onChange={() => setLimitKind("not_allowed")} />
          {RED_LINE_FORM.notAllowed}
        </label>
        <label>
          <input type="radio" name="limitKind" value="limit" checked={limitKind === "limit"} onChange={() => setLimitKind("limit")} />
          {RED_LINE_FORM.upTo}
        </label>
      </fieldset>
      {limitKind === "limit" && (
        <div className="field field--short">
          <label htmlFor={`${ids}-value`}>{LIMIT_FIELD[clauseType]}</label>
          <input
            // A different unit starts the figure afresh.
            key={unitChanged ? `${clauseType}-new` : "value"}
            id={`${ids}-value`}
            name="limitValue"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            required
            defaultValue={unitChanged ? "" : initialValue}
            disabled={pending}
          />
        </div>
      )}
      <div className="form-actions">
        <button className="action" type="submit" disabled={pending}>
          <span>{initial ? RED_LINE_FORM.save : RED_LINE_FORM.add}</span>
        </button>
        {initial && (
          <button type="button" className="text-action" onClick={onDone} disabled={pending}>
            {RED_LINE_FORM.cancel}
          </button>
        )}
        <p className="status" role="status" aria-live="polite">
          {pending ? RED_LINE_FORM.saving : ""}
        </p>
      </div>
    </form>
  );
}

function DeleteRedLine({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteRedLine, IDLE);
  return (
    <form action={action} className="redline-delete">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-action" disabled={pending}>
        {pending ? RED_LINE_FORM.deleting : RED_LINE_FORM.delete}
      </button>
      {state.kind === "error" && (
        <span className="redline-error" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
