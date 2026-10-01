-- Expand the waitlist schema while remaining compatible with the old client.
alter table public.waitlist
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_version text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.waitlist'::regclass and conname = 'waitlist_email_valid') then
    alter table public.waitlist add constraint waitlist_email_valid check (
      pg_catalog.char_length(email) between 3 and 254
      and email = pg_catalog.btrim(email)
      and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.waitlist'::regclass and conname = 'waitlist_payload_bounded') then
    alter table public.waitlist add constraint waitlist_payload_bounded check (
      pg_catalog.char_length(coalesce(note, '')) <= 1000
      and pg_catalog.char_length(coalesce(source, '')) <= 200
    );
  end if;
end
$$;

drop policy if exists "waitlist: anyone can join" on public.waitlist;
create policy "waitlist: validated join" on public.waitlist for insert to anon, authenticated
with check (
  pg_catalog.char_length(email) between 3 and 254
  and email = pg_catalog.btrim(email)
  and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  and pg_catalog.char_length(coalesce(note, '')) <= 1000
  and pg_catalog.char_length(coalesce(source, '')) <= 200
);
