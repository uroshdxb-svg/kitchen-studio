-- Opt into the Data API with only the operations and columns each client uses.
revoke all privileges on table public.profiles from anon, authenticated;
revoke all privileges on table public.projects from anon, authenticated;
revoke all privileges on table public.equipment from anon, authenticated;
revoke all privileges on table public.waitlist from anon, authenticated;
revoke all privileges on table public.ai_usage from anon, authenticated;

grant select (id, email, display_name, plan, created_at) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select (name, data, updated_at, public_id, is_public) on public.projects to anon;
grant select (id, name, summary, data, is_public, public_id, created_at, updated_at, version) on public.projects to authenticated;
grant insert (owner, name, summary, data) on public.projects to authenticated;
grant update (name, summary, data, is_public, updated_at) on public.projects to authenticated;
grant delete on public.projects to authenticated;

grant select (owner, cid, data, created_at), insert (owner, cid, data), update (data), delete
on public.equipment to authenticated;

grant insert (email, note, source, marketing_consent, consent_at, consent_version)
on public.waitlist to anon, authenticated;
grant usage, select on sequence public.waitlist_id_seq to anon, authenticated;

grant select (id, owner, kind, tokens_in, tokens_out, created_at)
on public.ai_usage to authenticated;
