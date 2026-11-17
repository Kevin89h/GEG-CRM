-- PRODUCTION — décision GEG D-16 du 17/11/2026 (« Conserver BL/2026/00071, annuler BL/2026/00072 »).
-- Annule le bon de livraison BROUILLON BL/2026/00072, doublon de BL/2026/00071 pour la facture FAC-2026-10-0138.
-- Même effet que le bouton « Annuler » de l'application : statut « cancelled », rien n'est supprimé (lignes et
-- numéro conservés). Une note datée trace la raison et la décision. Aucun mouvement de stock, aucune donnée
-- commerciale ou financière modifiée.
-- Le script s'arrête sans rien modifier si : le bon n'est plus un brouillon, n'est pas lié à FAC-2026-10-0138,
-- a un mouvement de stock, ou si BL/2026/00071 n'est plus un brouillon de la même facture.
-- Retour arrière : PROD_09_annulation_bl72_doublon_ROLLBACK.sql.
begin;
do $$
declare v_bl72 uuid; v_inv uuid; n int;
begin
  select id into v_inv from geg_guinee.invoices where number = 'FAC-2026-10-0138';
  if v_inv is null then raise exception 'Facture FAC-2026-10-0138 introuvable : arrêt'; end if;

  perform 1 from geg_guinee.delivery_notes where number = 'BL/2026/00071' and status = 'draft' and invoice_id = v_inv;
  if not found then raise exception 'BL/2026/00071 n''est plus un brouillon de FAC-2026-10-0138 : arrêt'; end if;

  select id into v_bl72 from geg_guinee.delivery_notes where number = 'BL/2026/00072' and status = 'draft' and invoice_id = v_inv;
  if v_bl72 is null then raise exception 'BL/2026/00072 n''est pas un brouillon de FAC-2026-10-0138 : arrêt'; end if;

  select count(*) into n from geg_guinee.stock_moves where reference ilike '%BL/2026/00072%' or notes ilike '%BL/2026/00072%';
  if n > 0 then raise exception 'BL/2026/00072 a % mouvement(s) de stock : arrêt', n; end if;

  update geg_guinee.delivery_notes
     set status = 'cancelled',
         notes = concat_ws(E'\n', nullif(notes, ''), 'Annulé le 17/11/2026 : doublon de BL/2026/00071 pour FAC-2026-10-0138 (décision GEG D-16, Coline Quinty). Aucune livraison ni sortie de stock.')
   where id = v_bl72 and status = 'draft';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Annulation : % bon(s) modifié(s) au lieu de 1 : arrêt', n; end if;
end $$;
commit;
