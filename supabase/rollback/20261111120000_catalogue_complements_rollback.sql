-- Rollback of 20261111120000_catalogue_complements.sql
-- Restores the R1 rule of 20261110120000_catalogue_stock.sql (re-run that file's catalog_line_rules and
-- document_rules definitions afterwards). Columns are kept when comment lines or links already exist,
-- so that no business data is lost: drop them by hand only after checking they are empty.

begin;

do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('drop trigger if exists historical_link_rules on %I.historical_line_links', s);
    execute format('drop trigger if exists audit_row on %I.historical_line_links', s);
    foreach t in array array['sales_order_lines', 'invoice_lines'] loop
      execute format('drop trigger if exists catalog_line_rules on %I.%I', s, t);
      execute format('create trigger catalog_line_rules before insert or update of product_id on %I.%I for each row execute function public.catalog_line_rules()', s, t);
    end loop;
  end loop;
end $$;
drop function if exists public.historical_link_rules();

notify pgrst, 'reload schema';

commit;
