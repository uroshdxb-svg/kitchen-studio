-- Lock down functions and add optimistic concurrency for kitchen saves.
create or replace function public.gen_public_id(len integer default 10)
returns text language sql volatile set search_path = '' as $$
  select pg_catalog.string_agg(
    pg_catalog.substr('abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789',
      (pg_catalog.random() * 55)::integer + 1, 1), '')
  from pg_catalog.generate_series(1, len);
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
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
returns trigger language plpgsql security invoker set search_path = '' as $$
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

-- Public shares now use caller privileges plus RLS instead of bypassing RLS.
create or replace function public.shared_project(pid text)
returns table (name text, data jsonb, updated_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select p.name, p.data, p.updated_at
  from public.projects as p
  where p.public_id = pid and p.is_public is true
  limit 1;
$$;

revoke all on function public.shared_project(text) from public;
grant execute on function public.shared_project(text) to anon, authenticated;
