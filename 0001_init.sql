-- Kitchen Studio: initial schema. Run in the Supabase SQL editor (or `supabase db push`).
-- Tables: profiles, projects (saved kitchens), equipment (a user's custom models), waitlist, ai_usage.

create extension if not exists pgcrypto;

-- Short, URL-safe id for share links (e.g. "k7Qm3xZp2v")
create or replace function public.gen_public_id(len int default 10)
returns text language sql volatile as $$
  select string_agg(substr('abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', (random()*55)::int + 1, 1), '')
  from generate_series(1, len);
$$;

-- Profiles: one row per auth user, created by trigger
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Projects: a saved kitchen. `data` is the app's project JSON (room, items, underlay, name, at).
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled kitchen',
  summary text,
  data jsonb not null,
  is_public boolean not null default false,
  public_id text not null unique default public.gen_public_id(10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_updated on public.projects (owner, updated_at desc);
alter table public.projects enable row level security;
create policy "projects: own select" on public.projects for select using (auth.uid() = owner);
create policy "projects: own insert" on public.projects for insert with check (auth.uid() = owner);
create policy "projects: own update" on public.projects for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "projects: own delete" on public.projects for delete using (auth.uid() = owner);

-- Shared read: anyone with the public_id gets name + data only (no owner id), and only while is_public is on.
create or replace function public.shared_project(pid text)
returns table (name text, data jsonb, updated_at timestamptz)
language sql security definer stable set search_path = public as $$
  select p.name, p.data, p.updated_at from public.projects p where p.public_id = pid and p.is_public = true limit 1;
$$;
grant execute on function public.shared_project(text) to anon, authenticated;

-- Custom equipment models a user added (brand/model/dimensions), synced across devices
create table if not exists public.equipment (
  owner uuid not null references auth.users(id) on delete cascade,
  cid text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner, cid)
);
alter table public.equipment enable row level security;
create policy "equipment: own all" on public.equipment for all using (auth.uid() = owner) with check (auth.uid() = owner);

-- Waitlist from the landing page: anonymous insert only, nobody reads it from the client
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null,
  note text,
  source text,
  created_at timestamptz not null default now()
);
create unique index if not exists waitlist_email on public.waitlist (lower(email));
alter table public.waitlist enable row level security;
create policy "waitlist: anyone can join" on public.waitlist for insert to anon, authenticated with check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- AI usage, one row per call, for the daily limit in the edge function
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  owner uuid not null references auth.users(id) on delete cascade,
  kind text,
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_owner_day on public.ai_usage (owner, created_at desc);
alter table public.ai_usage enable row level security;
create policy "ai_usage: own read" on public.ai_usage for select using (auth.uid() = owner);
-- inserts happen from the edge function with the service role, which bypasses RLS
