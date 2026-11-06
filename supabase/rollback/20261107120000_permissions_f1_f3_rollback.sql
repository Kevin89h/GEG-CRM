-- Rollback of 20261107120000_permissions_f1_f3.sql
-- Restores table-wide insert/update for user sessions on the three tables and removes the deal_costs read rule.
-- The function public.document_rules() keeps the F3 check: re-run its definition from
-- 20261106120000_permissions_e1_e5.sql to restore the previous version.

begin;

do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('grant insert, update on %I.employees to authenticated', s);
    execute format('grant insert, update on %I.deals to authenticated', s);
    execute format('grant insert, update on %I.products to authenticated', s);
    if to_regclass(format('%I.deal_costs', s)) is not null then
      execute format('drop policy if exists perm_select on %I.deal_costs', s);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
