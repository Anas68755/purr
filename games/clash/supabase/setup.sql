-- Run once in Supabase: SQL Editor > New query > paste > Run
create table if not exists public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint saves_size check (pg_column_size(data) < 300000)   -- protects the free 500 MB database
);
alter table public.saves enable row level security;
create policy "read own save"   on public.saves for select using (auth.uid() = user_id);
create policy "insert own save" on public.saves for insert with check (auth.uid() = user_id);
create policy "update own save" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
