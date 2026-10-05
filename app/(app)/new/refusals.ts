import type { ExtractionFailure } from "@/lib/extraction";
import { MAX_DOCUMENT_CHARS } from "@/lib/extraction/limits";

// What the buyer reads when Redline can't take a file or a paste.

export type Refusal = { title: string; body: string };

// Why Redline won't guess at text it can't read (no OCR, ADR 0001), in the
// buyer's words.
const WHY_NO_PICTURES =
  "Redline doesn’t read text out of pictures. Every flag points to a sentence in your contract, and that only helps if the sentence was read right.";

function pageList(pages: number[]): string {
  if (pages.length === 1) return `page ${pages[0]}`;
  return `pages ${pages.slice(0, -1).join(", ")} and ${pages.at(-1)}`;
}

export function fileRefusal(failure: ExtractionFailure): Refusal {
  switch (failure.reason) {
    case "no-text":
      return {
        title: "There’s no text in this file.",
        body: `The pages are pictures, which is how a scanned contract comes out. ${WHY_NO_PICTURES} If you have the original PDF or Word file, upload that, or paste the text.`,
      };
    case "partly-scanned":
      return {
        title: `Redline can’t read ${pageList(failure.pages)} of this file.`,
        body: `${failure.pages.length === 1 ? "That page is a picture" : "Those pages are pictures"} with no text in ${failure.pages.length === 1 ? "it" : "them"}, as if scanned. ${WHY_NO_PICTURES} Reading the other pages alone would leave part of the contract out. Upload a copy where every page has text, or paste the text.`,
      };
    case "unsupported-type":
      return failure.legacyWord
        ? {
            title: "This is an older Word file (.doc).",
            body: "Redline reads PDF and .docx files. Open it in Word, save it as .docx or PDF, and upload that. Or paste the text.",
          }
        : {
            title: "Redline can’t read this kind of file.",
            body: "It reads PDF and Word (.docx) files. You can paste the text instead.",
          };
    case "password":
      return {
        title: "This PDF is locked with a password.",
        body: "Save a copy without the password and upload that, or paste the text.",
      };
    case "unreadable":
      return {
        title: "Redline couldn’t open this file.",
        body: "It’s damaged, or it isn’t the kind of file its name says. Check that it opens on your computer and try again, or paste the text.",
      };
    case "too-large":
      return {
        title: "This file is over 25 MB.",
        body: "If it’s a long PDF full of images, paste the text instead.",
      };
    case "too-long":
      return tooLong;
  }
}

const tooLong: Refusal = {
  title: "This document is too long.",
  body: `Redline keeps up to ${MAX_DOCUMENT_CHARS.toLocaleString("en-US")} characters, about 100 pages. Paste the part you’re signing instead.`,
};

export function pasteRefusal(failure: ExtractionFailure): Refusal {
  if (failure.reason === "too-long") return tooLong;
  return { title: "There’s no text to add yet.", body: "Paste the contract into the box first." };
}

export function saveRefusal(reason: "invalid" | "no-text" | "too-long" | "failed"): Refusal {
  switch (reason) {
    case "invalid":
      return { title: "Check the title.", body: "Give the document a title of up to 200 characters." };
    case "no-text":
      return { title: "There’s no text to add.", body: "Upload a file or paste the contract text first." };
    case "too-long":
      return tooLong;
    case "failed":
      return { title: "We couldn’t add the document to your library.", body: "Try again in a moment." };
  }
}
