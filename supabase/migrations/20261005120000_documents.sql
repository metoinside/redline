-- Documents: the extracted text of a contract the buyer added.
-- Only the text is stored. There is no column, table or storage bucket for
-- the original file, by design (CLAUDE.md, ADR 0001).

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

comment on table public.documents is 'Extracted document text only. The original file is never stored.';

-- The library lists a buyer's documents newest first.
create index documents_user_id_created_at_idx on public.documents (user_id, created_at desc);

-- Row-level security: a signed-in buyer reads and writes only their own rows.
alter table public.documents enable row level security;

create policy "documents: owner can select"
  on public.documents for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "documents: owner can insert"
  on public.documents for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "documents: owner can update"
  on public.documents for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "documents: owner can delete"
  on public.documents for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase grants every privilege on new public tables to anon and
-- authenticated by default. Signed-out visitors get nothing, and signed-in
-- buyers get only the four row-level operations (TRUNCATE ignores RLS).
revoke all on table public.documents from anon;
revoke all on table public.documents from authenticated;
grant select, insert, update, delete on table public.documents to authenticated;
