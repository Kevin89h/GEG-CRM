-- Rollback of supabase/migrations/20261104120000_super_admin.sql
-- Super admins become admins again, then policies and the role constraint return to their previous state.

begin;

update public.profiles set role = 'admin' where role = 'super_admin';

do $$
declare
  p record;
  new_qual text;
  new_check text;
begin
  for p in
    select schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
    from pg_policies
    where coalesce(qual, '') || coalesce(with_check, '') ~ '''super_admin''::text'
      and not (schemaname = 'public' and tablename in ('companies', 'document_settings'))
  loop
    new_qual := replace(replace(p.qual,
      'ARRAY[''admin''::text, ''manager''::text, ''super_admin''::text]', 'ARRAY[''admin''::text, ''manager''::text]'),
      '(profiles.role = ANY (ARRAY[''admin''::text, ''super_admin''::text]))', '(profiles.role = ''admin''::text)');
    new_check := replace(replace(p.with_check,
      'ARRAY[''admin''::text, ''manager''::text, ''super_admin''::text]', 'ARRAY[''admin''::text, ''manager''::text]'),
      '(profiles.role = ANY (ARRAY[''admin''::text, ''super_admin''::text]))', '(profiles.role = ''admin''::text)');

    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format('create policy %I on %I.%I as %s for %s to %s%s%s',
      p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd,
      array_to_string(array(select quote_ident(r) from unnest(p.roles) r), ', '),
      case when new_qual is not null then ' using (' || new_qual || ')' else '' end,
      case when new_check is not null then ' with check (' || new_check || ')' else '' end);
  end loop;
end $$;

drop policy if exists companies_admin_all on public.companies;
create policy companies_admin_all on public.companies as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

drop policy if exists doc_settings_write on public.document_settings;
create policy doc_settings_write on public.document_settings as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text])))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin'::text, 'manager'::text, 'sales_rep'::text]));

notify pgrst, 'reload schema';

commit;
