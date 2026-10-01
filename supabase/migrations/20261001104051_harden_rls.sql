-- Replace broad PUBLIC policies with explicit roles and init-plan-safe checks.
drop policy if exists "profiles: own read" on public.profiles;
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own read" on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy "profiles: own update" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "projects: own select" on public.projects;
drop policy if exists "projects: own insert" on public.projects;
drop policy if exists "projects: own update" on public.projects;
drop policy if exists "projects: own delete" on public.projects;
drop policy if exists "projects: shared read" on public.projects;
create policy "projects: own select" on public.projects for select to authenticated
using ((select auth.uid()) = owner);
create policy "projects: shared read" on public.projects for select to anon, authenticated
using (is_public is true);
create policy "projects: own insert" on public.projects for insert to authenticated
with check ((select auth.uid()) = owner);
create policy "projects: own update" on public.projects for update to authenticated
using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy "projects: own delete" on public.projects for delete to authenticated
using ((select auth.uid()) = owner);

drop policy if exists "equipment: own all" on public.equipment;
create policy "equipment: own all" on public.equipment for all to authenticated
using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);

drop policy if exists "ai_usage: own read" on public.ai_usage;
create policy "ai_usage: own read" on public.ai_usage for select to authenticated
using ((select auth.uid()) = owner);
