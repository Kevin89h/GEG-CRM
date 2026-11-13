-- PRODUCTION — approuvé par GEG le 13/11/2026 (« Oui, facture + BL 68 »).
-- Rattache la ligne libre « GEG HYDRAULIC HLP 68-200L » à la fiche « GEG HYDRAULIC HLP 68 200 L » (PRD-00013)
-- sur la facture FAC-2026-11-0180 et sur le bon de livraison brouillon BL/2026/00068.
-- Seul product_id change : libellé, quantité, prix, remise, TVA et montants restent identiques.
-- Aucun mouvement de stock n'est créé ici : la sortie se fera quand le BL sera validé dans l'application.
-- Les brouillons BL/2026/00066 et 00067 ne sont pas touchés.
begin;
do $$
declare n int;
begin
  -- the target fiche must be the storable, active GEG HYDRAULIC HLP 68 200 L
  perform 1 from geg_guinee.products
   where id = 'b86bb5ff-58b7-4ea9-b3f5-f4396667bb59' and name = 'GEG HYDRAULIC HLP 68 200 L' and product_type = 'storable' and is_active;
  if not found then raise exception 'Fiche cible introuvable ou différente : arrêt'; end if;

  update geg_guinee.invoice_lines il
     set product_id = 'b86bb5ff-58b7-4ea9-b3f5-f4396667bb59'
    from geg_guinee.invoices i
   where i.id = il.invoice_id and i.number = 'FAC-2026-11-0180'
     and il.description = 'GEG HYDRAULIC HLP 68-200L' and il.product_id is null and il.quantity = 1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Facture : % ligne(s) trouvée(s) au lieu de 1 : arrêt', n; end if;

  update geg_guinee.delivery_note_lines l
     set product_id = 'b86bb5ff-58b7-4ea9-b3f5-f4396667bb59'
    from geg_guinee.delivery_notes d
   where d.id = l.delivery_note_id and d.number = 'BL/2026/00068' and d.status = 'draft'
     and l.description = 'GEG HYDRAULIC HLP 68-200L' and l.product_id is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'BL/2026/00068 : % ligne(s) trouvée(s) au lieu de 1 : arrêt', n; end if;
end $$;
commit;

-- Vérification
select 'facture' as doc, i.number, i.status, il.description, il.quantity, il.unit_price, p.name as fiche
  from geg_guinee.invoice_lines il join geg_guinee.invoices i on i.id = il.invoice_id
  left join geg_guinee.products p on p.id = il.product_id
 where i.number = 'FAC-2026-11-0180'
union all
select 'bon de livraison', d.number, d.status, l.description, l.quantity, null, p.name
  from geg_guinee.delivery_note_lines l join geg_guinee.delivery_notes d on d.id = l.delivery_note_id
  left join geg_guinee.products p on p.id = l.product_id
 where d.number = 'BL/2026/00068';
