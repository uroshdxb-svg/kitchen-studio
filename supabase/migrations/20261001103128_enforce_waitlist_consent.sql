-- Apply after the consent-aware landing page is live. Keeping this separate
-- makes the schema expansion backwards-compatible during deployment.
drop policy if exists "waitlist: validated join" on public.waitlist;
drop policy if exists "waitlist: consented join" on public.waitlist;
create policy "waitlist: consented join"
on public.waitlist for insert to anon, authenticated
with check (
  marketing_consent is true
  and consent_at is not null
  and consent_version = 'v1'
  and pg_catalog.char_length(email) between 3 and 254
  and email = pg_catalog.btrim(email)
  and email ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'
  and pg_catalog.char_length(coalesce(note, '')) <= 1000
  and pg_catalog.char_length(coalesce(source, '')) <= 200
);
