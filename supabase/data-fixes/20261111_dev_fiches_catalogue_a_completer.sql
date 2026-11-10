-- DEV ONLY (base de test cpgufjndoiffskxvojzt) — décisions du 10/11/2026, points 3 à 5.
-- Fiches créées depuis les lignes libres historiques : 26 proposées (catégorie 2), 12 incertaines (catégorie 3),
-- 11 marchandises aux informations insuffisantes (catégorie 4). Rien pour les lignes vides ni « Nouvelle ligne ».
-- Actives et marquées « À compléter » (décision du 10/11/2026) ; aucune référence, marque, caractéristique,
-- conditionnement ou prix inventés : seules les informations présentes dans les libellés d'origine sont reprises.
-- Les fiches existantes du catalogue ne sont pas touchées (pas de fusion, désactivation ni reclassement).
-- NE PAS EXÉCUTER EN PRODUCTION sans validation.

begin;

-- Catégorie 2 : les 26 fiches proposées (déjà créées inactives par 20261110_dev_propositions_catalogue_h4.sql)
with v(name, brand, unit, missing) as (values
  ('Fret aérien',                   null,         null,    'désignation exacte'),
  ('Remise commerciale',            null,         null,    null),
  ('GEG REDUCTOR CLP 460 200 L',    'GEG',        null,    'référence commerciale ; prix de vente'),
  ('FUCHS RENOLIN CLP 320 200 L',   'FUCHS',      null,    'référence ; conditionnement exact (200 L d''après les documents) ; prix de vente'),
  ('FUCHS RENOLIN CLP 460 200 L',   'FUCHS',      null,    'référence ; conditionnement exact (200 L d''après les documents) ; prix de vente'),
  ('PETRONAS GEAR FL 220 200 L',    'PETRONAS',   null,    'référence ; conditionnement exact (200 L d''après les documents) ; prix de vente'),
  ('PETRONAS GEAR FL 320 200 L',    'PETRONAS',   null,    'référence ; conditionnement exact (200 L d''après les documents) ; prix de vente'),
  ('SHELL 20W50 200 L',             'SHELL',      null,    'gamme Shell exacte (Rimula, Helix…) ; référence ; prix de vente'),
  ('TOTAL CARTER XEP 320',          'TOTAL',      null,    'conditionnement (200 L d''après les documents, ou 205 L ?) ; référence ; prix de vente'),
  ('Pneu 11R22.5 Double Road',      'Double Road', null,   'modèle exact ; prix de vente'),
  ('Pneu 12R22.5 Triangle',         'Triangle',   null,    'modèle exact ; prix de vente'),
  ('Pneu 245/70R16 LT Double Road', 'Double Road', null,   'modèle exact ; prix de vente'),
  ('Groupe électrogène 10 kVA',     null,         null,    'marque ; modèle ; carburant ; prix de vente'),
  ('Scie électrique 1600 W',        null,         null,    'marque ; modèle ; prix de vente'),
  ('Scie électrique 2200 W',        null,         null,    'marque ; modèle ; prix de vente'),
  ('Marteau 1 kg',                  null,         null,    'marque ; prix de vente'),
  ('Marteau 2 kg',                  null,         null,    'marque ; prix de vente'),
  ('Marteau 5 kg',                  null,         null,    'marque ; prix de vente'),
  ('Décamètre 30 m',                null,         null,    'marque ; prix de vente'),
  ('Mètre ruban 5 m',               null,         null,    'marque ; confirmer qu''il s''agit bien d''un mètre ruban (libellé d''origine « Centimètre 5m ») ; prix de vente'),
  ('Rallonge électrique 50 m',      null,         null,    'section du câble ; marque ; prix de vente'),
  ('Sonnerie de marche arrière',    null,         null,    'tension 12 V ou 24 V ; marque ; prix de vente'),
  ('Corde de maçon',                null,         null,    'longueur ; prix de vente'),
  ('Seau de maçon',                 null,         null,    'contenance ; prix de vente'),
  ('Fil à plomb',                   null,         null,    'poids ; prix de vente'),
  ('Niveau à bulle',                null,         null,    'longueur ; prix de vente (libellé d''origine « Niveau d''eau »)')
)
update geg_guinee.products p
set is_active = true,
    to_complete = v.missing is not null,
    missing_info = v.missing,
    brand = coalesce(v.brand, p.brand),
    description = null
from v
where p.name = v.name and p.description like '[Proposition H4%';

-- Catégories 3 et 4 : nouvelles fiches, jamais fusionnées avec les articles existants
with p(name, ptype, cat, unit, brand, missing) as (values
  -- catégorie 3 (correspondance incertaine : fiches distinctes ; marques différentes = fiches distinctes)
  ('Ambulance 4',                                  'storable', 'Autre',       'Unité', null,      'marque ; modèle ; année ; équipements ; prix de vente'),
  ('Ambulance 5',                                  'storable', 'Autre',       'Unité', null,      'marque ; modèle ; année ; équipements ; prix de vente'),
  ('Fil à pointe',                                 'storable', 'Autre',       'Unité', null,      'nature (fil en rouleau ou pointes) ; dimensions ; conditionnement ; prix de vente'),
  ('Filtre à air excavateur primaire et secondaire','storable','Autre',       'Unité', null,      'marque ; référence pièce ; modèle d''engin ; lot ou pièces séparées ; prix de vente'),
  ('Filtre à gasoil',                              'storable', 'Autre',       'Unité', null,      'engin concerné ; marque ; référence pièce ; prix de vente'),
  ('GEG ANTIFREEZE SF12+ 200 L',                   'storable', 'Autre',       '200 L', 'GEG',     'référence ; différence avec « GEG LIQUIDE DE REFROIDISSEMENT SF12 » ; prix de vente'),
  ('GEG ATF VI 200 L',                             'storable', 'Lubrifiants', '200 L', 'GEG',     'référence ; prix de vente'),
  ('Marteau piqueur',                              'storable', 'Autre',       'Unité', null,      'marque ; puissance ; modèle ; prix de vente'),
  ('Pneu JOYROAD 265/65R17',                       'storable', 'Pneus',       'Unité', 'JOYROAD', 'modèle exact ; prix de vente'),
  ('Pneu LUXXAN 245/70R17',                        'storable', 'Pneus',       'Unité', 'LUXXAN',  'modèle exact ; prix de vente'),
  ('TOTAL CARTER XEP 220 200 L',                   'storable', 'Lubrifiants', '200 L', 'TOTAL',   'conditionnement (200 L d''après les documents, ou 205 L ?) ; référence ; prix de vente'),
  ('TOTAL CARTER XEP 460 200 L',                   'storable', 'Lubrifiants', '200 L', 'TOTAL',   'conditionnement (200 L d''après les documents, ou 205 L ?) ; référence ; prix de vente'),
  -- catégorie 4 (informations insuffisantes : seulement les vraies marchandises)
  ('4x4 neuf',                                     'storable', 'Autre',       'Unité', null,      'marque ; modèle ; motorisation ; prix de vente'),
  ('4x4 usagé',                                    'storable', 'Autre',       'Unité', null,      'marque ; modèle ; année ; kilométrage ; prix de vente'),
  ('Disque à couper',                              'storable', 'Autre',       'Unité', null,      'diamètre ; matériau à couper ; marque ; prix de vente'),
  ('Disque à meuler',                              'storable', 'Autre',       'Unité', null,      'diamètre ; marque ; prix de vente'),
  ('Lame pour scie (grand modèle)',                'storable', 'Autre',       'Unité', null,      'dimensions ; type de scie ; marque ; prix de vente'),
  ('Lame pour scie (petit modèle)',                'storable', 'Autre',       'Unité', null,      'dimensions ; type de scie ; marque ; prix de vente'),
  ('Meuleuse',                                     'storable', 'Autre',       'Unité', null,      'marque ; puissance ; diamètre de disque ; prix de vente'),
  ('Perceuse',                                     'storable', 'Autre',       'Unité', null,      'marque ; puissance ; prix de vente'),
  ('Vibrateur à moteur',                           'storable', 'Autre',       'Unité', null,      'marque ; puissance ; carburant ; prix de vente'),
  ('Vibrateur électrique',                         'storable', 'Autre',       'Unité', null,      'marque ; puissance ; prix de vente'),
  ('Fût',                                          'storable', 'Autre',       'Unité', null,      'contenance ; matière ; neuf ou vide de récupération ; prix de vente')
)
insert into geg_guinee.products (name, product_type, category_id, unit_id, brand, is_active, to_complete, missing_info, currency, can_be_sold, can_be_purchased)
select p.name, p.ptype,
  (select id from geg_guinee.product_categories c where c.name = p.cat limit 1),
  (select id from geg_guinee.units u where u.name like replace(p.unit, 'é', '_') order by u.name limit 1),
  p.brand, true, true, p.missing, 'GNF', true, true
from p
where not exists (select 1 from geg_guinee.products x where x.name = p.name);

commit;

-- Codes produit PRD-xxxxx (suite de la numérotation existante) pour les nouvelles fiches qui n'en ont pas
begin;
with base as (
  select coalesce(max(substring(product_code from 5)::int), 0) n from geg_guinee.products where product_code ~ '^PRD-[0-9]+$'
), todo as (
  select id, row_number() over (order by name) rn from geg_guinee.products
  where product_code is null and (to_complete or name = 'Remise commerciale')
)
update geg_guinee.products p set product_code = 'PRD-' || lpad((base.n + todo.rn)::text, 5, '0')
from todo, base where p.id = todo.id;
commit;
