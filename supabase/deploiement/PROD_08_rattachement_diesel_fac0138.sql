-- PRODUCTION — PROPOSITION, À N'EXÉCUTER QU'APRÈS AUTORISATION EXPLICITE DE GEG (régression du 17/11/2026).
-- Rattache la ligne libre « GEG DIESIEL EXTRA 15W40 200L » (5 fûts) à la fiche « GEG DIESEL EXTRA 15W40 » 200 L
-- (PRD-00012, référence GEG-DIESEL-EXTRA-15W40-200-L, produit stockable actif) :
--   * sur la facture FAC-2026-10-0138 ;
--   * sur les bons de livraison BROUILLONS BL/2026/00071 et BL/2026/00072 créés le 17/11 pour cette facture.
-- Même méthode que PROD_05 (HLP 68, approuvé le 13/11). Seul product_id change : libellé, quantité, prix, remise,
-- TVA, montants et PDF restent identiques. Aucun mouvement de stock n'est créé ici : la sortie se fera quand UN des
-- deux bons sera validé dans l'application (130 fûts au Dépôt Lambanyi au 17/11).
-- ⚠ Deux brouillons existent pour la même facture : GEG doit en annuler un dans l'application (sinon risque de
--   livrer deux fois). Le script ne choisit pas à la place de GEG.
-- Retour arrière : PROD_08_rattachement_diesel_fac0138_ROLLBACK.sql (remet product_id à NULL sur ces 3 lignes,
-- tant que les bons sont encore en brouillon).
begin;
do $$
declare n int;
begin
  perform 1 from geg_guinee.products
   where id = 'c52beecc-4099-4409-a544-580fb101c626' and reference = 'GEG-DIESEL-EXTRA-15W40-200-L'
     and product_type = 'storable' and is_active;
  if not found then raise exception 'Fiche cible introuvable ou différente : arrêt'; end if;

  update geg_guinee.invoice_lines il
     set product_id = 'c52beecc-4099-4409-a544-580fb101c626'
    from geg_guinee.invoices i
   where i.id = il.invoice_id and i.number = 'FAC-2026-10-0138'
     and il.description = 'GEG DIESIEL EXTRA 15W40 200L' and il.product_id is null and il.quantity = 5;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Facture : % ligne(s) trouvée(s) au lieu de 1 : arrêt', n; end if;

  update geg_guinee.delivery_note_lines l
     set product_id = 'c52beecc-4099-4409-a544-580fb101c626'
    from geg_guinee.delivery_notes d
   where d.id = l.delivery_note_id and d.number in ('BL/2026/00071', 'BL/2026/00072') and d.status = 'draft'
     and l.description = 'GEG DIESIEL EXTRA 15W40 200L' and l.product_id is null and l.quantity = 5;
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'Bons de livraison : % ligne(s) trouvée(s) au lieu de 2 (brouillons 71 et 72) : arrêt', n; end if;
end $$;
commit;
