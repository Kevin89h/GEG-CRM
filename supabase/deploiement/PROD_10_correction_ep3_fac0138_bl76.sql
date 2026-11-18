-- PRODUCTION — PROPOSITION, À N'EXÉCUTER QU'APRÈS AUTORISATION EXPLICITE DE GEG (17/11/2026).
-- Problème : la ligne « GEG GREASE LITHUIM EP3 180 KG » de FAC-2026-10-0138 est rattachée à la fiche PRD-00263
-- « GEG GREASE L EP » (créée le 07/10, sans référence ni stock) au lieu de PRD-00003 « GEG GREASE LITHIUM EP3 180 KG ».
-- La livraison BL/2026/00076 (17/11 15:28, Dépôt Lambanyi) a donc sorti 5 unités de PRD-00263 (stock 0, ramené
-- silencieusement à 0) et pas de la vraie fiche EP3 (15 au Dépôt Lambanyi).
-- Correction (une seule transaction ; en cas d'écart, rien n'est modifié) :
--   1. la ligne EP3 de FAC-2026-10-0138 et des BL/2026/00071, 00075, 00076, 00077 est rattachée à PRD-00003
--      (seul product_id change : libellés, quantités, prix, montants, TVA inchangés) ;
--   2. PRD-00263 : la sortie erronée est compensée par un mouvement « adjustment » tracé (+5 → niveau final 0,
--      comme avant la livraison) ; le mouvement d'origine est CONSERVÉ ;
--   3. PRD-00003 au Dépôt Lambanyi : la sortie de 5 est enregistrée (mouvement « out » tracé, 15 → 10).
-- Aucun autre niveau de stock ni mouvement n'est modifié ou supprimé (contrôlé à la fin).
begin;
create temp table _avant_niveaux on commit drop as select product_id, warehouse_id, quantity from geg_guinee.stock_levels;
create temp table _avant_mvts on commit drop as select id, md5(to_jsonb(m)::text) h from geg_guinee.stock_moves m;

do $$
declare
  v_inv uuid; v_bl76 uuid; v_author uuid; n int; q numeric;
  c_old constant uuid := '05395fcb-b0d8-47ac-9d8d-ad8f714435c4';   -- PRD-00263 GEG GREASE L EP
  c_new constant uuid := '6b2b6fa6-9936-4de7-bc27-39880a51af24';   -- PRD-00003 GEG GREASE LITHIUM EP3 180 KG
  c_wh  constant uuid := '9a2b57b1-4ae5-49ef-9fdc-5a9d473b9ffa';   -- Depot Lambanyi
begin
  perform 1 from geg_guinee.products where id = c_new and name = 'GEG GREASE LITHIUM EP3 180 KG' and product_type = 'storable' and is_active;
  if not found then raise exception 'Fiche PRD-00003 inattendue : arrêt'; end if;
  perform 1 from geg_guinee.products where id = c_old and name = 'GEG GREASE L EP';
  if not found then raise exception 'Fiche PRD-00263 inattendue : arrêt'; end if;
  select id into v_inv from geg_guinee.invoices where number = 'FAC-2026-10-0138';
  select id into v_bl76 from geg_guinee.delivery_notes where number = 'BL/2026/00076' and status = 'delivered' and invoice_id = v_inv;
  if v_inv is null or v_bl76 is null then raise exception 'Facture ou BL/2026/00076 livré introuvable : arrêt'; end if;

  -- the delivery took exactly 5 from PRD-00263 at Lambanyi, and nothing else ever moved on that sheet
  select count(*) into n from geg_guinee.stock_moves where product_id = c_old;
  if n <> 1 then raise exception 'PRD-00263 a % mouvement(s) au lieu de 1 : arrêt', n; end if;
  perform 1 from geg_guinee.stock_moves where product_id = c_old and type = 'out' and quantity = 5 and from_warehouse_id = c_wh and notes = 'Livraison BL#' || v_bl76;
  if not found then raise exception 'Sortie de 5 sur PRD-00263 par BL/2026/00076 introuvable : arrêt'; end if;
  select quantity into q from geg_guinee.stock_levels where product_id = c_old and warehouse_id = c_wh for update;
  if q is distinct from 0 then raise exception 'Stock PRD-00263 = % au lieu de 0 : arrêt', q; end if;
  select quantity into q from geg_guinee.stock_levels where product_id = c_new and warehouse_id = c_wh for update;
  if q is distinct from 15 then raise exception 'Stock PRD-00003 au Dépôt Lambanyi = % au lieu de 15 : arrêt', q; end if;
  select p.id into v_author from public.profiles p join auth.users u on u.id = p.id where u.email = 'coline@globalenergy.group';
  if v_author is null then raise exception 'Auteur introuvable : arrêt'; end if;

  -- 1. catalogue sheet of the EP3 line (invoice + delivery notes of this invoice)
  update geg_guinee.invoice_lines set product_id = c_new
   where invoice_id = v_inv and product_id = c_old and description = 'GEG GREASE LITHUIM EP3 180 KG' and quantity = 5;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Facture : % ligne(s) au lieu de 1 : arrêt', n; end if;
  update geg_guinee.delivery_note_lines l set product_id = c_new
    from geg_guinee.delivery_notes d
   where d.id = l.delivery_note_id and d.invoice_id = v_inv and l.product_id = c_old and l.description = 'GEG GREASE LITHUIM EP3 180 KG';
  get diagnostics n = row_count;
  if n < 1 then raise exception 'Aucune ligne de BL rattachée : arrêt'; end if;

  -- 2. PRD-00263: compensation of the wrong exit (level stays 0, as before the delivery)
  insert into geg_guinee.stock_moves (type, product_id, quantity, notes, to_warehouse_id, from_warehouse_id, user_id)
  values ('adjustment', c_old, 5, 'Correction : sortie de 5 imputée par erreur à PRD-00263 par BL/2026/00076 (FAC-2026-10-0138) — la marchandise livrée est GEG GREASE LITHIUM EP3 180 KG (PRD-00003). Niveau inchangé (0).', c_wh, null, v_author);

  -- 3. PRD-00003: the real exit of the delivery (15 → 10)
  insert into geg_guinee.stock_moves (type, product_id, quantity, notes, from_warehouse_id, to_warehouse_id, user_id)
  values ('out', c_new, 5, 'Régularisation de la livraison BL/2026/00076 (FAC-2026-10-0138) du 17/11/2026, imputée par erreur à PRD-00263 — Livraison BL#' || v_bl76, c_wh, null, v_author);
  update geg_guinee.stock_levels set quantity = quantity - 5, updated_at = now() where product_id = c_new and warehouse_id = c_wh;
end $$;

-- final checks: only PRD-00003 @ Lambanyi changed (15 → 10), PRD-00263 still 0, no move modified or deleted
do $$
declare n_autres int; n_mod int; n_sup int; q_new numeric; q_old numeric;
begin
  select quantity into q_new from geg_guinee.stock_levels where product_id = '6b2b6fa6-9936-4de7-bc27-39880a51af24' and warehouse_id = '9a2b57b1-4ae5-49ef-9fdc-5a9d473b9ffa';
  select quantity into q_old from geg_guinee.stock_levels where product_id = '05395fcb-b0d8-47ac-9d8d-ad8f714435c4' and warehouse_id = '9a2b57b1-4ae5-49ef-9fdc-5a9d473b9ffa';
  select count(*) into n_autres from _avant_niveaux a join geg_guinee.stock_levels l using (product_id, warehouse_id)
   where l.quantity is distinct from a.quantity and not (a.product_id = '6b2b6fa6-9936-4de7-bc27-39880a51af24' and a.warehouse_id = '9a2b57b1-4ae5-49ef-9fdc-5a9d473b9ffa');
  select count(*) into n_mod from _avant_mvts a join geg_guinee.stock_moves m using (id) where md5(to_jsonb(m)::text) <> a.h;
  select count(*) into n_sup from _avant_mvts a where not exists (select 1 from geg_guinee.stock_moves m where m.id = a.id);
  if q_new <> 10 or q_old <> 0 or n_autres <> 0 or n_mod <> 0 or n_sup <> 0 then
    raise exception 'Contrôle échoué (EP3 %, L EP %, autres niveaux %, mouvements modifiés %, supprimés %) : tout est annulé', q_new, q_old, n_autres, n_mod, n_sup;
  end if;
end $$;
commit;
