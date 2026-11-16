-- Retour arrière de 20261116130000_tracabilite_auteurs : retire la pose automatique de l'auteur et la protection
-- des profils. Aucune donnée n'est modifiée (les auteurs déjà enregistrés restent).
begin;
do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    foreach t in array array['sales_orders', 'invoices', 'purchase_orders', 'purchase_receptions', 'delivery_notes',
                             'stock_moves', 'payments', 'treasury_transactions', 'activities', 'purchase_order_events'] loop
      if to_regclass(format('%I.%I', s, t)) is not null then
        execute format('drop trigger if exists set_author_user_id on %I.%I', s, t);
      end if;
    end loop;
  end loop;
end $$;
drop function if exists public.set_author_user_id();
drop trigger if exists protect_profile_history on public.profiles;
drop function if exists public.protect_profile_history();
commit;
