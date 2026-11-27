-- ============================================================================
-- PURR GAMES — unified Supabase setup (run ONCE: Dashboard → SQL Editor → New query → paste → Run)
-- Creates:
--   public.scores : global leaderboards for every game (one table, "game" column separates them)
--   public.saves  : cloud saves per user per game
-- Security: Row Level Security everywhere. The publishable/anon key is public by
-- design — these policies are what actually protect the data.
-- ============================================================================

-- ---------------------------------------------------------------- leaderboards
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  game       text not null,
  player     text not null default 'Player' check (char_length(player) between 1 and 16),
  score      bigint not null check (score >= 0 and score <= 999999999),
  meta       jsonb not null default '{}'::jsonb,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists scores_board_idx on public.scores (game, score desc, created_at asc);
create index if not exists scores_user_idx  on public.scores (user_id, game);

alter table public.scores enable row level security;

drop policy if exists "scores_public_read" on public.scores;
drop policy if exists "scores_own_insert"  on public.scores;
drop policy if exists "scores_own_delete"  on public.scores;
create policy "scores_public_read" on public.scores for select using (true);
create policy "scores_own_insert"  on public.scores for insert with check (
  auth.uid() is not null and auth.uid() = user_id
);
create policy "scores_own_delete"  on public.scores for delete using (auth.uid() = user_id);

-- Light anti-spam: max 5 submissions per user per game per minute.
create or replace function public.scores_rate_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from public.scores
   where user_id = new.user_id and game = new.game
     and created_at > now() - interval '1 minute';
  if n >= 5 then
    raise exception 'Too many score submissions, please slow down';
  end if;
  return new;
end $$;

drop trigger if exists trg_scores_rate_guard on public.scores;
create trigger trg_scores_rate_guard before insert on public.scores
  for each row execute function public.scores_rate_guard();

-- ---------------------------------------------------------------- cloud saves
create table if not exists public.saves (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  game       text not null default 'clash',
  slot       text not null default 'main',
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, game, slot),
  constraint saves_size check (pg_column_size(data) < 900000)
);

alter table public.saves enable row level security;

drop policy if exists "saves_own_select" on public.saves;
drop policy if exists "saves_own_insert" on public.saves;
drop policy if exists "saves_own_update" on public.saves;
drop policy if exists "saves_own_delete" on public.saves;
create policy "saves_own_select" on public.saves for select using (auth.uid() = user_id);
create policy "saves_own_insert" on public.saves for insert with check (auth.uid() = user_id);
create policy "saves_own_update" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "saves_own_delete" on public.saves for delete using (auth.uid() = user_id);

-- Done. Every game now talks to these two tables only.
