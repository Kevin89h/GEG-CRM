-- Rollback of 20261110120000_catalogue_stock.sql
-- Removes the catalogue rule on sales lines and the derogation permission standards.
-- public.document_rules() keeps the R1 emission/confirmation checks: re-run its definition from
-- 20261107120000_permissions_f1_f3.sql to restore the previous version.

begin;

do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    foreach t in array array['sales_order_lines', 'invoice_lines'] loop
      execute format('drop trigger if exists catalog_line_rules on %I.%I', s, t);
    end loop;
  end loop;
end $$;
drop function if exists public.catalog_line_rules();
delete from public.role_permissions where permission_key = 'stock.livraison_hors_stock';

notify pgrst, 'reload schema';

commit;
