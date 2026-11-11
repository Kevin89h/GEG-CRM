-- Correction de stock — GEG DIESEL EXTRA 15W40 (fiche 5 L désactivée) au Dépôt Lambanyi : 80 → 0.
-- Décision GEG (Coline Quinty) : les 80 unités n'existent pas physiquement ; elles proviennent d'une opération annulée
-- (réception PO-2026-0057-7059 du 07/10/2026, saisie par gnfinance@) dont les quantités étaient incorrectes.
-- Exécuté et vérifié sur Dev le 11/11/2026. PRODUCTION : À EXÉCUTER UNIQUEMENT APRÈS AUTORISATION DE DÉPLOIEMENT.
--
-- Ce que fait le script (une seule transaction ; en cas d'écart, il s'arrête sans rien modifier) :
--   1. vérifie la fiche (nom, 5 L, désactivée), le dépôt et que le stock est exactement de 80 ;
--   2. enregistre un AJUSTEMENT D'INVENTAIRE traçable (auteur : coline@globalenergy.group, motif obligatoire),
--      au même format que l'écran Inventaire (quantité = écart, note « Inventaire : 80 → 0 — motif ») ;
--   3. met le stock de ce couple fiche × dépôt à 0 ;
--   4. vérifie qu'aucun autre niveau de stock n'a changé et qu'aucun mouvement historique n'a été modifié ou supprimé.
-- La fiche reste désactivée ; documents (devis, factures, BL, commande d'achat, réception) et mouvements historiques intacts.

begin;

create temp table _avant_niveaux on commit drop as select product_id, warehouse_id, quantity from geg_guinee.stock_levels;
create temp table _avant_mvts on commit drop as select id, md5(to_jsonb(m)::text) h from geg_guinee.stock_moves m;

do $$
declare
  v_product constant uuid := '1975f745-777c-4195-81bc-58988d9e6269';
  v_wh      constant uuid := '9a2b57b1-4ae5-49ef-9fdc-5a9d473b9ffa';
  v_reason  constant text := 'Correction de stock fictif lié à une opération annulée – aucune marchandise physique correspondante';
  v_author uuid; v_qty numeric; v_ok boolean;
begin
  select (p.name = 'GEG DIESEL EXTRA 15W40' and not p.is_active and u.name = '5 L') into v_ok
  from geg_guinee.products p left join geg_guinee.units u on u.id = p.unit_id where p.id = v_product;
  if v_ok is not true then raise exception 'Fiche inattendue : script arrêté, rien n''est modifié'; end if;
  if not exists (select 1 from geg_guinee.warehouses where id = v_wh and name ilike '%lambanyi%') then
    raise exception 'Dépôt Lambanyi introuvable : script arrêté, rien n''est modifié'; end if;
  select quantity into v_qty from geg_guinee.stock_levels where product_id = v_product and warehouse_id = v_wh for update;
  if v_qty is distinct from 80 then raise exception 'Stock actuel % au lieu de 80 : script arrêté, rien n''est modifié', v_qty; end if;
  select p.id into v_author from public.profiles p join auth.users u on u.id = p.id where u.email = 'coline@globalenergy.group';
  if v_author is null then raise exception 'Auteur introuvable : script arrêté'; end if;

  insert into geg_guinee.stock_moves (type, product_id, quantity, notes, to_warehouse_id, from_warehouse_id, user_id)
  values ('adjustment', v_product, 80, 'Inventaire: 80 → 0 — ' || v_reason, v_wh, null, v_author);

  update geg_guinee.stock_levels set quantity = 0 where product_id = v_product and warehouse_id = v_wh;
end $$;

-- contrôles : stock final, aucun autre niveau modifié, historique intact
do $$
declare n_autres int; n_mvts_modif int; n_mvts_supp int; q numeric;
begin
  select quantity into q from geg_guinee.stock_levels where product_id = '1975f745-777c-4195-81bc-58988d9e6269' and warehouse_id = '9a2b57b1-4ae5-49ef-9fdc-5a9d473b9ffa';
  select count(*) into n_autres from _avant_niveaux a join geg_guinee.stock_levels l using (product_id, warehouse_id)
    where l.quantity is distinct from a.quantity and not (a.product_id = '1975f745-777c-4195-81bc-58988d9e6269' and a.warehouse_id = '9a2b57b1-4ae5-49ef-9fdc-5a9d473b9ffa');
  select count(*) into n_mvts_modif from _avant_mvts a join geg_guinee.stock_moves m using (id) where md5(to_jsonb(m)::text) <> a.h;
  select count(*) into n_mvts_supp from _avant_mvts a where not exists (select 1 from geg_guinee.stock_moves m where m.id = a.id);
  if q <> 0 or n_autres <> 0 or n_mvts_modif <> 0 or n_mvts_supp <> 0 then
    raise exception 'Contrôle échoué (stock final %, autres niveaux modifiés %, mouvements modifiés %, supprimés %) : tout est annulé', q, n_autres, n_mvts_modif, n_mvts_supp;
  end if;
end $$;

select p.name, w.name depot, l.quantity stock_final, p.is_active fiche_active,
  (select count(*) from geg_guinee.stock_moves m where m.product_id = p.id) mouvements_historiques,
  (select notes from geg_guinee.stock_moves m where m.product_id = p.id order by created_at desc limit 1) dernier_mouvement
from geg_guinee.stock_levels l join geg_guinee.products p on p.id = l.product_id join geg_guinee.warehouses w on w.id = l.warehouse_id
where l.product_id = '1975f745-777c-4195-81bc-58988d9e6269' and l.warehouse_id = '9a2b57b1-4ae5-49ef-9fdc-5a9d473b9ffa';

commit;
