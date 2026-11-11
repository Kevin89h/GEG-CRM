-- DEV ONLY (base de test cpgufjndoiffskxvojzt) — décision GEG du 11/11/2026 (« recommandations OK ») sur les 17 libellés
-- « probables » des lignes libres antérieures : 11 sont le même article qu'une fiche existante (correspondance proposée,
-- aucune nouvelle fiche) ; les 6 ci-dessous diffèrent réellement et reçoivent une fiche distinte « À compléter ».
-- La ligne « 15 » (devis DEV-2026-07-0010) est exclue comme une ligne vide.
-- Seules les informations présentes dans les libellés sont reprises. NE PAS EXÉCUTER EN PRODUCTION sans validation.

begin;

with p(name, ptype, cat, unit, brand, missing) as (values
  ('15W40 (à identifier)',              'storable', 'Lubrifiants', null,     null,  'désignation (gamme) ; marque ; conditionnement ; référence ; prix de vente (libellé d''origine « 15w40 »)'),
  ('DIESEL EXTRA 15W40 (cuve)',          'storable', 'Lubrifiants', null,     null,  'marque (GEG, GPN…) ; volume ; référence ; prix de vente'),
  ('DIESEL EXTRA 15W40 (fût)',           'storable', 'Lubrifiants', null,     null,  'marque (GEG, GPN…) ; contenance du fût ; référence ; prix de vente'),
  ('DIESEL PREMIUM 15W40 (fût)',         'storable', 'Lubrifiants', null,     null,  'marque (GEG, GPN…) ; contenance du fût ; référence ; prix de vente'),
  ('GEG GREASE L EP2 180 kg',            'storable', 'Autre',       '180 Kg', 'GEG', 'référence ; prix de vente (grade EP2, distinct de la GREASE LITHIUM EP3)'),
  ('GPN PREMIUM 5W40 5 L',               'storable', 'Lubrifiants', '5 L',    'GPN', 'référence ; prix de vente')
), base as (
  select coalesce(max(substring(product_code from 5)::int), 0) n from geg_guinee.products where product_code ~ '^PRD-[0-9]+$'
), todo as (
  select p.*, row_number() over (order by p.name) rn from p
  where not exists (select 1 from geg_guinee.products x where lower(x.name) = lower(p.name))
)
insert into geg_guinee.products (name, product_type, category_id, unit_id, brand, is_active, to_complete, missing_info, currency, can_be_sold, can_be_purchased, product_code)
select t.name, t.ptype,
  (select id from geg_guinee.product_categories c where c.name = t.cat order by c.name limit 1),
  (select id from geg_guinee.units u where u.name = t.unit order by u.name limit 1),
  t.brand, true, true, t.missing, 'GNF', true, true,
  'PRD-' || lpad((base.n + t.rn)::text, 5, '0')
from todo t, base;

commit;
