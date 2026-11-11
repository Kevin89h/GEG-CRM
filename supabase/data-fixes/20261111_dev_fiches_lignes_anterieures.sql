-- DEV ONLY (base de test cpgufjndoiffskxvojzt) — décision GEG du 11/11/2026 sur les 84 lignes libres plus anciennes.
-- Périmètre : GEG Guinée, toutes les lignes libres de factures et devis de production (202 au total, du 10/01/2025 au 10/11/2026),
-- dont 84 hors du premier rapprochement. Ce script ne crée QUE les fiches déjà décidées :
--   - références incertaines (catégorie 3) : fiches distinctes, jamais fusionnées (19 marchandises) ;
--   - articles absents : 3 marchandises ;
--   - services génériques (décision « service générique, détail conservé en commentaire ») : 3 services.
-- Ne sont PAS traités ici (en attente de décision) : les 17 libellés « probables » et la ligne « 15 ».
-- Actives et « À compléter » ; seules les informations présentes dans les libellés d'origine sont reprises.
-- Les fiches existantes ne sont pas touchées. NE PAS EXÉCUTER EN PRODUCTION sans validation.

begin;

with p(name, ptype, cat, unit, brand, missing) as (values
  -- catégorie 3 : fiches distinctes
  ('Ardeca 80W-90',                                'storable', 'Lubrifiants', null,    'Ardeca',   'gamme ; conditionnement ; référence ; prix de vente'),
  ('Bouteille d''oxygène (occasion)',              'storable', 'Autre',       'Unité', null,       'contenance ; état ; prix de vente'),
  ('Bouteille de gaz (occasion)',                  'storable', 'Autre',       'Unité', null,       'type de gaz ; contenance ; état ; prix de vente'),
  ('Chariot de transport',                         'storable', 'Autre',       'Unité', null,       'type ; charge maximale ; marque ; prix de vente'),
  ('Conteneur 20 pieds',                           'storable', 'Autre',       'Unité', null,       'neuf ou occasion ; type (dry, frigorifique…) ; prix de vente'),
  ('DIESEL EXTRA 20W50 (fût)',                     'storable', 'Lubrifiants', null,    null,       'marque (GEG, GPN…) ; contenance du fût ; référence ; prix de vente'),
  ('EUROTEC Classicol Diesel 15W-40 CF-4/SG 4 L',  'storable', 'Lubrifiants', '4 L',   'EUROTEC',  'référence ; prix de vente'),
  ('EUROTEC Hydraulic Oil HLP 68 200 L',           'storable', 'Lubrifiants', '200 L', 'EUROTEC',  'référence ; prix de vente'),
  ('EUROTEC Hydraulic Oil HLP 68 20 L',            'storable', 'Lubrifiants', '20 L',  'EUROTEC',  'référence ; prix de vente'),
  ('EUROTEC Monotec HD SAE 50 CF-4/SG 4 L',        'storable', 'Lubrifiants', '4 L',   'EUROTEC',  'référence ; prix de vente'),
  ('EUROTEC MotoPrime 4T 20W-50 1 L',              'storable', 'Lubrifiants', '1 L',   'EUROTEC',  'référence ; prix de vente'),
  ('GEG Coolant SF12 Premix',                      'storable', 'Autre',       null,    'GEG',      'conditionnement ; différence avec « GEG LIQUIDE DE REFROIDISSEMENT SF12 » ; prix de vente'),
  ('GPN DIESEL EXTRA 15W40 20 L',                  'storable', 'Lubrifiants', '20 L',  'GPN',      'référence ; prix de vente'),
  ('GPN DIESEL EXTRA 15W40 5 L',                   'storable', 'Lubrifiants', '5 L',   'GPN',      'référence ; prix de vente'),
  ('GPN PREMIUM 10W40 5 L',                        'storable', 'Lubrifiants', '5 L',   'GPN',      'gamme exacte (PREMIUM ou PREMIUM L) ; référence ; prix de vente'),
  ('GPN PREMIUM 5W30 5 L',                         'storable', 'Lubrifiants', '5 L',   'GPN',      'référence ; prix de vente'),
  ('HD 50 (fût)',                                  'storable', 'Lubrifiants', null,    null,       'marque ; contenance du fût ; référence ; prix de vente'),
  ('HLP 68 (cuve)',                                'storable', 'Lubrifiants', null,    null,       'marque ; volume ; référence ; prix de vente'),
  ('Pneu 205R16C',                                 'storable', 'Pneus',       'Unité', null,       'marque (Continental ou Bridgestone : fiches distinctes) ; modèle ; prix de vente'),
  -- articles absents
  ('Filtre séparateur électrique',                 'storable', 'Autre',       'Unité', null,       'engin concerné ; marque ; référence pièce ; prix de vente'),
  ('GPN GREASE EP 2 5 L',                          'storable', 'Autre',       '5 L',   'GPN',      'référence ; prix de vente'),
  ('Kit chalumeau sans bouteilles',                'storable', 'Autre',       'Unité', null,       'marque ; composition du kit ; prix de vente'),
  -- services génériques (le détail de chaque ligne historique est conservé dans le commentaire de la correspondance)
  ('Frais de débours',                             'service',  'Autre',       'Unité', null,       'désignation exacte ; mode de facturation'),
  ('Prestation de services',                       'service',  'Autre',       'Unité', null,       'nature des prestations ; mode de facturation'),
  ('Fret maritime conteneur 40 pieds',             'service',  'Autre',       'Unité', null,       'désignation exacte ; prix de vente')
), base as (
  select coalesce(max(substring(product_code from 5)::int), 0) n from geg_guinee.products where product_code ~ '^PRD-[0-9]+$'
), todo as (
  select p.*, row_number() over (order by p.name) rn from p
  where not exists (select 1 from geg_guinee.products x where lower(x.name) = lower(p.name))
)
insert into geg_guinee.products (name, product_type, category_id, unit_id, brand, is_active, to_complete, missing_info, currency, can_be_sold, can_be_purchased, product_code)
select t.name, t.ptype,
  (select id from geg_guinee.product_categories c where c.name = t.cat order by c.name limit 1),
  (select id from geg_guinee.units u where u.name like replace(t.unit, 'é', '_') order by u.name limit 1),
  t.brand, true, true, t.missing, 'GNF', true, t.ptype <> 'service',
  'PRD-' || lpad((base.n + t.rn)::text, 5, '0')
from todo t, base;

commit;
