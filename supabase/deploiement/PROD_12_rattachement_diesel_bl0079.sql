-- PRODUCTION — PROD_12 (ANO-003 / D-23), autorisé par GEG le 18/11/2026, limité à cette seule ligne.
-- Rattache la ligne « GEG DIESEL EXTRA 15W40-200 L » (1 fût de 200 L) du bon de livraison BROUILLON BL/2026/00079
-- (facture FAC-2026-11-0187) à la fiche GEG DIESEL EXTRA 15W40 200 L (PRD-00012, référence
-- GEG-DIESEL-EXTRA-15W40-200-L) au lieu du doublon PRD-00236 « DIESEL EXTRA 15W40 ».
-- Seul product_id de cette ligne change : libellé, quantité, dépôt (non renseigné tant que le bon n'est pas validé),
-- facture, devis, fiches du catalogue et stocks restent identiques. Aucun mouvement de stock n'est créé ; le bon reste
-- en brouillon et sa validation revient à GEG.
-- Valeurs initiales relevées juste avant l'exécution (ligne 626228bc… : product_id = PRD-00236 c81d4bd2…) et
-- reportées dans le compte rendu PROD_12 (avant / après).
-- Retour arrière : PROD_12_rattachement_diesel_bl0079_ROLLBACK.sql (tant que le bon est en brouillon).
begin;
do $$
declare n int;
begin
  -- conditions préalables (arrêt au moindre écart)
  perform 1 from geg_guinee.products
   where id = 'c52beecc-4099-4409-a544-580fb101c626' and product_code = 'PRD-00012'
     and reference = 'GEG-DIESEL-EXTRA-15W40-200-L' and product_type = 'storable' and is_active;
  if not found then raise exception 'Fiche cible PRD-00012 introuvable ou différente : arrêt'; end if;

  perform 1 from geg_guinee.delivery_notes d join geg_guinee.invoices i on i.id = d.invoice_id
   where d.id = '4e9acdad-849b-4db2-8b3f-9d207d5c6fa0' and d.number = 'BL/2026/00079' and d.status = 'draft'
     and i.number = 'FAC-2026-11-0187';
  if not found then raise exception 'BL/2026/00079 introuvable, plus en brouillon ou plus lié à FAC-2026-11-0187 : arrêt'; end if;

  perform 1 from geg_guinee.stock_moves where notes ilike '%4e9acdad-849b-4db2-8b3f-9d207d5c6fa0%' or notes ilike '%BL/2026/00079%';
  if found then raise exception 'Une sortie de stock existe déjà pour ce bon : arrêt'; end if;

  -- correction de la seule ligne concernée
  update geg_guinee.delivery_note_lines
     set product_id = 'c52beecc-4099-4409-a544-580fb101c626'
   where id = '626228bc-3729-4598-9c02-a0fe886a403f'
     and delivery_note_id = '4e9acdad-849b-4db2-8b3f-9d207d5c6fa0'
     and product_id = 'c81d4bd2-18ea-4fa6-b09e-c06776c59b92'
     and description = 'GEG DIESEL EXTRA 15W40-200 L' and quantity = 1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ligne du BL : % ligne(s) trouvée(s) au lieu de 1 : arrêt', n; end if;
end $$;
commit;
