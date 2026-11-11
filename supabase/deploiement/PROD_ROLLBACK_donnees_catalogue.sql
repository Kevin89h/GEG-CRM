-- PRODUCTION — retour arrière des scripts de données PROD_01 et PROD_02 (à n'utiliser qu'en cas de problème).
-- À EXÉCUTER UNIQUEMENT APRÈS AUTORISATION EXPLICITE, AVANT le retour arrière des migrations.
-- Ne supprime que ce que PROD_01 / PROD_02 ont créé, et seulement si rien ne l'utilise encore :
--   - correspondances au statut « proposé » d'origine automatique (source auto_h4) ;
--   - fiches « À compléter » créées par PROD_01 (et « Remise commerciale »), sans aucune ligne de devis, facture,
--     livraison, stock ni correspondance validée. Une fiche déjà utilisée est conservée et signalée.
-- Les documents historiques ne sont jamais touchés.

begin;

-- the correspondence table refuses deletions (historical_link_rules): lifted only inside this transaction; audit_row keeps tracing
alter table geg_guinee.historical_line_links disable trigger historical_link_rules;
alter table geg_singapore.historical_line_links disable trigger historical_link_rules;
delete from geg_guinee.historical_line_links where source = 'auto_h4' and status = 'proposed';
delete from geg_singapore.historical_line_links where source = 'auto_h4' and status = 'proposed';
alter table geg_guinee.historical_line_links enable trigger historical_link_rules;
alter table geg_singapore.historical_line_links enable trigger historical_link_rules;

-- fiches encore utilisées (à examiner avant toute suppression manuelle)
select p.name, p.product_code,
  (select count(*) from geg_guinee.sales_order_lines l where l.product_id = p.id) lignes_devis,
  (select count(*) from geg_guinee.invoice_lines l where l.product_id = p.id) lignes_factures,
  (select count(*) from geg_guinee.historical_line_links k where k.product_id = p.id) correspondances
from geg_guinee.products p
where ((p.to_complete and p.missing_info is not null) or (p.name = 'Remise commerciale' and p.product_type = 'service'))
  and (exists (select 1 from geg_guinee.sales_order_lines l where l.product_id = p.id)
    or exists (select 1 from geg_guinee.invoice_lines l where l.product_id = p.id)
    or exists (select 1 from geg_guinee.delivery_note_lines l where l.product_id = p.id)
    or exists (select 1 from geg_guinee.stock_moves m where m.product_id = p.id)
    or exists (select 1 from geg_guinee.historical_line_links k where k.product_id = p.id));

delete from geg_guinee.products p
where ((p.to_complete and p.missing_info is not null) or (p.name = 'Remise commerciale' and p.product_type = 'service'))
  and not exists (select 1 from geg_guinee.sales_order_lines l where l.product_id = p.id)
  and not exists (select 1 from geg_guinee.invoice_lines l where l.product_id = p.id)
  and not exists (select 1 from geg_guinee.delivery_note_lines l where l.product_id = p.id)
  and not exists (select 1 from geg_guinee.stock_moves m where m.product_id = p.id)
  and not exists (select 1 from geg_guinee.stock_levels s where s.product_id = p.id)
  and not exists (select 1 from geg_guinee.historical_line_links k where k.product_id = p.id);

commit;
