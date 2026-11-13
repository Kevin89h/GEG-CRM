-- Rollback of 20261106120000_permissions_e1_e5.sql
-- Keeps the data: the internal_notes column and its contents, the audit history and the permission row
-- (exceptions referring to it). Restores full column read and removes the E1 line rule.
-- The function public.document_rules() keeps its E1/E2 checks: re-run the definition from
-- 20261105120000_permissions_personnalisables.sql to restore the previous version.

begin;

do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('drop trigger if exists document_rules on %I.sales_order_lines', s);
    -- the table only exists where purchases are journalised (Guinée): skip it elsewhere (fix B4, 13/11/2026)
    if to_regclass(format('%I.purchase_order_events', s)) is not null then
      execute format('drop trigger if exists audit_row on %I.purchase_order_events', s);
    end if;
    execute format('grant select on %I.employees to authenticated', s);
    execute format('grant select on %I.deals to authenticated', s);
    execute format('grant select on %I.products to authenticated', s);
  end loop;
end $$;

delete from public.role_permissions where permission_key = 'employes.salaires';

notify pgrst, 'reload schema';

commit;
