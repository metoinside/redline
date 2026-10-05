import { describe, expect, it } from "vitest";
import { readRedLineInput, rowValues } from "@/lib/red-lines/input";
import { redLineFromRow } from "@/lib/red-lines/rows";

// What the red lines page's server actions accept. The browser's form is not
// trusted: each field is checked again on the server before anything is saved,
// with the same rules as the table's check constraints.

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("reading a red line from the form", () => {
  it("reads a figure-limit in the unit its clause type takes", () => {
    expect(readRedLineInput(form({ clauseType: "notice_window", limitKind: "limit", limitValue: "60" }))).toEqual({
      ok: true,
      redLine: { clauseType: "notice_window", limit: { kind: "max_days", value: 60 } },
    });
    expect(readRedLineInput(form({ clauseType: "multi_year_term", limitKind: "limit", limitValue: " 24 " }))).toEqual({
      ok: true,
      redLine: { clauseType: "multi_year_term", limit: { kind: "max_months", value: 24 } },
    });
    expect(readRedLineInput(form({ clauseType: "early_termination_fee", limitKind: "limit", limitValue: "$25,000" }))).toEqual({
      ok: true,
      redLine: { clauseType: "early_termination_fee", limit: { kind: "max_dollars", value: 25000 } },
    });
  });

  it("reads 'not allowed' and ignores any figure sent with it", () => {
    expect(readRedLineInput(form({ clauseType: "rollover", limitKind: "not_allowed", limitValue: "12" }))).toEqual({
      ok: true,
      redLine: { clauseType: "rollover", limit: { kind: "not_allowed" } },
    });
  });

  it("refuses a clause type outside the family, an unknown limit, or a figure that isn't a whole number in range", () => {
    expect(readRedLineInput(form({ clauseType: "indemnity", limitKind: "not_allowed" }))).toEqual({ ok: false, error: "clause-type" });
    expect(readRedLineInput(form({ clauseType: "rollover", limitKind: "max_dollars", limitValue: "5" }))).toEqual({
      ok: false,
      error: "limit-kind",
    });
    for (const value of ["", "0", "-5", "60.5", "sixty", "3651", "1e3"]) {
      expect(readRedLineInput(form({ clauseType: "notice_window", limitKind: "limit", limitValue: value }))).toEqual({
        ok: false,
        error: "value",
        kind: "max_days",
      });
    }
    expect(readRedLineInput(form({ clauseType: "early_termination_fee", limitKind: "limit", limitValue: "100,000,001" }))).toMatchObject({
      ok: false,
      error: "value",
    });
  });

  it("turns a red line into table values and back", () => {
    const read = readRedLineInput(form({ clauseType: "auto_renewal", limitKind: "limit", limitValue: "12" }));
    if (!read.ok) throw new Error("expected a red line");
    const values = rowValues(read.redLine);
    expect(values).toEqual({ clause_type: "auto_renewal", limit_kind: "max_months", limit_value: 12 });
    expect(redLineFromRow({ id: "x", ...values })).toEqual({ id: "x", ...read.redLine });
    expect(rowValues({ clauseType: "rollover", limit: { kind: "not_allowed" } })).toEqual({
      clause_type: "rollover",
      limit_kind: "not_allowed",
      limit_value: null,
    });
  });
});
