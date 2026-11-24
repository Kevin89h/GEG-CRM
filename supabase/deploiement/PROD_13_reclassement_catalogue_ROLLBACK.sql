-- Retour arrière de PROD_13 : remet les 8 fiches à leur type d'origine (« marchandise ») et PRD-00045 à sa désignation.
-- Ne touche qu'aux fiches dans l'état exact laissé par PROD_13. Aucune ligne de document n'est modifiée.
begin;
update geg_guinee.products set name = 'Frais de transport'
where product_code = 'PRD-00045' and name = 'Frais de transport (ancienne fiche : utiliser PRD-00032)';
update geg_guinee.products p set product_type = 'storable'
from (values ('PRD-00103', 'Remise 3%', 'discount'), ('PRD-00114', 'DISCOUNT', 'discount'), ('PRD-00162', 'REMISE', 'discount'),
             ('PRD-00045', 'Frais de transport', 'service'), ('PRD-00113', 'FREIGHT', 'service'), ('PRD-00148', 'Transport Maritime', 'service'),
             ('PRD-00287', 'Ajustement des frais de transport', 'service'), ('PRD-00303', 'TRANSPORTATION,MANUTENTION & ACCES FEES', 'service')) as t(code, designation, apres)
where p.product_code = t.code and p.name = t.designation and p.product_type = t.apres;
select product_code, name, product_type from geg_guinee.products
where product_code in ('PRD-00103', 'PRD-00114', 'PRD-00162', 'PRD-00045', 'PRD-00113', 'PRD-00148', 'PRD-00287', 'PRD-00303') order by 1;
commit;
