-- reports: "Report a gap" from the app. Anyone can file one; nobody can read them back through the API
-- (Uros reads them in the Supabase table editor). The kitchen file is attached only if the reporter ticks it.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter uuid default auth.uid(),
  email text,
  kind text not null default 'gap' check (kind in ('equipment','drawing','feature','bug','gap')),
  message text not null check (char_length(message) between 3 and 4000),
  view text,
  context jsonb,
  project jsonb,
  status text not null default 'new' check (status in ('new','triaged','fixed','wontfix'))
);
alter table public.reports enable row level security;
drop policy if exists "reports: anyone can file" on public.reports;
create policy "reports: anyone can file" on public.reports for insert to anon, authenticated
  with check (
    status = 'new'
    and (reporter is null or reporter = auth.uid())
    and (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    and (project is null or pg_column_size(project) < 1500000)
    and (context is null or pg_column_size(context) < 20000)
  );

-- least privilege, same pattern as 20261001104054: insert only, and only the columns the app sends
revoke all privileges on table public.reports from anon, authenticated;
grant insert (reporter, email, kind, message, view, context, project) on public.reports to anon, authenticated;
