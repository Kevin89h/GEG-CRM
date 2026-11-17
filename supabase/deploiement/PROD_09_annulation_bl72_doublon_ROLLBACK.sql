-- Retour arrière de PROD_09 : remet BL/2026/00072 en brouillon et retire la note d'annulation ajoutée par PROD_09.
begin;
do $$
declare n int;
begin
  update geg_guinee.delivery_notes
     set status = 'draft',
         notes = nullif(replace(replace(coalesce(notes, ''), E'\nAnnulé le 17/11/2026 : doublon de BL/2026/00071 pour FAC-2026-10-0138 (décision GEG D-16, Coline Quinty). Aucune livraison ni sortie de stock.', ''), 'Annulé le 17/11/2026 : doublon de BL/2026/00071 pour FAC-2026-10-0138 (décision GEG D-16, Coline Quinty). Aucune livraison ni sortie de stock.', ''), '')
   where number = 'BL/2026/00072' and status = 'cancelled';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Retour arrière : % bon(s) trouvé(s) au lieu de 1 : arrêt', n; end if;
end $$;
commit;
