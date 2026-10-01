-- Avoid evaluating two permissive SELECT policies for authenticated users.
drop policy if exists "projects: own select" on public.projects;
drop policy if exists "projects: shared read" on public.projects;

create policy "projects: own or shared read" on public.projects
for select to authenticated
using ((select auth.uid()) = owner or is_public is true);

create policy "projects: shared read" on public.projects
for select to anon
using (is_public is true);
