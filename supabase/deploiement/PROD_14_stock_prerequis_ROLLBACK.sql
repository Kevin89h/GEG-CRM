-- Retour arrière de PROD_14, en DERNIER (après le retour arrière des migrations 20261125 et 20261124).
-- Retire la règle de lignes temporaire. Les colonnes ajoutées sont CONSERVÉES (valeurs par défaut, ignorées par le
-- code de production précédent, et reprises telles quelles par le déploiement général) : aucune donnée perdue.
begin;
do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    foreach t in array array['invoice_lines', 'sales_order_lines'] loop
      execute format('drop trigger if exists stock_line_rules on %I.%I', s, t);
    end loop;
  end loop;
end $$;
drop function if exists public.stock_line_rules();
commit;
