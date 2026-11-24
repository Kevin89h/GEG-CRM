-- PROD_13 : reclassement de fiches du catalogue (décision GEG du 24/11/2026, point 2). GEG Guinée.
-- À exécuter APRÈS les migrations 20261124120000 et 20261125120000. Retour arrière : PROD_13_..._ROLLBACK.sql
--
-- - Remises : PRD-00103, PRD-00114, PRD-00162 → type « Remise » (discount)
-- - Prestations : PRD-00045, PRD-00113, PRD-00148, PRD-00287, PRD-00303 → type « Prestation » (service)
-- - Fiche standard « Frais de transport » pour les futures opérations : PRD-00032 (déjà prestation).
--   PRD-00045 (même désignation) reste ACTIVE tant que des devis en cours l'utilisent (sinon ils ne pourraient plus
--   être facturés) ; sa désignation signale qu'elle n'est plus la fiche standard. Aucune fiche supprimée ni fusionnée.
--
-- Sécurité : chaque fiche est ciblée par son code ET sa désignation exacte ET son type actuel. Une fiche qui ne
-- correspond pas (désignation différente, comme PRD-00303 sur Dev) ou qui a encore du stock est IGNORÉE et signalée.
-- Les lignes de devis, factures, BL et mouvements existants ne sont pas modifiés (elles gardent leur désignation).
begin;

create temporary table prod13_resultat (code text, designation text, avant text, apres text, resultat text) on commit drop;

do $$
declare r record; v_id uuid; v_type text; v_stock numeric;
begin
  for r in select * from (values
    ('PRD-00103', 'Remise 3%',                                  'storable', 'discount'),
    ('PRD-00114', 'DISCOUNT',                                   'storable', 'discount'),
    ('PRD-00162', 'REMISE',                                     'storable', 'discount'),
    ('PRD-00045', 'Frais de transport',                         'storable', 'service'),
    ('PRD-00113', 'FREIGHT',                                    'storable', 'service'),
    ('PRD-00148', 'Transport Maritime',                         'storable', 'service'),
    ('PRD-00287', 'Ajustement des frais de transport',          'storable', 'service'),
    ('PRD-00303', 'TRANSPORTATION,MANUTENTION & ACCES FEES',    'storable', 'service')
  ) as t(code, designation, avant, apres) loop
    select id, product_type into v_id, v_type from geg_guinee.products where product_code = r.code and name = r.designation;
    if v_id is null then
      insert into prod13_resultat values (r.code, r.designation, r.avant, r.apres, 'IGNORÉE : code et désignation ne correspondent pas');
      continue;
    end if;
    if v_type is distinct from r.avant then
      insert into prod13_resultat values (r.code, r.designation, v_type, r.apres, 'IGNORÉE : type actuel inattendu');
      continue;
    end if;
    select coalesce(sum(abs(quantity)), 0) into v_stock from geg_guinee.stock_levels where product_id = v_id;
    if v_stock <> 0 then
      insert into prod13_resultat values (r.code, r.designation, v_type, r.apres, 'IGNORÉE : stock non nul (' || v_stock || '), à examiner');
      continue;
    end if;
    update geg_guinee.products set product_type = r.apres, packaging = null, packaging_other = null, packaging_status = null where id = v_id;
    insert into prod13_resultat values (r.code, r.designation, v_type, r.apres, 'RECLASSÉE');
  end loop;

  -- ancienne fiche « Frais de transport » : signalée comme non standard (reste active pour les devis en cours)
  update geg_guinee.products set name = 'Frais de transport (ancienne fiche : utiliser PRD-00032)'
  where product_code = 'PRD-00045' and name = 'Frais de transport' and product_type = 'service';
  if found then insert into prod13_resultat values ('PRD-00045', 'Frais de transport', 'service', 'service', 'DÉSIGNATION : ancienne fiche, utiliser PRD-00032'); end if;
end $$;

select * from prod13_resultat order by code;
commit;
