import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import NewDocumentPage from "@/app/(app)/new/page";
import { saveDocument } from "@/app/(app)/new/actions";
import { checkNewDocument, suggestTitle } from "@/lib/documents/new-document";
import { MAX_DOCUMENT_CHARS } from "@/lib/extraction";
import { loadFixture } from "../fixtures/index";

const { text: contract } = loadFixture("adhesion-contract");

beforeAll(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

describe("the add-a-document page", () => {
  it("offers upload and paste, with a file input that can't be submitted", async () => {
    const html = renderToStaticMarkup(await NewDocumentPage());
    expect(html).toContain("Upload a file");
    expect(html).toContain("Paste the text");
    // No form at all, so nothing on the page can post a file.
    expect(html).not.toMatch(/<form/);
    const fileInputs = [...html.matchAll(/<input[^>]*type="file"[^>]*>/g)].map((m) => m[0]);
    expect(fileInputs).toHaveLength(1);
    expect(fileInputs[0]).not.toMatch(/\sname=/);
    expect(fileInputs[0]).toMatch(/accept="[^"]*\.pdf[^"]*\.docx/);
  });

  it("says the document stays in this tab when accounts aren't set up", async () => {
    const html = renderToStaticMarkup(await NewDocumentPage());
    expect(html).toContain("Accounts aren’t set up on this server, so this document stays in this browser tab");
    expect(html).toContain("Open the document");
  });
});

describe("saving a document", () => {
  it("does nothing on a server without accounts", async () => {
    await expect(saveDocument({ title: "MSA", body: contract, sourceKind: "pdf" })).resolves.toEqual({
      ok: false,
      reason: "accounts-off",
    });
  });

  it("accepts the three fields and stores the text in canonical form", () => {
    const check = checkNewDocument({ title: "  Halvard   MSA ", body: contract.replace(/\n/g, "\r\n"), sourceKind: "docx" });
    expect(check).toEqual({ ok: true, document: { title: "Halvard MSA", body: contract, sourceKind: "docx" } });
  });

  it("reads nothing but title, body and source kind", () => {
    const check = checkNewDocument({ title: "MSA", body: contract, sourceKind: "pdf", file: new Uint8Array(4), user_id: "x" });
    expect(check.ok && Object.keys(check.document).sort()).toEqual(["body", "sourceKind", "title"]);
  });

  it("refuses a source kind other than pdf, docx or paste", () => {
    expect(checkNewDocument({ title: "MSA", body: contract, sourceKind: "png" })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses text past the length limit, and empty text", () => {
    expect(checkNewDocument({ title: "MSA", body: "a ".repeat(MAX_DOCUMENT_CHARS), sourceKind: "paste" })).toEqual({
      ok: false,
      reason: "too-long",
    });
    expect(checkNewDocument({ title: "MSA", body: " \n ", sourceKind: "paste" })).toEqual({ ok: false, reason: "no-text" });
  });

  it("refuses a missing or overlong title", () => {
    expect(checkNewDocument({ title: "   ", body: contract, sourceKind: "paste" })).toEqual({ ok: false, reason: "invalid" });
    expect(checkNewDocument({ title: "t".repeat(201), body: contract, sourceKind: "paste" })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("refuses anything that isn't the expected shape", () => {
    for (const input of [null, "text", 42, { title: "MSA", body: 7, sourceKind: "pdf" }]) {
      expect(checkNewDocument(input)).toEqual({ ok: false, reason: "invalid" });
    }
  });
});

describe("the suggested title", () => {
  it("comes from the file name without its extension", () => {
    expect(suggestTitle({ fileName: "Halvard_MSA_2026.pdf" })).toBe("Halvard MSA 2026");
    expect(suggestTitle({ fileName: "order form.DOCX" })).toBe("order form");
  });

  it("comes from the first line of pasted text", () => {
    expect(suggestTitle({ text: "\n\nMASTER SUBSCRIPTION AGREEMENT\n\nThis..." })).toBe("MASTER SUBSCRIPTION AGREEMENT");
  });
});
