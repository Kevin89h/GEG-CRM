-- PRODUCTION — À EXÉCUTER UNIQUEMENT APRÈS AUTORISATION EXPLICITE (décision 1 du 10/11/2026, option A).
-- Prérequis : migrations 20261110120000_catalogue_stock, 20261111120000_catalogue_complements,
--             20261112120000_commentaires_impression_bl appliquées ; code des commits correspondants déployé.
-- Crée les 49 fiches GEG Guinée préparées sur Dev (48 « À compléter » + Remise commerciale)
-- et le service « Fret aérien » de GEG Singapour. Actives, utilisables dans les devis et factures.
-- Aucune information inventée : seules celles des libellés d'origine ; le reste est listé dans missing_info.
-- Idempotent : une fiche dont le nom existe déjà n'est pas recréée (le contrôle final le signale).
-- Généré le 2026-11-10 depuis la base Dev.

begin;

with p(name, ptype, cat, unit, brand, to_complete, missing, currency, can_sell, can_buy) as (values
  ('4x4 neuf', 'storable', 'Autre', 'Unité', null, true, 'marque ; modèle ; motorisation ; prix de vente', 'GNF', true, true),
  ('4x4 usagé', 'storable', 'Autre', 'Unité', null, true, 'marque ; modèle ; année ; kilométrage ; prix de vente', 'GNF', true, true),
  ('Ambulance 4', 'storable', 'Autre', 'Unité', null, true, 'marque ; modèle ; année ; équipements ; prix de vente', 'GNF', true, true),
  ('Ambulance 5', 'storable', 'Autre', 'Unité', null, true, 'marque ; modèle ; année ; équipements ; prix de vente', 'GNF', true, true),
  ('Corde de maçon', 'storable', 'Autre', 'Unité', null, true, 'longueur ; prix de vente', 'GNF', true, true),
  ('Décamètre 30 m', 'storable', 'Autre', 'Unité', null, true, 'marque ; prix de vente', 'GNF', true, true),
  ('Disque à couper', 'storable', 'Autre', 'Unité', null, true, 'diamètre ; matériau à couper ; marque ; prix de vente', 'GNF', true, true),
  ('Disque à meuler', 'storable', 'Autre', 'Unité', null, true, 'diamètre ; marque ; prix de vente', 'GNF', true, true),
  ('Fil à plomb', 'storable', 'Autre', 'Unité', null, true, 'poids ; prix de vente', 'GNF', true, true),
  ('Fil à pointe', 'storable', 'Autre', 'Unité', null, true, 'nature (fil en rouleau ou pointes) ; dimensions ; conditionnement ; prix de vente', 'GNF', true, true),
  ('Filtre à air excavateur primaire et secondaire', 'storable', 'Autre', 'Unité', null, true, 'marque ; référence pièce ; modèle d''engin ; lot ou pièces séparées ; prix de vente', 'GNF', true, true),
  ('Filtre à gasoil', 'storable', 'Autre', 'Unité', null, true, 'engin concerné ; marque ; référence pièce ; prix de vente', 'GNF', true, true),
  ('Fret aérien', 'service', 'Autre', 'Unité', null, true, 'désignation exacte', 'GNF', true, false),
  ('FUCHS RENOLIN CLP 320 200 L', 'storable', 'Lubrifiants', '200 L', 'FUCHS', true, 'référence ; conditionnement exact (200 L d''après les documents) ; prix de vente', 'GNF', true, true),
  ('FUCHS RENOLIN CLP 460 200 L', 'storable', 'Lubrifiants', '200 L', 'FUCHS', true, 'référence ; conditionnement exact (200 L d''après les documents) ; prix de vente', 'GNF', true, true),
  ('Fût', 'storable', 'Autre', 'Unité', null, true, 'contenance ; matière ; neuf ou vide de récupération ; prix de vente', 'GNF', true, true),
  ('GEG ANTIFREEZE SF12+ 200 L', 'storable', 'Autre', '200 L', 'GEG', true, 'référence ; différence avec « GEG LIQUIDE DE REFROIDISSEMENT SF12 » ; prix de vente', 'GNF', true, true),
  ('GEG ATF VI 200 L', 'storable', 'Lubrifiants', '200 L', 'GEG', true, 'référence ; prix de vente', 'GNF', true, true),
  ('GEG REDUCTOR CLP 460 200 L', 'storable', 'Lubrifiants', '200 L', 'GEG', true, 'référence commerciale ; prix de vente', 'GNF', true, true),
  ('Groupe électrogène 10 kVA', 'storable', 'Autre', 'Unité', null, true, 'marque ; modèle ; carburant ; prix de vente', 'GNF', true, true),
  ('Lame pour scie (grand modèle)', 'storable', 'Autre', 'Unité', null, true, 'dimensions ; type de scie ; marque ; prix de vente', 'GNF', true, true),
  ('Lame pour scie (petit modèle)', 'storable', 'Autre', 'Unité', null, true, 'dimensions ; type de scie ; marque ; prix de vente', 'GNF', true, true),
  ('Marteau 1 kg', 'storable', 'Autre', 'Unité', null, true, 'marque ; prix de vente', 'GNF', true, true),
  ('Marteau 2 kg', 'storable', 'Autre', 'Unité', null, true, 'marque ; prix de vente', 'GNF', true, true),
  ('Marteau 5 kg', 'storable', 'Autre', 'Unité', null, true, 'marque ; prix de vente', 'GNF', true, true),
  ('Marteau piqueur', 'storable', 'Autre', 'Unité', null, true, 'marque ; puissance ; modèle ; prix de vente', 'GNF', true, true),
  ('Mètre ruban 5 m', 'storable', 'Autre', 'Unité', null, true, 'marque ; confirmer qu''il s''agit bien d''un mètre ruban (libellé d''origine « Centimètre 5m ») ; prix de vente', 'GNF', true, true),
  ('Meuleuse', 'storable', 'Autre', 'Unité', null, true, 'marque ; puissance ; diamètre de disque ; prix de vente', 'GNF', true, true),
  ('Niveau à bulle', 'storable', 'Autre', 'Unité', null, true, 'longueur ; prix de vente (libellé d''origine « Niveau d''eau »)', 'GNF', true, true),
  ('Perceuse', 'storable', 'Autre', 'Unité', null, true, 'marque ; puissance ; prix de vente', 'GNF', true, true),
  ('PETRONAS GEAR FL 220 200 L', 'storable', 'Lubrifiants', '200 L', 'PETRONAS', true, 'référence ; conditionnement exact (200 L d''après les documents) ; prix de vente', 'GNF', true, true),
  ('PETRONAS GEAR FL 320 200 L', 'storable', 'Lubrifiants', '200 L', 'PETRONAS', true, 'référence ; conditionnement exact (200 L d''après les documents) ; prix de vente', 'GNF', true, true),
  ('Pneu 11R22.5 Double Road', 'storable', 'Pneus', 'Unité', 'Double Road', true, 'modèle exact ; prix de vente', 'GNF', true, true),
  ('Pneu 12R22.5 Triangle', 'storable', 'Pneus', 'Unité', 'Triangle', true, 'modèle exact ; prix de vente', 'GNF', true, true),
  ('Pneu 245/70R16 LT Double Road', 'storable', 'Pneus', 'Unité', 'Double Road', true, 'modèle exact ; prix de vente', 'GNF', true, true),
  ('Pneu JOYROAD 265/65R17', 'storable', 'Pneus', 'Unité', 'JOYROAD', true, 'modèle exact ; prix de vente', 'GNF', true, true),
  ('Pneu LUXXAN 245/70R17', 'storable', 'Pneus', 'Unité', 'LUXXAN', true, 'modèle exact ; prix de vente', 'GNF', true, true),
  ('Rallonge électrique 50 m', 'storable', 'Autre', 'Unité', null, true, 'section du câble ; marque ; prix de vente', 'GNF', true, true),
  ('Remise commerciale', 'service', 'Autre', 'Unité', null, false, null, 'GNF', true, false),
  ('Scie électrique 1600 W', 'storable', 'Autre', 'Unité', null, true, 'marque ; modèle ; prix de vente', 'GNF', true, true),
  ('Scie électrique 2200 W', 'storable', 'Autre', 'Unité', null, true, 'marque ; modèle ; prix de vente', 'GNF', true, true),
  ('Seau de maçon', 'storable', 'Autre', 'Unité', null, true, 'contenance ; prix de vente', 'GNF', true, true),
  ('SHELL 20W50 200 L', 'storable', 'Lubrifiants', '200 L', 'SHELL', true, 'gamme Shell exacte (Rimula, Helix…) ; référence ; prix de vente', 'GNF', true, true),
  ('Sonnerie de marche arrière', 'storable', 'Autre', 'Unité', null, true, 'tension 12 V ou 24 V ; marque ; prix de vente', 'GNF', true, true),
  ('TOTAL CARTER XEP 220 200 L', 'storable', 'Lubrifiants', '200 L', 'TOTAL', true, 'conditionnement (200 L d''après les documents, ou 205 L ?) ; référence ; prix de vente', 'GNF', true, true),
  ('TOTAL CARTER XEP 320', 'storable', 'Lubrifiants', null, 'TOTAL', true, 'conditionnement (200 L d''après les documents, ou 205 L ?) ; référence ; prix de vente', 'GNF', true, true),
  ('TOTAL CARTER XEP 460 200 L', 'storable', 'Lubrifiants', '200 L', 'TOTAL', true, 'conditionnement (200 L d''après les documents, ou 205 L ?) ; référence ; prix de vente', 'GNF', true, true),
  ('Vibrateur à moteur', 'storable', 'Autre', 'Unité', null, true, 'marque ; puissance ; carburant ; prix de vente', 'GNF', true, true),
  ('Vibrateur électrique', 'storable', 'Autre', 'Unité', null, true, 'marque ; puissance ; prix de vente', 'GNF', true, true)
), base as (
  select coalesce(max(substring(product_code from 5)::int), 0) n from geg_guinee.products where product_code ~ '^PRD-[0-9]+$'
), todo as (
  select p.*, row_number() over (order by p.name) rn from p
  where not exists (select 1 from geg_guinee.products x where x.name = p.name)
)
insert into geg_guinee.products (name, product_type, category_id, unit_id, brand, is_active, to_complete, missing_info, currency, can_be_sold, can_be_purchased, product_code)
select t.name, t.ptype,
  (select id from geg_guinee.product_categories c where c.name = t.cat order by c.name limit 1),
  (select id from geg_guinee.units u where u.name = t.unit order by u.name limit 1),
  t.brand, true, t.to_complete, t.missing, t.currency, t.can_sell, t.can_buy,
  'PRD-' || lpad((base.n + t.rn)::text, 5, '0')
from todo t, base;

-- GEG Singapour (pas de code produit dans ce catalogue)
with p(name, ptype, cat, unit, brand, to_complete, missing, currency, can_sell, can_buy) as (values
  ('Fret aérien', 'service', null, 'Unité', null, true, 'désignation exacte ; prix de vente', 'EUR', true, false)
)
insert into geg_singapore.products (name, product_type, category_id, unit_id, brand, is_active, to_complete, missing_info, currency, can_be_sold, can_be_purchased)
select p.name, p.ptype,
  (select id from geg_singapore.product_categories c where c.name = p.cat order by c.name limit 1),
  (select id from geg_singapore.units u where u.name = p.unit order by u.name limit 1),
  p.brand, true, p.to_complete, p.missing, p.currency, p.can_sell, p.can_buy
from p where not exists (select 1 from geg_singapore.products x where x.name = p.name);

-- Contrôle : doit renvoyer 49 et 1
select (select count(*) from geg_guinee.products where to_complete or name = 'Remise commerciale') as guinee,
       (select count(*) from geg_singapore.products where name = 'Fret aérien') as singapour;

commit;
