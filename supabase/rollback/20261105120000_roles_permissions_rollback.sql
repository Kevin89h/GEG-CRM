-- Rollback of 20261105120000_roles_permissions.sql
-- Keeps the is_blocked / blocked_at / blocked_by columns and their values (history of blockings):
-- drop them by hand only if really needed.

begin;

do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('drop trigger if exists invoice_lock on %I.invoices', s);
    execute format('drop trigger if exists invoice_lines_lock on %I.invoice_lines', s);
  end loop;
end $$;
drop function if exists public.invoice_lock();

do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
           where policyname in ('role_delete', 'role_insert', 'role_update', 'role_select')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy suppliers_delete_role on geg_guinee.suppliers
  as restrictive for delete to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'manager', 'super_admin')));
create policy suppliers_delete_role on geg_singapore.suppliers
  as restrictive for delete to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'manager', 'super_admin')));

drop function if exists public.has_capability(text);

-- Company check as defined by 20261027120000_p0_security.sql (without the blocking test)
create or replace function public.has_company_access(p_schema text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.companies c on c.id = any (p.company_access)
    where p.id = auth.uid()
      and c.schema_name = p_schema
      and c.is_active
  )
$$;

notify pgrst, 'reload schema';

commit;
