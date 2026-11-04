-- Super admin role (Coline Quinty, Kevin Hochstrasser): above admin.
--   - super_admin keeps every right admin and manager had in the RLS policies;
--   - only super_admin may modify the companies table;
--   - document settings: super_admin for every company, admin/manager only for their companies.
-- Applies after 20261027120000_p0_security.sql. Rollback: supabase/rollback/20261104120000_super_admin_rollback.sql
-- Role assignment (who becomes super_admin) is a separate data change, not part of this migration.

begin;

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['super_admin'::text, 'admin'::text, 'manager'::text, 'sales_rep'::text]));

-- Every policy that grants something to admin (and manager) grants it to super_admin too
do $$
declare
  p record;
  new_qual text;
  new_check text;
begin
  for p in
    select schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
    from pg_policies
    where coalesce(qual, '') || coalesce(with_check, '') ~ '''admin''::text'
      and not (schemaname = 'public' and tablename in ('companies', 'document_settings'))
  loop
    new_qual := replace(replace(p.qual,
      'ARRAY[''admin''::text, ''manager''::text]', 'ARRAY[''admin''::text, ''manager''::text, ''super_admin''::text]'),
      '(profiles.role = ''admin''::text)', '(profiles.role = ANY (ARRAY[''admin''::text, ''super_admin''::text]))');
    new_check := replace(replace(p.with_check,
      'ARRAY[''admin''::text, ''manager''::text]', 'ARRAY[''admin''::text, ''manager''::text, ''super_admin''::text]'),
      '(profiles.role = ''admin''::text)', '(profiles.role = ANY (ARRAY[''admin''::text, ''super_admin''::text]))');

    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    execute format('create policy %I on %I.%I as %s for %s to %s%s%s',
      p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd,
      array_to_string(array(select quote_ident(r) from unnest(p.roles) r), ', '),
      case when new_qual is not null then ' using (' || new_qual || ')' else '' end,
      case when new_check is not null then ' with check (' || new_check || ')' else '' end);
  end loop;
end $$;

-- Companies: only super admins change them (everyone signed in can still read them)
drop policy if exists companies_admin_all on public.companies;
create policy companies_admin_all on public.companies
  as permissive for all to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin'));

-- Document settings: super admin everywhere, admin/manager only for their own companies
drop policy if exists doc_settings_write on public.document_settings;
create policy doc_settings_write on public.document_settings
  as permissive for all to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and (p.role = 'super_admin' or (p.role in ('admin', 'manager') and document_settings.company_id = any (p.company_access)))))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and (p.role = 'super_admin' or (p.role in ('admin', 'manager') and document_settings.company_id = any (p.company_access)))));

notify pgrst, 'reload schema';

commit;
