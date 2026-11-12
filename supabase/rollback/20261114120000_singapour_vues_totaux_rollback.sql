-- Retour arrière de 20261114120000_singapour_vues_totaux : supprime les 4 vues de calcul Singapour.
-- Aucune donnée n'est perdue (ce sont des vues de lecture) ; les pages Singapour reviennent à l'état précédent.
drop view if exists geg_singapore.invoice_totals;
drop view if exists geg_singapore.sales_order_totals;
drop view if exists geg_singapore.supplier_invoice_totals;
drop view if exists geg_singapore.treasury_balances;
notify pgrst, 'reload schema';
