-- GEG Singapour : vues de calcul des totaux (factures, commandes, factures fournisseurs, trésorerie).
--
-- Constat (12/11/2026) : ces 4 vues existent dans geg_guinee mais pas dans geg_singapore. Toutes les pages
-- qui les lisent (tableau de bord, Ventes, Factures, Devis, Comptabilité, Factures fournisseurs, fiche compte,
-- fiche opportunité) recevaient donc une erreur et affichaient 0 ou une liste vide pour Singapour.
--
-- Principes :
--   * mêmes colonnes et même calcul que les vues Guinée, pour que le code soit identique pour les deux sociétés ;
--   * calcul à partir des LIGNES et des PAIEMENTS. Les colonnes total_ht / total_paid / balance enregistrées
--     dans geg_singapore.invoices (et total_in / total_out dans treasury_accounts, balance dans
--     supplier_invoices) ne sont alimentées par aucun déclencheur et valent 0 : elles ne sont ni lues ni modifiées ;
--   * lecture seule : aucune table, aucun document, montant, paiement ou mouvement de stock n'est modifié ;
--   * security_invoker : les règles d'accès (RLS) de chaque table Singapour s'appliquent à la personne qui lit ;
--   * lecture accordée à authenticated et service_role seulement (pas à anon).

create or replace view geg_singapore.invoice_totals with (security_invoker = true) as
select i.id,
       i.number,
       i.status,
       i.currency,
       i.issue_date,
       i.due_date,
       i.account_id,
       i.order_id,
       i.deal_id,
       coalesce(sum(il.quantity * il.unit_price * (1 - coalesce(il.discount, 0) / 100)), 0) as total_ht,
       coalesce(sum(il.quantity * il.unit_price * (1 - coalesce(il.discount, 0) / 100) * (1 + coalesce(il.tva_rate, 0) / 100)), 0) as total_ttc,
       coalesce((select sum(coalesce(p.amount_in_invoice_currency, p.amount)) from geg_singapore.payments p where p.invoice_id = i.id), 0) as total_paid,
       coalesce(sum(il.quantity * il.unit_price * (1 - coalesce(il.discount, 0) / 100) * (1 + coalesce(il.tva_rate, 0) / 100)), 0)
         - coalesce((select sum(coalesce(p.amount_in_invoice_currency, p.amount)) from geg_singapore.payments p where p.invoice_id = i.id), 0) as balance
from geg_singapore.invoices i
left join geg_singapore.invoice_lines il on il.invoice_id = i.id
group by i.id;

create or replace view geg_singapore.sales_order_totals with (security_invoker = true) as
select o.id,
       o.number,
       o.status,
       o.currency,
       o.account_id,
       o.created_at,
       o.salesperson_id,
       coalesce(sum(l.quantity * l.unit_price * (1 - coalesce(l.discount, 0) / 100)), 0) as total_ht
from geg_singapore.sales_orders o
left join geg_singapore.sales_order_lines l on l.order_id = o.id
group by o.id;

create or replace view geg_singapore.supplier_invoice_totals with (security_invoker = true) as
select si.id,
       si.number,
       si.supplier_name,
       si.status,
       si.currency,
       si.total_ht,
       si.total_ttc,
       si.invoice_date,
       si.due_date,
       coalesce(sum(sp.amount), 0) as total_paid,
       si.total_ttc - coalesce(sum(sp.amount), 0) as balance
from geg_singapore.supplier_invoices si
left join geg_singapore.supplier_payments sp on sp.supplier_invoice_id = si.id
group by si.id;

create or replace view geg_singapore.treasury_balances with (security_invoker = true) as
select a.id,
       a.name,
       a.type,
       a.institution,
       a.account_number,
       a.currency,
       a.color,
       a.is_active,
       a.initial_balance,
       coalesce(sum(case when t.type in ('credit', 'transfer_in') then t.amount else 0 end), 0) as total_in,
       coalesce(sum(case when t.type in ('debit', 'transfer_out') then t.amount else 0 end), 0) as total_out,
       coalesce(a.initial_balance, 0)
         + coalesce(sum(case when t.type in ('credit', 'transfer_in') then t.amount else 0 end), 0)
         - coalesce(sum(case when t.type in ('debit', 'transfer_out') then t.amount else 0 end), 0) as balance
from geg_singapore.treasury_accounts a
left join geg_singapore.treasury_transactions t on t.account_id = a.id
group by a.id;

revoke all on geg_singapore.invoice_totals, geg_singapore.sales_order_totals,
              geg_singapore.supplier_invoice_totals, geg_singapore.treasury_balances from public, anon, authenticated, service_role;
grant select on geg_singapore.invoice_totals, geg_singapore.sales_order_totals,
                geg_singapore.supplier_invoice_totals, geg_singapore.treasury_balances to authenticated, service_role;

notify pgrst, 'reload schema';
