-- PROD_15 (MODÈLE) : inscription au registre des anomalies historiques de livraison des lignes VALIDÉES par GEG.
-- À n'exécuter qu'après le déploiement, avec la liste validée par Coline (onglet 2 de PRIORITES_DEBLOCAGE_25_11.xlsx,
-- réponse « Oui - avant le dernier inventaire »). Aucun stock, aucun BL, aucun statut n'est modifié : la ligne sort
-- seulement du calcul « déjà facturé non livré » du contrôle M4. Retour arrière : supprimer les lignes de la source.
--
-- 1. Remplacer la liste ci-dessous (identifiant technique de la ligne, motif) ; 2. renseigner le validateur ;
-- 3. exécuter : chaque ligne est contrôlée (facture émise, marchandise encore « à livrer », pas déjà inscrite),
--    toute ligne non conforme est REFUSÉE et listée, sans rien inscrire.
begin;
create temporary table prod15_demande (invoice_line_id uuid, motif text) on commit drop;
insert into prod15_demande (invoice_line_id, motif) values
  -- ('00000000-0000-0000-0000-000000000000', 'Marchandise partie avant l''inventaire du JJ/MM, confirmé par <équipe> le JJ/MM'),
  (null, null);
delete from prod15_demande where invoice_line_id is null;

do $$
declare v_validator uuid := null;   -- ← identifiant de l'utilisateur de Coline (profiles.id), à renseigner
  v_bad text;
begin
  if v_validator is null then raise exception 'Renseignez le validateur (Coline) avant d''exécuter'; end if;
  select string_agg(d.invoice_line_id::text || ' : ' || coalesce(case
      when x.invoice_line_id is null then 'ligne introuvable ou non marchandise'
      when i.status not in ('sent', 'partial', 'paid') then 'facture non émise'
      when x.remaining <= 0 then 'plus rien à livrer'
      when a.invoice_line_id is not null then 'déjà inscrite'
      when btrim(coalesce(d.motif, '')) = '' then 'motif manquant' end, 'ok'), ' ; ')
    into v_bad
  from prod15_demande d
  left join geg_guinee.invoice_line_delivery x on x.invoice_line_id = d.invoice_line_id
  left join geg_guinee.invoices i on i.id = x.invoice_id
  left join geg_guinee.delivery_history_anomalies a on a.invoice_line_id = d.invoice_line_id
  where x.invoice_line_id is null or i.status not in ('sent', 'partial', 'paid') or x.remaining <= 0 or a.invoice_line_id is not null or btrim(coalesce(d.motif, '')) = '';
  if v_bad is not null then raise exception 'Rien n''a été inscrit. Lignes refusées : %', v_bad; end if;
  insert into geg_guinee.delivery_history_anomalies (invoice_line_id, motif, validated_by, source)
  select invoice_line_id, btrim(motif), v_validator, 'PROD_15 ' || to_char(now(), 'YYYY-MM-DD') from prod15_demande;
end $$;

select i.number facture, p.product_code, x.description, x.remaining reste, a.motif
from geg_guinee.delivery_history_anomalies a join geg_guinee.invoice_line_delivery x on x.invoice_line_id = a.invoice_line_id
join geg_guinee.invoices i on i.id = x.invoice_id left join geg_guinee.products p on p.id = x.product_id
where a.source like 'PROD_15%' order by i.number;
commit;
