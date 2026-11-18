-- Retour arrière de PROD_12 : remet la ligne du BL/2026/00079 sur la fiche d'origine PRD-00236,
-- UNIQUEMENT si le bon est encore en brouillon (sinon une régularisation de stock tracée serait nécessaire).
begin;
do $$
declare n int;
begin
  perform 1 from geg_guinee.delivery_notes where id = '4e9acdad-849b-4db2-8b3f-9d207d5c6fa0' and status = 'draft';
  if not found then raise exception 'BL/2026/00079 n''est plus en brouillon : retour arrière impossible sans régularisation'; end if;
  update geg_guinee.delivery_note_lines
     set product_id = 'c81d4bd2-18ea-4fa6-b09e-c06776c59b92'
   where id = '626228bc-3729-4598-9c02-a0fe886a403f'
     and delivery_note_id = '4e9acdad-849b-4db2-8b3f-9d207d5c6fa0'
     and product_id = 'c52beecc-4099-4409-a544-580fb101c626';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ligne du BL : % ligne(s) trouvée(s) au lieu de 1 : arrêt', n; end if;
end $$;
commit;
