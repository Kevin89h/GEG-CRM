-- PRODUCTION — PROPOSITION, À N'EXÉCUTER QU'APRÈS AUTORISATION EXPLICITE DE GEG (17/11/2026).
-- FAC-2026-10-0138 a été entièrement livrée par BL/2026/00076 (17/11, 15:28 : 5 HLP 68, 5 EP3, 5 Diesel).
-- Trois brouillons restent ouverts pour la même facture : BL/2026/00071, 00075 et 00077 → risque de livrer deux fois.
-- Annulation comme le bouton « Annuler » (statut « cancelled », rien n'est supprimé), avec une note datée.
-- S'arrête sans rien modifier si BL/2026/00076 n'est pas livré, si l'un des trois n'est plus un brouillon de la
-- facture, ou s'il a un mouvement de stock.
begin;
do $$
declare v_inv uuid; n int;
begin
  select id into v_inv from geg_guinee.invoices where number = 'FAC-2026-10-0138';
  perform 1 from geg_guinee.delivery_notes where number = 'BL/2026/00076' and status = 'delivered' and invoice_id = v_inv;
  if not found then raise exception 'BL/2026/00076 n''est pas livré pour FAC-2026-10-0138 : arrêt'; end if;
  select count(*) into n from geg_guinee.delivery_notes where number in ('BL/2026/00071', 'BL/2026/00075', 'BL/2026/00077') and status = 'draft' and invoice_id = v_inv;
  if n <> 3 then raise exception '% brouillon(s) trouvé(s) au lieu de 3 : arrêt', n; end if;
  select count(*) into n from geg_guinee.stock_moves m join geg_guinee.delivery_notes d on m.notes = 'Livraison BL#' || d.id
   where d.number in ('BL/2026/00071', 'BL/2026/00075', 'BL/2026/00077');
  if n > 0 then raise exception '% mouvement(s) de stock liés à ces brouillons : arrêt', n; end if;
  update geg_guinee.delivery_notes
     set status = 'cancelled',
         notes = concat_ws(E'\n', nullif(notes, ''), 'Annulé le 17/11/2026 : FAC-2026-10-0138 déjà livrée par BL/2026/00076 (décision GEG). Aucune livraison ni sortie de stock.')
   where number in ('BL/2026/00071', 'BL/2026/00075', 'BL/2026/00077') and status = 'draft' and invoice_id = v_inv;
  get diagnostics n = row_count;
  if n <> 3 then raise exception 'Annulation : % bon(s) au lieu de 3 : arrêt', n; end if;
end $$;
commit;
