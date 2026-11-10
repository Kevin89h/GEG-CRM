-- DEV ONLY (base de test cpgufjndoiffskxvojzt) — décision du 10/11/2026 (lignes libres de GEG Singapour).
-- Facture émise FAC-2026-09-0002 (2 lignes libres, document non modifié) :
--   « Ration de Comabet 4000kcal (1,8kg) »        → correspondance PROPOSÉE vers la fiche existante « Ration de Combat 24H - 4000Kcal -1,8Kg »
--   « Transport aerien pour 10 000rations »       → nouveau service « Fret aérien » (à compléter) + correspondance PROPOSÉE
-- Aucune validation automatique, aucun montant, aucune TVA, aucun stock, aucune écriture comptable.
-- NE PAS EXÉCUTER EN PRODUCTION sans validation (voir le script de déploiement préparé).

begin;

-- (le catalogue Singapour n'a pas de code produit)
insert into geg_singapore.products (name, product_type, category_id, unit_id, is_active, to_complete, missing_info, currency, can_be_sold, can_be_purchased)
select 'Fret aérien', 'service',
  (select id from geg_singapore.product_categories where name = 'Autre' limit 1),
  (select id from geg_singapore.units where name like 'Unit_' order by name limit 1),
  true, true, 'désignation exacte ; prix de vente', 'EUR', true, false
where not exists (select 1 from geg_singapore.products where name = 'Fret aérien');

insert into geg_singapore.historical_line_links (line_table, line_id, product_id, status, source, note)
select 'invoice_lines', l.id, p.id, 'proposed', 'auto_h4', x.note
from (values
  ('Ration de Comabet 4000kcal (1,8kg)', 'Ration de Combat 24H - 4000Kcal -1,8Kg', 'Rapprochement H4 Singapour, catégorie 1'),
  ('Transport aerien pour 10 000rations', 'Fret aérien', 'Rapprochement H4 Singapour, catégorie 2')
) x(label, target, note)
join geg_singapore.invoice_lines l on l.description = x.label and l.product_id is null and l.line_type = 'product'
join geg_singapore.products p on p.name = x.target and p.is_active
where not exists (select 1 from geg_singapore.historical_line_links k where k.line_id = l.id and k.status <> 'cancelled');

commit;
