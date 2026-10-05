-- Red lines: the terms a buyer will not accept (#10). Each row is a limit on
-- one clause type in the renewal-and-exit family (ADR 0004), in a form code
-- can check against the figure a cited sentence states (lib/engine/types.ts,
-- RedLineLimit; lib/engine/red-lines.ts):
--   not_allowed  no clause of the type at all (limit_value is null);
--   max_days     the longest notice period, in days (notice_window only);
--   max_months   the longest renewal or rollover term, or lock-in, in months
--                (auto_renewal, rollover, multi_year_term);
--   max_dollars  the highest fee, in whole dollars (early_termination_fee only).
-- The bounds match LIMIT_VALUE_RANGE in lib/engine/types.ts.
--
-- Every analysis of a saved document loads the owner's current red lines and
-- stores a snapshot of them in analyses.red_lines.

create table public.red_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clause_type text not null
    constraint red_lines_clause_type_check
      check (clause_type in ('auto_renewal', 'notice_window', 'early_termination_fee', 'rollover', 'multi_year_term')),
  limit_kind text not null
    constraint red_lines_limit_kind_check
      check (limit_kind in ('not_allowed', 'max_days', 'max_months', 'max_dollars')),
  limit_value integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The limit must suit the clause type, and a figure-limit needs a whole value
  -- in range. coalesce, because a CHECK that comes out null passes.
  constraint red_lines_limit_check check (coalesce(
    (limit_kind = 'not_allowed' and limit_value is null)
    or (limit_kind = 'max_days' and clause_type = 'notice_window'
        and limit_value between 1 and 3650)
    or (limit_kind = 'max_months' and clause_type in ('auto_renewal', 'rollover', 'multi_year_term')
        and limit_value between 1 and 240)
    or (limit_kind = 'max_dollars' and clause_type = 'early_termination_fee'
        and limit_value between 1 and 100000000),
    false
  ))
);

comment on table public.red_lines is 'A buyer''s red lines: one limit on one renewal-and-exit clause type per row. An input to every analysis.';

-- The red lines page and every analysis run read a buyer's red lines in the order they were added.
create index red_lines_user_id_created_at_idx on public.red_lines (user_id, created_at);

-- updated_at follows every change.
create function public.red_lines_touch_updated_at() returns trigger
  language plpgsql
  set search_path = ''
  as $$
  begin
    new.updated_at := now();
    return new;
  end;
  $$;

create trigger red_lines_touch_updated_at
  before update on public.red_lines
  for each row execute function public.red_lines_touch_updated_at();

-- Row-level security: a signed-in buyer reads and writes only their own rows.
alter table public.red_lines enable row level security;

create policy "red_lines: owner can select"
  on public.red_lines for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "red_lines: owner can insert"
  on public.red_lines for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "red_lines: owner can update"
  on public.red_lines for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "red_lines: owner can delete"
  on public.red_lines for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Signed-out visitors get nothing. Signed-in buyers get the four row-level
-- operations (TRUNCATE ignores RLS, so it isn't granted), and can change only
-- the limit itself: never the owner, the id or the dates.
revoke all on table public.red_lines from anon;
revoke all on table public.red_lines from authenticated;
grant select, insert, delete on table public.red_lines to authenticated;
grant update (clause_type, limit_kind, limit_value) on table public.red_lines to authenticated;
revoke all on function public.red_lines_touch_updated_at() from public, anon, authenticated;
