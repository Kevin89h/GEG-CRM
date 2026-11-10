-- DEV ONLY (base de test cpgufjndoiffskxvojzt) — décision H4, étape 2 (10/11/2026).
-- Fiches produits PROPOSÉES à partir des lignes libres historiques (catégorie 2 du rapprochement).
-- Inactives tant qu'elles ne sont pas validées ; aucune référence, aucun prix inventés ;
-- les champs à confirmer sont indiqués dans la description. NE PAS EXÉCUTER EN PRODUCTION sans validation.

begin;

with p(name, ptype, cat, unit, confirmer) as (values
  ('Fret aérien',                       'service',  'Autre',       'Unité', 'désignation exacte'),
  ('Remise commerciale',                'service',  'Autre',       'Unité', 'usage : ligne à montant négatif pour les remises et gestes commerciaux'),
  ('GEG REDUCTOR CLP 460 200 L',        'storable', 'Lubrifiants', '200 L', 'référence commerciale'),
  ('FUCHS RENOLIN CLP 320 200 L',       'storable', 'Lubrifiants', '200 L', 'référence, conditionnement exact'),
  ('FUCHS RENOLIN CLP 460 200 L',       'storable', 'Lubrifiants', '200 L', 'référence, conditionnement exact'),
  ('PETRONAS GEAR FL 220 200 L',        'storable', 'Lubrifiants', '200 L', 'référence, conditionnement exact'),
  ('PETRONAS GEAR FL 320 200 L',        'storable', 'Lubrifiants', '200 L', 'référence, conditionnement exact'),
  ('SHELL 20W50 200 L',                 'storable', 'Lubrifiants', '200 L', 'gamme Shell exacte (Rimula, Helix…), référence'),
  ('TOTAL CARTER XEP 320',              'storable', 'Lubrifiants', null,    'conditionnement 200 L ou 205 L, référence'),
  ('Pneu 11R22.5 Double Road',          'storable', 'Pneus',       'Unité', 'modèle exact'),
  ('Pneu 12R22.5 Triangle',             'storable', 'Pneus',       'Unité', 'modèle exact'),
  ('Pneu 245/70R16 LT Double Road',     'storable', 'Pneus',       'Unité', 'modèle exact'),
  ('Groupe électrogène 10 kVA',         'storable', 'Autre',       'Unité', 'marque, modèle, carburant'),
  ('Scie électrique 1600 W',            'storable', 'Autre',       'Unité', 'marque, modèle'),
  ('Scie électrique 2200 W',            'storable', 'Autre',       'Unité', 'marque, modèle'),
  ('Marteau 1 kg',                      'storable', 'Autre',       'Unité', 'marque'),
  ('Marteau 2 kg',                      'storable', 'Autre',       'Unité', 'marque'),
  ('Marteau 5 kg',                      'storable', 'Autre',       'Unité', 'marque'),
  ('Décamètre 30 m',                    'storable', 'Autre',       'Unité', 'marque'),
  ('Mètre ruban 5 m',                   'storable', 'Autre',       'Unité', 'libellé d''origine « Centimètre 5m »'),
  ('Rallonge électrique 50 m',          'storable', 'Autre',       'Unité', 'section du câble'),
  ('Sonnerie de marche arrière',        'storable', 'Autre',       'Unité', 'tension 12 V ou 24 V'),
  ('Corde de maçon',                    'storable', 'Autre',       'Unité', 'longueur'),
  ('Seau de maçon',                     'storable', 'Autre',       'Unité', 'contenance'),
  ('Fil à plomb',                       'storable', 'Autre',       'Unité', 'poids'),
  ('Niveau à bulle',                    'storable', 'Autre',       'Unité', 'longueur ; libellé d''origine « Niveau d''eau »')
)
insert into geg_guinee.products (name, product_type, category_id, unit_id, description, is_active, currency, can_be_sold, can_be_purchased)
select p.name, p.ptype,
  (select id from geg_guinee.product_categories c where c.name = p.cat limit 1),
  (select id from geg_guinee.units u where u.name like replace(p.unit, 'é', '_') limit 1),
  '[Proposition H4 – à valider] Créée depuis les lignes libres historiques. À confirmer : ' || p.confirmer || '.',
  false, 'GNF', true, p.ptype <> 'service'
from p
where not exists (select 1 from geg_guinee.products x where x.name = p.name);

commit;
