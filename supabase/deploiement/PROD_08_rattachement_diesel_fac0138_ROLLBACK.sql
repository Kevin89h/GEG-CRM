-- Retour arrière de PROD_08 : remet la ligne « GEG DIESIEL EXTRA 15W40 200L » en ligne libre (product_id NULL) sur
-- FAC-2026-10-0138 et sur les bons BL/2026/00071 et 00072, UNIQUEMENT s'ils sont encore en brouillon.
-- Si un bon a déjà été validé (stock sorti), ce retour arrière ne s'applique pas : il faudrait une régularisation tracée.
begin;
do $$
declare n int;
begin
  perform 1 from geg_guinee.delivery_notes where number in ('BL/2026/00071', 'BL/2026/00072') and status <> 'draft' and status <> 'cancelled';
  if found then raise exception 'Un des bons a été validé : retour arrière impossible sans régularisation de stock'; end if;
  update geg_guinee.invoice_lines il set product_id = null
    from geg_guinee.invoices i
   where i.id = il.invoice_id and i.number = 'FAC-2026-10-0138' and il.description = 'GEG DIESIEL EXTRA 15W40 200L'
     and il.product_id = 'c52beecc-4099-4409-a544-580fb101c626';
  update geg_guinee.delivery_note_lines l set product_id = null
    from geg_guinee.delivery_notes d
   where d.id = l.delivery_note_id and d.number in ('BL/2026/00071', 'BL/2026/00072') and d.status in ('draft', 'cancelled')
     and l.description = 'GEG DIESIEL EXTRA 15W40 200L' and l.product_id = 'c52beecc-4099-4409-a544-580fb101c626';
end $$;
commit;
