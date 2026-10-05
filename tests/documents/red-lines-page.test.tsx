import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { deleteRedLine, saveRedLine } from "@/app/(app)/red-lines/actions";
import RedLinesPage from "@/app/(app)/red-lines/page";
import { LIMIT_FIELD, RED_LINE_ERRORS, RED_LINE_FORM, RED_LINES_PAGE } from "@/app/(app)/red-lines/red-lines-copy";
import { RedLinesEditor } from "@/app/(app)/red-lines/red-lines-editor";
import type { RedLine } from "@/lib/engine/types";

// The red lines page. With no Supabase project, it says accounts aren't set
// up and its actions save nothing. With red lines, it lists each in plain
// words with a way to change or delete it, and always offers a form to add
// one: a clause type from the family and a limit that suits it.

beforeAll(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

const decode = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("red lines on a server without accounts", () => {
  it("says accounts are not set up, and shows no form", async () => {
    const html = renderToStaticMarkup(await RedLinesPage());
    expect(html).toContain("Accounts aren’t set up on this server.");
    expect(html).toContain(RED_LINES_PAGE.accountsOffBody);
    expect(html).not.toContain("<form");
  });

  it("saves and deletes nothing", async () => {
    const form = new FormData();
    form.set("clauseType", "notice_window");
    form.set("limitKind", "limit");
    form.set("limitValue", "60");
    expect(await saveRedLine({ kind: "idle" }, form)).toEqual({ kind: "error", message: RED_LINE_ERRORS.accountsOff });
    form.set("id", "11111111-1111-4111-8111-111111111111");
    expect(await deleteRedLine({ kind: "idle" }, form)).toEqual({ kind: "error", message: RED_LINE_ERRORS.accountsOff });
  });
});

describe("the red lines editor", () => {
  it("shows the empty state and the form to add the first red line", () => {
    const html = renderToStaticMarkup(<RedLinesEditor redLines={[]} />);
    expect(decode(html)).toContain(RED_LINES_PAGE.emptyTitle);
    expect(decode(html)).toContain(RED_LINES_PAGE.addHeading);
    expect([...html.matchAll(/<option value="(\w+)"/g)].map((m) => m[1])).toEqual([
      "auto_renewal",
      "notice_window",
      "early_termination_fee",
      "rollover",
      "multi_year_term",
    ]);
    expect(html).toMatch(/<input type="radio" name="limitKind" value="not_allowed"/);
    expect(html).toMatch(/<input type="radio" name="limitKind" checked="" value="limit"/);
    // The default clause type is a notice window, so the figure is in days.
    expect(decode(html)).toContain(LIMIT_FIELD.notice_window);
  });

  it("lists each red line in plain words, with a way to change or delete it", () => {
    const redLines: RedLine[] = [
      { id: "11111111-1111-4111-8111-111111111111", clauseType: "notice_window", limit: { kind: "max_days", value: 60 } },
      { id: "22222222-2222-4222-8222-222222222222", clauseType: "early_termination_fee", limit: { kind: "max_dollars", value: 25000 } },
      { id: "33333333-3333-4333-8333-333333333333", clauseType: "auto_renewal", limit: { kind: "not_allowed" } },
    ];
    const html = renderToStaticMarkup(<RedLinesEditor redLines={redLines} />);
    const rows = [...html.matchAll(/<span class="redline-text">([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(rows).toEqual(["No notice window longer than 60 days", "No early termination fee over $25,000", "No auto-renewal"]);
    expect(html.match(new RegExp(`>${RED_LINE_FORM.edit}<`, "g"))).toHaveLength(3);
    expect(html.match(new RegExp(`>${RED_LINE_FORM.delete}<`, "g"))).toHaveLength(3);
    for (const { id } of redLines) expect(html).toContain(`name="id" value="${id}"`);
    expect(decode(html)).toContain(RED_LINES_PAGE.rerun);
    expect(decode(html)).not.toContain(RED_LINES_PAGE.emptyTitle);
  });
});
