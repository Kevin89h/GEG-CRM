-- PRODUCTION — À EXÉCUTER UNIQUEMENT APRÈS AUTORISATION EXPLICITE (décision 1 du 10/11/2026, option A).
-- Prérequis : migrations 20261110120000_catalogue_stock, 20261111120000_catalogue_complements,
--             20261112120000_commentaires_impression_bl appliquées ; code des commits correspondants déployé.
-- Crée les 80 fiches GEG Guinée préparées sur Dev (79 « À compléter » + Remise commerciale)
-- et le service « Fret aérien » de GEG Singapour. Actives, utilisables dans les devis et factures.
-- Aucune information inventée : seules celles des libellés d'origine ; le reste est listé dans missing_info.
-- Idempotent : une fiche dont le nom existe déjà n'est pas recréée (le contrôle final le signale).
-- Généré le 2026-11-11 depuis la base Dev.

begin;

with p(name, ptype, cat, unit, brand, to_complete, missing, currency, can_sell, can_buy) as (values
  ('15W40 (à identifier)', 'storable', 'Lubrifiants', null, null, true, 'désignation (gamme) ; marque ; conditionnement ; référence ; prix de vente (libellé d''origine « 15w40 »)', 'GNF', true, true),
  ('4x4 neuf', 'storable', 'Autre', 'Unité', null, true, 'marque ; modèle ; motorisation ; prix de vente', 'GNF', true, true),
  ('4x4 usagé', 'storable', 'Autre', 'Unité', null, true, 'marque ; modèle ; année ; kilométrage ; prix de vente', 'GNF', true, true),
  ('Ambulance 4', 'storable', 'Autre', 'Unité', null, true, 'marque ; modèle ; année ; équipements ; prix de vente', 'GNF', true, true),
  ('Ambulance 5', 'storable', 'Autre', 'Unité', null, true, 'marque ; modèle ; année ; équipements ; prix de vente', 'GNF', true, true),
  ('Ardeca 80W-90', 'storable', 'Lubrifiants', null, 'Ardeca', true, 'gamme ; conditionnement ; référence ; prix de vente', 'GNF', true, true),
  ('Bouteille d''oxygène (occasion)', 'storable', 'Autre', 'Unité', null, true, 'contenance ; état ; prix de vente', 'GNF', true, true),
  ('Bouteille de gaz (occasion)', 'storable', 'Autre', 'Unité', null, true, 'type de gaz ; contenance ; état ; prix de vente', 'GNF', true, true),
  ('Chariot de transport', 'storable', 'Autre', 'Unité', null, true, 'type ; charge maximale ; marque ; prix de vente', 'GNF', true, true),
  ('Conteneur 20 pieds', 'storable', 'Autre', 'Unité', null, true, 'neuf ou occasion ; type (dry, frigorifique…) ; prix de vente', 'GNF', true, true),
  ('Corde de maçon', 'storable', 'Autre', 'Unité', null, true, 'longueur ; prix de vente', 'GNF', true, true),
  ('Décamètre 30 m', 'storable', 'Autre', 'Unité', null, true, 'marque ; prix de vente', 'GNF', true, true),
  ('DIESEL EXTRA 15W40 (cuve)', 'storable', 'Lubrifiants', null, null, true, 'marque (GEG, GPN…) ; volume ; référence ; prix de vente', 'GNF', true, true),
  ('DIESEL EXTRA 15W40 (fût)', 'storable', 'Lubrifiants', null, null, true, 'marque (GEG, GPN…) ; contenance du fût ; référence ; prix de vente', 'GNF', true, true),
  ('DIESEL EXTRA 20W50 (fût)', 'storable', 'Lubrifiants', null, null, true, 'marque (GEG, GPN…) ; contenance du fût ; référence ; prix de vente', 'GNF', true, true),
  ('DIESEL PREMIUM 15W40 (fût)', 'storable', 'Lubrifiants', null, null, true, 'marque (GEG, GPN…) ; contenance du fût ; référence ; prix de vente', 'GNF', true, true),
  ('Disque à couper', 'storable', 'Autre', 'Unité', null, true, 'diamètre ; matériau à couper ; marque ; prix de vente', 'GNF', true, true),
  ('Disque à meuler', 'storable', 'Autre', 'Unité', null, true, 'diamètre ; marque ; prix de vente', 'GNF', true, true),
  ('EUROTEC Classicol Diesel 15W-40 CF-4/SG 4 L', 'storable', 'Lubrifiants', '4 L', 'EUROTEC', true, 'référence ; prix de vente', 'GNF', true, true),
  ('EUROTEC Hydraulic Oil HLP 68 20 L', 'storable', 'Lubrifiants', '20 L', 'EUROTEC', true, 'référence ; prix de vente', 'GNF', true, true),
  ('EUROTEC Hydraulic Oil HLP 68 200 L', 'storable', 'Lubrifiants', '200 L', 'EUROTEC', true, 'référence ; prix de vente', 'GNF', true, true),
  ('EUROTEC Monotec HD SAE 50 CF-4/SG 4 L', 'storable', 'Lubrifiants', '4 L', 'EUROTEC', true, 'référence ; prix de vente', 'GNF', true, true),
  ('EUROTEC MotoPrime 4T 20W-50 1 L', 'storable', 'Lubrifiants', '1 L', 'EUROTEC', true, 'référence ; prix de vente', 'GNF', true, true),
  ('Fil à plomb', 'storable', 'Autre', 'Unité', null, true, 'poids ; prix de vente', 'GNF', true, true),
  ('Fil à pointe', 'storable', 'Autre', 'Unité', null, true, 'nature (fil en rouleau ou pointes) ; dimensions ; conditionnement ; prix de vente', 'GNF', true, true),
  ('Filtre à air excavateur primaire et secondaire', 'storable', 'Autre', 'Unité', null, true, 'marque ; référence pièce ; modèle d''engin ; lot ou pièces séparées ; prix de vente', 'GNF', true, true),
  ('Filtre à gasoil', 'storable', 'Autre', 'Unité', null, true, 'engin concerné ; marque ; référence pièce ; prix de vente', 'GNF', true, true),
  ('Filtre séparateur électrique', 'storable', 'Autre', 'Unité', null, true, 'engin concerné ; marque ; référence pièce ; prix de vente', 'GNF', true, true),
  ('Frais de débours', 'service', 'Autre', 'Unité', null, true, 'désignation exacte ; mode de facturation', 'GNF', true, false),
  ('Fret aérien', 'service', 'Autre', 'Unité', null, true, 'désignation exacte', 'GNF', true, false),
  ('Fret maritime conteneur 40 pieds', 'service', 'Autre', 'Unité', null, true, 'désignation exacte ; prix de vente', 'GNF', true, false),
  ('FUCHS RENOLIN CLP 320 200 L', 'storable', 'Lubrifiants', '200 L', 'FUCHS', true, 'référence ; conditionnement exact (200 L d''après les documents) ; prix de vente', 'GNF', true, true),
  ('FUCHS RENOLIN CLP 460 200 L', 'storable', 'Lubrifiants', '200 L', 'FUCHS', true, 'référence ; conditionnement exact (200 L d''après les documents) ; prix de vente', 'GNF', true, true),
  ('Fût', 'storable', 'Autre', 'Unité', null, true, 'contenance ; matière ; neuf ou vide de récupération ; prix de vente', 'GNF', true, true),
  ('GEG ANTIFREEZE SF12+ 200 L', 'storable', 'Autre', '200 L', 'GEG', true, 'référence ; différence avec « GEG LIQUIDE DE REFROIDISSEMENT SF12 » ; prix de vente', 'GNF', true, true),
  ('GEG ATF VI 200 L', 'storable', 'Lubrifiants', '200 L', 'GEG', true, 'référence ; prix de vente', 'GNF', true, true),
  ('GEG Coolant SF12 Premix', 'storable', 'Autre', null, 'GEG', true, 'conditionnement ; différence avec « GEG LIQUIDE DE REFROIDISSEMENT SF12 » ; prix de vente', 'GNF', true, true),
  ('GEG GREASE L EP2 180 kg', 'storable', 'Autre', '180 Kg', 'GEG', true, 'référence ; prix de vente (grade EP2, distinct de la GREASE LITHIUM EP3)', 'GNF', true, true),
  ('GEG REDUCTOR CLP 460 200 L', 'storable', 'Lubrifiants', '200 L', 'GEG', true, 'référence commerciale ; prix de vente', 'GNF', true, true),
  ('GPN DIESEL EXTRA 15W40 20 L', 'storable', 'Lubrifiants', '20 L', 'GPN', true, 'référence ; prix de vente', 'GNF', true, true),
  ('GPN DIESEL EXTRA 15W40 5 L', 'storable', 'Lubrifiants', '5 L', 'GPN', true, 'référence ; prix de vente', 'GNF', true, true),
  ('GPN GREASE EP 2 5 L', 'storable', 'Autre', '5 L', 'GPN', true, 'référence ; prix de vente', 'GNF', true, true),
  ('GPN PREMIUM 10W40 5 L', 'storable', 'Lubrifiants', '5 L', 'GPN', true, 'gamme exacte (PREMIUM ou PREMIUM L) ; référence ; prix de vente', 'GNF', true, true),
  ('GPN PREMIUM 5W30 5 L', 'storable', 'Lubrifiants', '5 L', 'GPN', true, 'référence ; prix de vente', 'GNF', true, true),
  ('GPN PREMIUM 5W40 5 L', 'storable', 'Lubrifiants', '5 L', 'GPN', true, 'référence ; prix de vente', 'GNF', true, true),
  ('Groupe électrogène 10 kVA', 'storable', 'Autre', 'Unité', null, true, 'marque ; modèle ; carburant ; prix de vente', 'GNF', true, true),
  ('HD 50 (fût)', 'storable', 'Lubrifiants', null, null, true, 'marque ; contenance du fût ; référence ; prix de vente', 'GNF', true, true),
  ('HLP 68 (cuve)', 'storable', 'Lubrifiants', null, null, true, 'marque ; volume ; référence ; prix de vente', 'GNF', true, true),
  ('Kit chalumeau sans bouteilles', 'storable', 'Autre', 'Unité', null, true, 'marque ; composition du kit ; prix de vente', 'GNF', true, true),
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
  ('Pneu 205R16C', 'storable', 'Pneus', 'Unité', null, true, 'marque (Continental ou Bridgestone : fiches distinctes) ; modèle ; prix de vente', 'GNF', true, true),
  ('Pneu 245/70R16 LT Double Road', 'storable', 'Pneus', 'Unité', 'Double Road', true, 'modèle exact ; prix de vente', 'GNF', true, true),
  ('Pneu JOYROAD 265/65R17', 'storable', 'Pneus', 'Unité', 'JOYROAD', true, 'modèle exact ; prix de vente', 'GNF', true, true),
  ('Pneu LUXXAN 245/70R17', 'storable', 'Pneus', 'Unité', 'LUXXAN', true, 'modèle exact ; prix de vente', 'GNF', true, true),
  ('Prestation de services', 'service', 'Autre', 'Unité', null, true, 'nature des prestations ; mode de facturation', 'GNF', true, false),
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

-- Contrôle : doit renvoyer 80 et 1
select (select count(*) from geg_guinee.products where to_complete or name = 'Remise commerciale') as guinee,
       (select count(*) from geg_singapore.products where name = 'Fret aérien') as singapour;

commit;
