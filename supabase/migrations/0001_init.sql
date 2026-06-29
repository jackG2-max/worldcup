-- ============================================================================
-- World Cup Prediction League — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- It is safe to re-run: objects are created with `if not exists` / `or replace`
-- and policies are dropped before being recreated.
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================================
-- Tables
-- ============================================================================

-- profiles ───────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text unique,
  department  text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

-- matches ─────────────────────────────────────────────────────────────────────
create table if not exists public.matches (
  id                 uuid primary key default gen_random_uuid(),
  api_match_id       text unique,
  home_team          text,
  away_team          text,
  home_team_code     text,
  away_team_code     text,
  kickoff_at         timestamptz,
  stage              text,
  group_name         text,
  status             text,
  home_score         int,
  away_score         int,
  winner             text check (winner in ('home', 'away', 'draw')),
  result_synced_at   timestamptz,
  result_approved    boolean not null default false,
  result_approved_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists matches_kickoff_idx on public.matches (kickoff_at);
create index if not exists matches_approval_idx on public.matches (result_approved);

-- predictions ─────────────────────────────────────────────────────────────────
create table if not exists public.predictions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  match_id             uuid not null references public.matches(id) on delete cascade,
  predicted_home_score int not null check (predicted_home_score between 0 and 99),
  predicted_away_score int not null check (predicted_away_score between 0 and 99),
  points               int not null default 0,
  calculated           boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists predictions_match_idx on public.predictions (match_id);
create index if not exists predictions_user_idx on public.predictions (user_id);

-- ============================================================================
-- Helper functions
-- ============================================================================

-- is_admin(): true when the current user has role = 'admin'.
-- SECURITY DEFINER so it can read profiles without tripping profiles' own RLS
-- (which would otherwise recurse when used inside a profiles policy).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Create a profile row automatically whenever an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, department)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'department'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent regular end-users from escalating their own role via a profile
-- update. Privileged contexts (the SQL editor / the service-role key) have a
-- NULL auth.uid(), so they are allowed through — this is what lets you create
-- the very first admin. Authenticated end-users (non-NULL auth.uid()) can only
-- change a role if they are already an admin.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role)
     and auth.uid() is not null
     and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- Keep updated_at fresh on writes.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

drop trigger if exists predictions_set_updated_at on public.predictions;
create trigger predictions_set_updated_at
  before update on public.predictions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Leaderboard view
-- ============================================================================
-- Aggregates *calculated* prediction points per user. The view is owned by the
-- migration role (not security_invoker), so it bypasses the row-level policies
-- on `predictions` — every signed-in user can therefore read the full standings
-- while still being unable to read other users' individual predictions.
drop view if exists public.leaderboard_view;
create view public.leaderboard_view as
select
  p.id                                                         as user_id,
  p.full_name,
  p.department,
  coalesce(sum(pr.points) filter (where pr.calculated), 0)::int as total_points,
  count(*) filter (where pr.calculated and pr.points = 10)::int as exact_scores_count,
  count(*) filter (where pr.calculated and pr.points >= 3)::int as correct_outcomes_count,
  count(pr.id)::int                                            as predictions_count
from public.profiles p
left join public.predictions pr on pr.user_id = p.id
group by p.id, p.full_name, p.department;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles    enable row level security;
alter table public.matches     enable row level security;
alter table public.predictions enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────────────
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles: admin read all" on public.profiles;
create policy "profiles: admin read all"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles: admin write all" on public.profiles;
create policy "profiles: admin write all"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── matches ──────────────────────────────────────────────────────────────────
drop policy if exists "matches: read for all signed-in users" on public.matches;
create policy "matches: read for all signed-in users"
  on public.matches for select
  to authenticated
  using (true);

drop policy if exists "matches: admin write" on public.matches;
create policy "matches: admin write"
  on public.matches for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── predictions ──────────────────────────────────────────────────────────────
drop policy if exists "predictions: read own" on public.predictions;
create policy "predictions: read own"
  on public.predictions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "predictions: admin read all" on public.predictions;
create policy "predictions: admin read all"
  on public.predictions for select
  to authenticated
  using (public.is_admin());

-- Insert only your own prediction, and only while the match is still open.
drop policy if exists "predictions: insert own before kickoff" on public.predictions;
create policy "predictions: insert own before kickoff"
  on public.predictions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at > now()
    )
  );

-- Update only your own prediction, and only while the match is still open.
drop policy if exists "predictions: update own before kickoff" on public.predictions;
create policy "predictions: update own before kickoff"
  on public.predictions for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at > now()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at > now()
    )
  );

drop policy if exists "predictions: admin write all" on public.predictions;
create policy "predictions: admin write all"
  on public.predictions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- Grants
-- ============================================================================
grant select on public.leaderboard_view to authenticated, anon;
