-- DEV ONLY (base de test cpgufjndoiffskxvojzt) — décision GEG du 11/11/2026 : un seul service générique de transport.
-- « FRAIS DE TRANSPORT » (service correct, existant dans les deux sociétés) couvre transport routier, maritime et aérien.
-- Le mode, la destination, la taille du conteneur… vont dans la description de la ligne (imprimée sur le PDF).
--   1. Les correspondances PROPOSÉES vers « Fret aérien », « Fret maritime conteneur 40 pieds » ou « Transport Maritime »
--      sont annulées (motif conservé) et reproposées vers « FRAIS DE TRANSPORT », libellé d'origine en commentaire.
--   2. Les trois services de fret créés UNIQUEMENT sur Dev lors des rapprochements (jamais en production) sont retirés :
--      désactivés, avec la mention « Retiré », et exclus des scripts de production.
-- Les fiches existantes du catalogue (y compris « Transport Maritime », « Frais de transport » 1 L, « FREIGHT ») ne sont
-- ni modifiées ni désactivées. Aucun document historique modifié. NE PAS EXÉCUTER EN PRODUCTION.

begin;

-- 1. GEG Guinée
with old as (
  select k.id, k.line_table, k.line_id,
    coalesce((select description from geg_guinee.invoice_lines where id = k.line_id), (select description from geg_guinee.sales_order_lines where id = k.line_id)) label
  from geg_guinee.historical_line_links k join geg_guinee.products p on p.id = k.product_id
  where k.status = 'proposed' and p.name in ('Fret aérien', 'Fret maritime conteneur 40 pieds', 'Transport Maritime')
), cancelled as (
  update geg_guinee.historical_line_links k set status = 'cancelled', cancelled_at = now(),
    cancel_reason = 'Redirigée vers le service unique « FRAIS DE TRANSPORT » (décision GEG du 11/11/2026)'
  from old where k.id = old.id returning old.line_table, old.line_id, old.label
)
insert into geg_guinee.historical_line_links (line_table, line_id, product_id, status, source, note)
select c.line_table, c.line_id, (select id from geg_guinee.products where name = 'FRAIS DE TRANSPORT' and product_type = 'service' and is_active), 'proposed', 'auto_h4',
  'Service générique de transport ; libellé d''origine : ' || coalesce(trim(c.label), '')
from cancelled c;

-- 1 bis. GEG Singapour
with old as (
  select k.id, k.line_table, k.line_id, (select description from geg_singapore.invoice_lines where id = k.line_id) label
  from geg_singapore.historical_line_links k join geg_singapore.products p on p.id = k.product_id
  where k.status = 'proposed' and p.name = 'Fret aérien'
), cancelled as (
  update geg_singapore.historical_line_links k set status = 'cancelled', cancelled_at = now(),
    cancel_reason = 'Redirigée vers le service unique « FRAIS DE TRANSPORT » (décision GEG du 11/11/2026)'
  from old where k.id = old.id returning old.line_table, old.line_id, old.label
)
insert into geg_singapore.historical_line_links (line_table, line_id, product_id, status, source, note)
select c.line_table, c.line_id, (select id from geg_singapore.products where name = 'FRAIS DE TRANSPORT' and product_type = 'service' and is_active), 'proposed', 'auto_h4',
  'Service générique de transport ; libellé d''origine : ' || coalesce(trim(c.label), '')
from cancelled c;

-- 2. Dev-only freight services withdrawn (created by the reconciliation scripts on Dev, never in production)
update geg_guinee.products set is_active = false, to_complete = false,
  description = '[Retiré — décision GEG du 11/11/2026 : service unique « FRAIS DE TRANSPORT »]'
where name in ('Fret aérien', 'Fret maritime conteneur 40 pieds') and product_code in (select product_code from geg_guinee.products where missing_info is not null);
update geg_singapore.products set is_active = false, to_complete = false,
  description = '[Retiré — décision GEG du 11/11/2026 : service unique « FRAIS DE TRANSPORT »]'
where name = 'Fret aérien' and missing_info is not null;

commit;
