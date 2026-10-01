-- Harden customer-owned data, make public sharing least-privilege, record
-- waitlist consent, and add optimistic concurrency for kitchen saves.

-- Functions used by defaults and triggers must not resolve attacker-controlled
-- objects through a mutable search_path.
create or replace function public.gen_public_id(len integer default 10)
returns text
language sql
volatile
set search_path = ''
as $$
  select pg_catalog.string_agg(
    pg_catalog.substr(
      'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789',
      (pg_catalog.random() * 55)::integer + 1,
      1
    ),
    ''
  )
  from pg_catalog.generate_series(1, len);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.gen_public_id(integer) from public, anon;
grant execute on function public.gen_public_id(integer) to authenticated, service_role;

-- A monotonically increasing version lets the client reject stale saves.
alter table public.projects
  add column if not exists version bigint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.projects'::regclass
      and conname = 'projects_version_positive'
  ) then
    alter table public.projects
      add constraint projects_version_positive check (version > 0);
  end if;
end
$$;

create or replace function public.set_project_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.data is distinct from old.data then
    new.version := old.version + 1;
    new.updated_at := pg_catalog.now();
  else
    new.version := old.version;
  end if;
  return new;
end
$$;

revoke all on function public.set_project_version() from public, anon, authenticated;
drop trigger if exists set_project_version on public.projects;
create trigger set_project_version
before update on public.projects
for each row execute function public.set_project_version();

-- Public shares no longer need a SECURITY DEFINER function. RLS decides which
-- rows are visible and column grants prevent owner details from being exposed.
create or replace function public.shared_project(pid text)
returns table (name text, data jsonb, updated_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.name, p.data, p.updated_at
  from public.projects as p
  where p.public_id = pid
    and p.is_public is true
  limit 1;
$$;

revoke all on function public.shared_project(text) from public;
grant execute on function public.shared_project(text) to anon, authenticated;

-- Replace broad PUBLIC policies with explicit roles and init-plan-safe auth
-- checks. UPDATE policies include both USING and WITH CHECK.
drop policy if exists "profiles: own read" on public.profiles;
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own read"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy "profiles: own update"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "projects: own select" on public.projects;
drop policy if exists "projects: own insert" on public.projects;
drop policy if exists "projects: own update" on public.projects;
drop policy if exists "projects: own delete" on public.projects;
drop policy if exists "projects: shared read" on public.projects;
create policy "projects: own select"
on public.projects for select to authenticated
using ((select auth.uid()) = owner);
create policy "projects: shared read"
on public.projects for select to anon, authenticated
using (is_public is true);
create policy "projects: own insert"
on public.projects for insert to authenticated
with check ((select auth.uid()) = owner);
create policy "projects: own update"
on public.projects for update to authenticated
using ((select auth.uid()) = owner)
with check ((select auth.uid()) = owner);
create policy "projects: own delete"
on public.projects for delete to authenticated
using ((select auth.uid()) = owner);

drop policy if exists "equipment: own all" on public.equipment;
create policy "equipment: own all"
on public.equipment for all to authenticated
using ((select auth.uid()) = owner)
with check ((select auth.uid()) = owner);

drop policy if exists "ai_usage: own read" on public.ai_usage;
create policy "ai_usage: own read"
on public.ai_usage for select to authenticated
using ((select auth.uid()) = owner);

-- Record affirmative marketing consent. Existing entries remain unconsented.
alter table public.waitlist
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_version text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.waitlist'::regclass
      and conname = 'waitlist_email_valid'
  ) then
    alter table public.waitlist add constraint waitlist_email_valid check (
      pg_catalog.char_length(email) between 3 and 254
      and email = pg_catalog.btrim(email)
      and email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
    );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.waitlist'::regclass
      and conname = 'waitlist_payload_bounded'
  ) then
    alter table public.waitlist add constraint waitlist_payload_bounded check (
      pg_catalog.char_length(coalesce(note, '')) <= 1000
      and pg_catalog.char_length(coalesce(source, '')) <= 200
    );
  end if;
end
$$;

drop policy if exists "waitlist: anyone can join" on public.waitlist;
create policy "waitlist: validated join"
on public.waitlist for insert to anon, authenticated
with check (
  pg_catalog.char_length(email) between 3 and 254
  and email = pg_catalog.btrim(email)
  and email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
  and pg_catalog.char_length(coalesce(note, '')) <= 1000
  and pg_catalog.char_length(coalesce(source, '')) <= 200
);

-- Opt into the Data API explicitly with only the operations and columns each
-- client role needs. service_role retains its existing administrative grants.
revoke all privileges on table public.profiles from anon, authenticated;
revoke all privileges on table public.projects from anon, authenticated;
revoke all privileges on table public.equipment from anon, authenticated;
revoke all privileges on table public.waitlist from anon, authenticated;
revoke all privileges on table public.ai_usage from anon, authenticated;

grant select (id, email, display_name, plan, created_at)
  on public.profiles to authenticated;
grant update (display_name)
  on public.profiles to authenticated;

grant select (name, data, updated_at, public_id, is_public)
  on public.projects to anon;
grant select (id, name, summary, data, is_public, public_id, created_at, updated_at, version)
  on public.projects to authenticated;
grant insert (owner, name, summary, data)
  on public.projects to authenticated;
grant update (name, summary, data, is_public, updated_at)
  on public.projects to authenticated;
grant delete on public.projects to authenticated;

grant select (owner, cid, data, created_at), insert (owner, cid, data),
  update (data), delete on public.equipment to authenticated;

grant insert (email, note, source, marketing_consent, consent_at, consent_version)
  on public.waitlist to anon, authenticated;
grant usage, select on sequence public.waitlist_id_seq to anon, authenticated;

grant select (id, owner, kind, tokens_in, tokens_out, created_at)
  on public.ai_usage to authenticated;
