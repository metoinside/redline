-- Analyses: one row per analysis run on a saved document. `result` is the
-- analysis the buyer saw (lib/engine/types.ts, Analysis), with every citation
-- already checked against the document text. `red_lines` is a snapshot of the
-- buyer's red lines for that run, so an old result shows what it was based on
-- after the red lines change (#10, #11). `created_at` is the run date.
--
-- A run is a record: its owner can read it and delete it, never change it.
-- A new run is a new row.

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  created_at timestamptz not null default now(),
  result jsonb not null
    constraint analyses_result_object_check check (jsonb_typeof(result) = 'object'),
  red_lines jsonb not null default '[]'::jsonb
    constraint analyses_red_lines_array_check check (jsonb_typeof(red_lines) = 'array')
);

comment on table public.analyses is 'One analysis run of a saved document. created_at is the run date; red_lines is the snapshot used.';

-- A document's latest analysis is read on every visit.
create index analyses_document_id_created_at_idx on public.analyses (document_id, created_at desc);
create index analyses_user_id_idx on public.analyses (user_id);

-- Row-level security: a signed-in buyer reads and writes only their own rows,
-- and only against documents they own.
alter table public.analyses enable row level security;

create policy "analyses: owner can select"
  on public.analyses for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- The document must be the buyer's own. The subquery runs under the
-- documents table's own row-level security as well.
create policy "analyses: owner can insert for own document"
  on public.analyses for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "analyses: owner can delete"
  on public.analyses for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- No update policy and no update grant: a saved run can't be rewritten.
-- Signed-out visitors get nothing (TRUNCATE ignores RLS, so it isn't granted).
revoke all on table public.analyses from anon;
revoke all on table public.analyses from authenticated;
grant select, insert, delete on table public.analyses to authenticated;
