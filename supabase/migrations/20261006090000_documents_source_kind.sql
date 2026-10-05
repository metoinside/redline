-- Where a document's text came from: a PDF or DOCX read in the buyer's
-- browser, or text the buyer pasted. Only the extracted text is stored; this
-- records the kind of source, never the file (CLAUDE.md, ADR 0001).
--
-- No default: every insert says where its text came from. The documents table
-- has no rows before this ticket ships, so the column can be NOT NULL.

alter table public.documents
  add column source_kind text not null
    constraint documents_source_kind_check check (source_kind in ('pdf', 'docx', 'paste'));

comment on column public.documents.source_kind is 'pdf, docx or paste. The original file is never stored.';

-- The same limits the app applies (lib/extraction/limits.ts), so a request
-- that skips the app can't store an empty or oversized document.
alter table public.documents
  add constraint documents_title_length_check check (char_length(title) between 1 and 200),
  add constraint documents_body_length_check check (char_length(body) between 1 and 300000);
