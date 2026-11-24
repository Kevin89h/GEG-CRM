-- PROD_14 : prérequis du déploiement CIBLÉ « stock » (décision GEG du 25/11/2026). PRODUCTION uniquement, AVANT les
-- migrations 20261124120000 et 20261125120000. Retour arrière : PROD_14_stock_prerequis_ROLLBACK.sql
--
-- 1. Colonnes dont le moteur de stock a besoin, créées EXACTEMENT comme le feront plus tard les migrations du catalogue
--    (20261111 et 20261112, « add column if not exists ») : le déploiement général les retrouvera telles quelles.
--    Valeurs par défaut : toutes les lignes existantes sont des lignes de produit (la production n'a pas de commentaires).
-- 2. Règle de lignes TEMPORAIRE « stock_line_rules », propre à la production, en attendant les règles du catalogue :
--    - M6 : seul un article de type « Remise » peut avoir un montant négatif (nouvelles lignes, ou prix modifié) ;
--    - M5 : une fiche au conditionnement « Autre » non validé par un Manager est inutilisable ;
--    - les avoirs (AVR-) recopient les lignes d'origine : non contrôlés ;
--    - R1 (décision GEG du 25/11) : plus aucune NOUVELLE ligne libre vendue sur les devis et factures ; une ligne de
--      texte (quantité 0, prix 0) reste permise. Les lignes libres EXISTANTES (13 devis ouverts) ne sont pas bloquées :
--      elles se rattachent à leur fiche depuis l'écran ; à la livraison, une ligne libre doit être rattachée (ANO-001).
--    La migration 20261124 la retire automatiquement dès que les règles du catalogue sont attachées.
-- Aucune donnée existante n'est modifiée (colonnes ajoutées avec leur valeur par défaut).
begin;

do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    -- 20261111 : lignes de devis et de factures
    foreach t in array array['sales_order_lines', 'invoice_lines'] loop
      execute format('alter table %I.%I add column if not exists line_type text not null default %L', s, t, 'product');
      execute format('alter table %I.%I add column if not exists print_on_pdf boolean not null default true', s, t);
      execute format('alter table %I.%I drop constraint if exists %I', s, t, t || '_line_type_check');
      execute format('alter table %I.%I add constraint %I check (line_type in (%L, %L))', s, t, t || '_line_type_check', 'product', 'comment');
      -- 20261112
      execute format('alter table %I.%I add column if not exists print_on_delivery boolean not null default false', s, t);
    end loop;
    -- 20261111 : fiches
    execute format('alter table %I.products add column if not exists to_complete boolean not null default false', s);
    execute format('alter table %I.products add column if not exists missing_info text', s);
    execute format('alter table %I.products add column if not exists brand text', s);
    -- 20261112 : lignes de BL
    execute format('alter table %I.delivery_note_lines add column if not exists line_type text not null default %L', s, 'product');
    execute format('alter table %I.delivery_note_lines add column if not exists print_on_delivery boolean not null default true', s);
    execute format('alter table %I.delivery_note_lines drop constraint if exists delivery_note_lines_line_type_check', s);
    execute format('alter table %I.delivery_note_lines add constraint delivery_note_lines_line_type_check check (line_type in (%L, %L))', s, 'product', 'comment');
  end loop;
end $$;

create or replace function public.stock_line_rules() returns trigger
language plpgsql set search_path = public as $function$
declare v_type text; v_pack text; v_number text;
begin
  if tg_table_name = 'invoice_lines' then
    execute format('select number from %I.invoices where id = $1', tg_table_schema) into v_number using new.invoice_id;
    if coalesce(v_number, '') like 'AVR-%' then return new; end if;   -- avoirs : copie des lignes d'origine
  end if;
  -- R1 (décision GEG) : plus de NOUVELLE ligne libre vendue. Une ligne de texte (quantité 0 et prix 0) reste permise :
  -- la production n'a pas encore de « lignes de commentaire ». Les lignes libres existantes ne sont pas touchées et
  -- peuvent être rattachées à leur fiche ; une note ne peut pas devenir une vente libre.
  if new.product_id is null then
    if coalesce(new.quantity, 0) = 0 and coalesce(new.unit_price, 0) = 0 then return new; end if;
    if tg_op = 'INSERT' or (coalesce(old.quantity, 0) = 0 and coalesce(old.unit_price, 0) = 0) then
      raise exception 'Ligne refusée : chaque ligne vendue doit être une fiche du catalogue GEG (produit, prestation ou remise). Choisissez la fiche, ou créez-la dans Stock › Produits. Pour un simple texte, laissez la quantité et le prix à 0.';
    end if;
    return new;   -- ligne libre ANCIENNE (quantité ou prix modifiés) : à rattacher, non bloquée
  end if;
  -- lignes existantes : contrôlées seulement si leur fiche ou leur prix change
  if tg_op = 'UPDATE' and new.product_id is not distinct from old.product_id and new.unit_price is not distinct from old.unit_price then
    return new;
  end if;
  execute format('select product_type, packaging_status from %I.products where id = $1', tg_table_schema) into v_type, v_pack using new.product_id;
  if v_pack = 'a_valider' and (tg_op = 'INSERT' or new.product_id is distinct from old.product_id) then
    raise exception 'Ligne refusée : le conditionnement « Autre » de cette fiche doit d''abord être validé par un Manager';
  end if;
  if new.unit_price < 0 and v_type is distinct from 'discount' then
    raise exception 'Montant négatif refusé : seule une fiche de type « Remise » peut avoir un montant négatif';
  end if;
  return new;
end $function$;
revoke all on function public.stock_line_rules() from public, anon, authenticated;

do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    foreach t in array array['invoice_lines', 'sales_order_lines'] loop
      -- jamais en double avec les règles du catalogue (déjà présentes sur Dev)
      if not exists (select 1 from pg_trigger tg join pg_class c on c.oid = tg.tgrelid where c.relnamespace = s::regnamespace and c.relname = t and tg.tgname = 'catalog_line_rules') then
        execute format('drop trigger if exists stock_line_rules on %I.%I', s, t);
        execute format('create trigger stock_line_rules before insert or update on %I.%I for each row execute function public.stock_line_rules()', s, t);
      end if;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
