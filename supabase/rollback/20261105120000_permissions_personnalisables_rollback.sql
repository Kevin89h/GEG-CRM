-- Rollback of 20261105120000_permissions_personnalisables.sql
-- Removes the behaviour (rules, triggers, policies, functions). KEEPS the data written since:
-- audit log, permission exceptions, created_by columns, payment ↔ treasury links, blocking columns.
-- Optional full clean-up of those objects is at the end, commented out (destroys the audit history).

begin;

do $$
declare s text; t record;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    for t in select c.relname r from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = s and c.relkind = 'r' loop
      execute format('drop trigger if exists audit_row on %I.%I', s, t.r);
      execute format('drop trigger if exists set_created_by on %I.%I', s, t.r);
      execute format('drop trigger if exists document_rules on %I.%I', s, t.r);
      execute format('drop trigger if exists protect_payment_treasury on %I.%I', s, t.r);
      execute format('drop policy if exists perm_delete on %I.%I', s, t.r);
      execute format('drop policy if exists perm_insert on %I.%I', s, t.r);
      execute format('drop policy if exists perm_update on %I.%I', s, t.r);
      execute format('drop policy if exists perm_select on %I.%I', s, t.r);
    end loop;
  end loop;
end $$;

drop trigger if exists audit_profile on public.profiles;
drop trigger if exists audit_override on public.user_permission_overrides;

create policy suppliers_delete_role on geg_guinee.suppliers as restrictive for delete to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'manager', 'super_admin')));
create policy suppliers_delete_role on geg_singapore.suppliers as restrictive for delete to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'manager', 'super_admin')));

drop function if exists public.delete_payment_safe(text, text, uuid, uuid);
drop function if exists public.protect_payment_treasury();
drop function if exists public.document_rules();
drop function if exists public.audit_row();
drop function if exists public.audit_profile();
drop function if exists public.audit_override();
drop function if exists public.set_created_by();
drop function if exists public.audit_refusal(text, text, text, text);
drop function if exists public.audit_log_event(text, text, text, text, text, text, jsonb);
drop function if exists public.has_any_permission(text[], text);
drop function if exists public.has_permission(text, text);
drop function if exists public.my_permissions(text);
drop function if exists public.effective_permissions(uuid, text);

create or replace function public.has_company_access(p_schema text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p join public.companies c on c.id = any (p.company_access)
    where p.id = auth.uid() and c.schema_name = p_schema and c.is_active
  )
$$;

-- Optional, destroys history — only on explicit decision:
-- drop table public.audit_events, public.user_permission_overrides, public.role_permissions, public.permission_catalog;
-- drop function public.audit_write, public.audit_context, public.audit_redact, public.audit_module, public.audit_events_readonly;

notify pgrst, 'reload schema';

commit;
