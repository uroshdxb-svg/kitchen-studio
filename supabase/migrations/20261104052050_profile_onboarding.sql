-- Add self-reported onboarding details; account access still comes from verified Auth.
-- Apply before deploying the client that reads these columns.
alter table public.profiles
  add column country_code text,
  add column professional_role text,
  add column use_case text,
  add column onboarding_completed_at timestamptz,
  add constraint profiles_country_valid check (country_code is null or (country_code ~ '^[A-Z]{2}$' and country_code <> 'XX')),
  add constraint profiles_role_valid check (professional_role is null or professional_role in ('operator','chef','restaurant_manager','general_manager','owner','supplier','other')),
  add constraint profiles_use_case_valid check (use_case is null or use_case in ('new_opening','redesign','client_project','equipment_sales','exploring'));

grant select (country_code,professional_role,use_case,onboarding_completed_at) on public.profiles to authenticated;
grant update (country_code,professional_role,use_case) on public.profiles to authenticated;

-- Completion time is set by the database, not writable by clients.
create or replace function public.complete_profile_onboarding() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.country_code is not null and new.professional_role is not null and new.use_case is not null then
    if tg_op = 'INSERT' then
      new.onboarding_completed_at := now();
    else
      new.onboarding_completed_at := coalesce(old.onboarding_completed_at, now());
    end if;
  else
    new.onboarding_completed_at := null;
  end if;
  return new;
end $$;
revoke all on function public.complete_profile_onboarding() from public, anon, authenticated;
create trigger profiles_complete_onboarding
  before insert or update of country_code, professional_role, use_case on public.profiles
  for each row execute function public.complete_profile_onboarding();

-- Metadata is only copied as validated survey answers. Never use it for authorization.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  country text := upper(btrim(new.raw_user_meta_data ->> 'country_code'));
  profession text := new.raw_user_meta_data ->> 'professional_role';
  purpose text := new.raw_user_meta_data ->> 'use_case';
begin
  insert into public.profiles (id, email, country_code, professional_role, use_case)
  values (
    new.id, new.email,
    case when country ~ '^[A-Z]{2}$' and country <> 'XX' then country end,
    case when profession in ('operator','chef','restaurant_manager','general_manager','owner','supplier','other') then profession end,
    case when purpose in ('new_opening','redesign','client_project','equipment_sales','exploring') then purpose end
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

