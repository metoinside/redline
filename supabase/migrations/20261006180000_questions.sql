-- Questions: one row per question a buyer asked about a saved document in
-- the question box (#9). `question` is the question as asked, with its
-- spacing tidied. `result` is the answer the buyer saw (lib/engine/types.ts,
-- Answer): an answer with its citation, already checked against the document
-- text, or "the document doesn't say". It is checked again on every read.
-- `created_at` is when it was asked.
--
-- A question is a record: its owner can read it and delete it, never change
-- it. Asking again is a new row.

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  question text not null
    constraint questions_question_length_check check (char_length(question) between 1 and 500),
  result jsonb not null
    constraint questions_result_object_check check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now()
);

comment on table public.questions is 'Questions asked about a saved document, with the checked answer shown. created_at is when it was asked.';

-- A document's questions are listed, newest first, on every visit.
create index questions_document_id_created_at_idx on public.questions (document_id, created_at desc);
create index questions_user_id_idx on public.questions (user_id);

-- Row-level security: a signed-in buyer reads and writes only their own rows,
-- and only against documents they own.
alter table public.questions enable row level security;

create policy "questions: owner can select"
  on public.questions for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- The document must be the buyer's own. The subquery runs under the
-- documents table's own row-level security as well.
create policy "questions: owner can insert for own document"
  on public.questions for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "questions: owner can delete"
  on public.questions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- No update policy and no update grant: a saved answer can't be rewritten.
-- Signed-out visitors get nothing (TRUNCATE ignores RLS, so it isn't granted).
revoke all on table public.questions from anon;
revoke all on table public.questions from authenticated;
grant select, insert, delete on table public.questions to authenticated;
