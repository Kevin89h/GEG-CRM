-- Retour arrière de 20261124120000 (moteur de stock atomique), à exécuter APRÈS le retour arrière du code
-- (Vercel, version précédente) et après PROD_13_..._ROLLBACK et 20261125120000_..._rollback.
--
-- Principe : on retire les COMPORTEMENTS (fonctions, vues, déclencheurs, contraintes qui gêneraient l'ancien code) ;
-- les colonnes ajoutées et leurs valeurs (traçabilité des mouvements, conditionnements, liens BL → facture) sont
-- CONSERVÉES : l'ancien code les ignore, et aucune donnée saisie après le déploiement n'est perdue.
-- Les stocks (stock_levels) ne sont pas touchés.
begin;

-- 1. contrôle d'achat à l'émission et unité de la fiche
do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('drop trigger if exists controle_achat_vente on %I.invoices', s);
    execute format('drop trigger if exists unite_de_la_fiche on %I.sales_order_lines', s);
  end loop;
end $$;
drop function if exists public.controle_achat_vente_emission();
drop function if exists public.sales_line_unit_rule();

-- 2. règles des lignes de vente : version du 11/11/2026 (remise négative sur une prestation)
create or replace function public.catalog_line_rules()
returns trigger language plpgsql set search_path = public as $$
declare v_active boolean; v_type text; v_number text; v_amount_changed boolean;
begin
  if tg_table_name = 'invoice_lines' then
    execute format('select number from %I.invoices where id = $1', tg_table_schema) into v_number using new.invoice_id;
    if coalesce(v_number, '') like 'AVR-%' then return new; end if;
  end if;
  if new.line_type = 'comment' then
    if new.product_id is not null or new.quantity <> 0 or new.unit_price <> 0 or new.discount <> 0 then
      raise exception 'Ligne de commentaire : elle ne peut avoir ni produit, ni quantité, ni prix, ni remise';
    end if;
    if tg_table_name = 'sales_order_lines' then
      if (to_jsonb(new) ->> 'qty_delivered')::numeric <> 0 then
        raise exception 'Ligne de commentaire : elle ne peut pas être livrée';
      end if;
    end if;
    if btrim(coalesce(new.description, '')) = '' then raise exception 'Ligne de commentaire vide'; end if;
    return new;
  end if;
  v_amount_changed := tg_op = 'INSERT' or new.unit_price is distinct from old.unit_price;
  if tg_op = 'UPDATE' and old.line_type = 'product' and new.product_id is not distinct from old.product_id then
    if v_amount_changed and new.unit_price < 0 then
      if new.product_id is not null then
        execute format('select product_type from %I.products where id = $1', tg_table_schema) into v_type using new.product_id;
      end if;
      if v_type is distinct from 'service' then
        raise exception 'Montant négatif refusé : seule une ligne de service (ex. Remise commerciale) peut être négative';
      end if;
    end if;
    return new;
  end if;
  if new.product_id is null then
    raise exception 'Ligne refusée : chaque ligne doit être un produit ou un service du catalogue GEG (aucune ligne libre)';
  end if;
  execute format('select is_active, product_type from %I.products where id = $1', tg_table_schema) into v_active, v_type using new.product_id;
  if v_active is null then raise exception 'Ligne refusée : produit introuvable dans le catalogue'; end if;
  if not v_active then raise exception 'Ligne refusée : ce produit est désactivé et ne peut plus être vendu'; end if;
  if new.unit_price < 0 and v_type is distinct from 'service' then
    raise exception 'Montant négatif refusé : seule une ligne de service (ex. Remise commerciale) peut être négative';
  end if;
  return new;
end $$;

-- 3. fonctions du moteur, vues, contrainte « jamais négatif » (l'ancien code autorise la dérogation),
--    emplacement « Livraison directe » désactivé (l'ancien code le proposerait comme un dépôt)
do $$
declare s text; f text; n numeric;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    foreach f in array array['controle_achat_vente(uuid)', 'achat_receptionner(uuid,text,jsonb,uuid)', 'livraison_preparer(uuid,text,uuid)',
                             'livraison_confirmer(uuid,jsonb,uuid)', 'inventaire_valider(jsonb,uuid,text)',
                             'stock_appliquer(text,uuid,uuid,uuid,numeric,uuid,text,text)', 'stock_fixer(uuid,uuid,numeric)',
                             'stock_verrouiller(uuid,uuid)', 'geg_qte(numeric)', 'geg_libelle_produit(uuid)'] loop
      execute format('drop function if exists %I.%s', s, f);
    end loop;
    execute format('drop view if exists %I.invoice_delivery_status', s);
    execute format('drop view if exists %I.invoice_line_delivery', s);
    execute format('alter table %I.stock_levels drop constraint if exists stock_levels_jamais_negatif', s);
    execute format('select coalesce(sum(abs(l.quantity)), 0) from %I.stock_levels l join %I.warehouses w on w.id = l.warehouse_id where w.kind = ''direct''', s, s) into n;
    if n <> 0 then raise exception '% : l''emplacement « Livraison directe » contient encore du stock (%): à livrer avant le retour arrière', s, n; end if;
    execute format('update %I.warehouses set is_active = false where kind = ''direct''', s);
    -- produits de type « Remise » : il ne doit plus y en avoir (PROD_13_ROLLBACK, fiches créées après le déploiement)
    execute format('select count(*) from %I.products where product_type = ''discount''', s) into n;
    if n > 0 then raise exception '% : % fiche(s) de type « Remise » : reclasser avant le retour arrière (liste : select product_code, name from %I.products where product_type = ''discount'')', s, n, s; end if;
    execute format('alter table %I.products drop constraint if exists products_product_type_check', s);
    if s = 'geg_guinee' then
      execute format('alter table %I.products add constraint products_product_type_check check (product_type in (''consumable'', ''service'', ''storable''))', s);
    end if;
  end loop;
end $$;
drop function if exists public.geg_refus(text, jsonb);

notify pgrst, 'reload schema';
commit;
