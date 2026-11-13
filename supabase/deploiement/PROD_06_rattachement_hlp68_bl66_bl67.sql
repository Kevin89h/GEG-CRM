-- PRODUCTION — demandé par GEG le 13/11/2026 (« fais marcher dans tout et il gardera le brouillon qu'il veut »).
-- Rattache la ligne « GEG HYDRAULIC HLP 68-200L » des brouillons BL/2026/00066 et BL/2026/00067 à la fiche
-- « GEG HYDRAULIC HLP 68 200 L » (PRD-00013), comme pour BL/2026/00068 (PROD_05).
-- Seul product_id change. Aucun bon supprimé, aucun mouvement de stock créé.
begin;
do $$
declare n int;
begin
  perform 1 from geg_guinee.products
   where id = 'b86bb5ff-58b7-4ea9-b3f5-f4396667bb59' and name = 'GEG HYDRAULIC HLP 68 200 L' and product_type = 'storable' and is_active;
  if not found then raise exception 'Fiche cible introuvable ou différente : arrêt'; end if;

  update geg_guinee.delivery_note_lines l
     set product_id = 'b86bb5ff-58b7-4ea9-b3f5-f4396667bb59'
    from geg_guinee.delivery_notes d
   where d.id = l.delivery_note_id and d.number in ('BL/2026/00066', 'BL/2026/00067') and d.status = 'draft'
     and l.description = 'GEG HYDRAULIC HLP 68-200L' and l.product_id is null;
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'BL 00066 / 00067 : % ligne(s) trouvée(s) au lieu de 2 : arrêt', n; end if;
end $$;
commit;

-- Vérification
select d.number, d.status, l.description, l.quantity, p.name as fiche
  from geg_guinee.delivery_note_lines l join geg_guinee.delivery_notes d on d.id = l.delivery_note_id
  left join geg_guinee.products p on p.id = l.product_id
 where d.number in ('BL/2026/00066', 'BL/2026/00067', 'BL/2026/00068')
 order by d.number, l.description;
