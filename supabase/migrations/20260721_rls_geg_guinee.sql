-- ============================================================
-- Row Level Security — geg_guinee schema
-- All authenticated users can read and write company data.
-- Only admin / manager can delete.
-- Service-role key (createAdminClient) bypasses RLS entirely.
-- ============================================================

-- Helper: is the current user an admin or manager?
create or replace function geg_guinee.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager')
  )
$$;

-- ─── Macro: enable RLS + standard CRUD policies ──────────────────────────────
-- We define one block per table. Pattern:
--   SELECT / INSERT / UPDATE  → any authenticated user
--   DELETE                    → admin or manager only

-- accounts
alter table geg_guinee.accounts enable row level security;
drop policy if exists "guinee_accounts_select" on geg_guinee.accounts;
drop policy if exists "guinee_accounts_insert" on geg_guinee.accounts;
drop policy if exists "guinee_accounts_update" on geg_guinee.accounts;
drop policy if exists "guinee_accounts_delete" on geg_guinee.accounts;
create policy "guinee_accounts_select" on geg_guinee.accounts for select using (auth.uid() is not null);
create policy "guinee_accounts_insert" on geg_guinee.accounts for insert with check (auth.uid() is not null);
create policy "guinee_accounts_update" on geg_guinee.accounts for update using (auth.uid() is not null);
create policy "guinee_accounts_delete" on geg_guinee.accounts for delete using (geg_guinee.is_admin_or_manager());

-- deals
alter table geg_guinee.deals enable row level security;
drop policy if exists "guinee_deals_select" on geg_guinee.deals;
drop policy if exists "guinee_deals_insert" on geg_guinee.deals;
drop policy if exists "guinee_deals_update" on geg_guinee.deals;
drop policy if exists "guinee_deals_delete" on geg_guinee.deals;
create policy "guinee_deals_select" on geg_guinee.deals for select using (auth.uid() is not null);
create policy "guinee_deals_insert" on geg_guinee.deals for insert with check (auth.uid() is not null);
create policy "guinee_deals_update" on geg_guinee.deals for update using (auth.uid() is not null);
create policy "guinee_deals_delete" on geg_guinee.deals for delete using (geg_guinee.is_admin_or_manager());

-- contacts
alter table geg_guinee.contacts enable row level security;
drop policy if exists "guinee_contacts_select" on geg_guinee.contacts;
drop policy if exists "guinee_contacts_insert" on geg_guinee.contacts;
drop policy if exists "guinee_contacts_update" on geg_guinee.contacts;
drop policy if exists "guinee_contacts_delete" on geg_guinee.contacts;
create policy "guinee_contacts_select" on geg_guinee.contacts for select using (auth.uid() is not null);
create policy "guinee_contacts_insert" on geg_guinee.contacts for insert with check (auth.uid() is not null);
create policy "guinee_contacts_update" on geg_guinee.contacts for update using (auth.uid() is not null);
create policy "guinee_contacts_delete" on geg_guinee.contacts for delete using (geg_guinee.is_admin_or_manager());

-- products
alter table geg_guinee.products enable row level security;
drop policy if exists "guinee_products_select" on geg_guinee.products;
drop policy if exists "guinee_products_insert" on geg_guinee.products;
drop policy if exists "guinee_products_update" on geg_guinee.products;
drop policy if exists "guinee_products_delete" on geg_guinee.products;
create policy "guinee_products_select" on geg_guinee.products for select using (auth.uid() is not null);
create policy "guinee_products_insert" on geg_guinee.products for insert with check (auth.uid() is not null);
create policy "guinee_products_update" on geg_guinee.products for update using (auth.uid() is not null);
create policy "guinee_products_delete" on geg_guinee.products for delete using (geg_guinee.is_admin_or_manager());

-- invoices (ventes)
alter table geg_guinee.invoices enable row level security;
drop policy if exists "guinee_invoices_select" on geg_guinee.invoices;
drop policy if exists "guinee_invoices_insert" on geg_guinee.invoices;
drop policy if exists "guinee_invoices_update" on geg_guinee.invoices;
drop policy if exists "guinee_invoices_delete" on geg_guinee.invoices;
create policy "guinee_invoices_select" on geg_guinee.invoices for select using (auth.uid() is not null);
create policy "guinee_invoices_insert" on geg_guinee.invoices for insert with check (auth.uid() is not null);
create policy "guinee_invoices_update" on geg_guinee.invoices for update using (auth.uid() is not null);
create policy "guinee_invoices_delete" on geg_guinee.invoices for delete using (geg_guinee.is_admin_or_manager());

-- invoice_lines
alter table geg_guinee.invoice_lines enable row level security;
drop policy if exists "guinee_invoice_lines_select" on geg_guinee.invoice_lines;
drop policy if exists "guinee_invoice_lines_insert" on geg_guinee.invoice_lines;
drop policy if exists "guinee_invoice_lines_update" on geg_guinee.invoice_lines;
drop policy if exists "guinee_invoice_lines_delete" on geg_guinee.invoice_lines;
create policy "guinee_invoice_lines_select" on geg_guinee.invoice_lines for select using (auth.uid() is not null);
create policy "guinee_invoice_lines_insert" on geg_guinee.invoice_lines for insert with check (auth.uid() is not null);
create policy "guinee_invoice_lines_update" on geg_guinee.invoice_lines for update using (auth.uid() is not null);
create policy "guinee_invoice_lines_delete" on geg_guinee.invoice_lines for delete using (geg_guinee.is_admin_or_manager());

-- payments (invoice payments / ventes)
alter table geg_guinee.payments enable row level security;
drop policy if exists "guinee_payments_select" on geg_guinee.payments;
drop policy if exists "guinee_payments_insert" on geg_guinee.payments;
drop policy if exists "guinee_payments_update" on geg_guinee.payments;
drop policy if exists "guinee_payments_delete" on geg_guinee.payments;
create policy "guinee_payments_select" on geg_guinee.payments for select using (auth.uid() is not null);
create policy "guinee_payments_insert" on geg_guinee.payments for insert with check (auth.uid() is not null);
create policy "guinee_payments_update" on geg_guinee.payments for update using (auth.uid() is not null);
create policy "guinee_payments_delete" on geg_guinee.payments for delete using (geg_guinee.is_admin_or_manager());

-- supplier_invoices
alter table geg_guinee.supplier_invoices enable row level security;
drop policy if exists "guinee_supplier_invoices_select" on geg_guinee.supplier_invoices;
drop policy if exists "guinee_supplier_invoices_insert" on geg_guinee.supplier_invoices;
drop policy if exists "guinee_supplier_invoices_update" on geg_guinee.supplier_invoices;
drop policy if exists "guinee_supplier_invoices_delete" on geg_guinee.supplier_invoices;
create policy "guinee_supplier_invoices_select" on geg_guinee.supplier_invoices for select using (auth.uid() is not null);
create policy "guinee_supplier_invoices_insert" on geg_guinee.supplier_invoices for insert with check (auth.uid() is not null);
create policy "guinee_supplier_invoices_update" on geg_guinee.supplier_invoices for update using (auth.uid() is not null);
create policy "guinee_supplier_invoices_delete" on geg_guinee.supplier_invoices for delete using (geg_guinee.is_admin_or_manager());

-- supplier_invoice_lines
alter table geg_guinee.supplier_invoice_lines enable row level security;
drop policy if exists "guinee_supplier_invoice_lines_select" on geg_guinee.supplier_invoice_lines;
drop policy if exists "guinee_supplier_invoice_lines_insert" on geg_guinee.supplier_invoice_lines;
drop policy if exists "guinee_supplier_invoice_lines_update" on geg_guinee.supplier_invoice_lines;
drop policy if exists "guinee_supplier_invoice_lines_delete" on geg_guinee.supplier_invoice_lines;
create policy "guinee_supplier_invoice_lines_select" on geg_guinee.supplier_invoice_lines for select using (auth.uid() is not null);
create policy "guinee_supplier_invoice_lines_insert" on geg_guinee.supplier_invoice_lines for insert with check (auth.uid() is not null);
create policy "guinee_supplier_invoice_lines_update" on geg_guinee.supplier_invoice_lines for update using (auth.uid() is not null);
create policy "guinee_supplier_invoice_lines_delete" on geg_guinee.supplier_invoice_lines for delete using (geg_guinee.is_admin_or_manager());

-- supplier_payments
alter table geg_guinee.supplier_payments enable row level security;
drop policy if exists "guinee_supplier_payments_select" on geg_guinee.supplier_payments;
drop policy if exists "guinee_supplier_payments_insert" on geg_guinee.supplier_payments;
drop policy if exists "guinee_supplier_payments_update" on geg_guinee.supplier_payments;
drop policy if exists "guinee_supplier_payments_delete" on geg_guinee.supplier_payments;
create policy "guinee_supplier_payments_select" on geg_guinee.supplier_payments for select using (auth.uid() is not null);
create policy "guinee_supplier_payments_insert" on geg_guinee.supplier_payments for insert with check (auth.uid() is not null);
create policy "guinee_supplier_payments_update" on geg_guinee.supplier_payments for update using (auth.uid() is not null);
create policy "guinee_supplier_payments_delete" on geg_guinee.supplier_payments for delete using (geg_guinee.is_admin_or_manager());

-- treasury_accounts
alter table geg_guinee.treasury_accounts enable row level security;
drop policy if exists "guinee_treasury_accounts_select" on geg_guinee.treasury_accounts;
drop policy if exists "guinee_treasury_accounts_insert" on geg_guinee.treasury_accounts;
drop policy if exists "guinee_treasury_accounts_update" on geg_guinee.treasury_accounts;
drop policy if exists "guinee_treasury_accounts_delete" on geg_guinee.treasury_accounts;
create policy "guinee_treasury_accounts_select" on geg_guinee.treasury_accounts for select using (auth.uid() is not null);
create policy "guinee_treasury_accounts_insert" on geg_guinee.treasury_accounts for insert with check (geg_guinee.is_admin_or_manager());
create policy "guinee_treasury_accounts_update" on geg_guinee.treasury_accounts for update using (geg_guinee.is_admin_or_manager());
create policy "guinee_treasury_accounts_delete" on geg_guinee.treasury_accounts for delete using (geg_guinee.is_admin_or_manager());

-- treasury_transactions
alter table geg_guinee.treasury_transactions enable row level security;
drop policy if exists "guinee_treasury_tx_select" on geg_guinee.treasury_transactions;
drop policy if exists "guinee_treasury_tx_insert" on geg_guinee.treasury_transactions;
drop policy if exists "guinee_treasury_tx_update" on geg_guinee.treasury_transactions;
drop policy if exists "guinee_treasury_tx_delete" on geg_guinee.treasury_transactions;
create policy "guinee_treasury_tx_select" on geg_guinee.treasury_transactions for select using (auth.uid() is not null);
create policy "guinee_treasury_tx_insert" on geg_guinee.treasury_transactions for insert with check (auth.uid() is not null);
create policy "guinee_treasury_tx_update" on geg_guinee.treasury_transactions for update using (geg_guinee.is_admin_or_manager());
create policy "guinee_treasury_tx_delete" on geg_guinee.treasury_transactions for delete using (geg_guinee.is_admin_or_manager());

-- purchase_orders
alter table geg_guinee.purchase_orders enable row level security;
drop policy if exists "guinee_po_select" on geg_guinee.purchase_orders;
drop policy if exists "guinee_po_insert" on geg_guinee.purchase_orders;
drop policy if exists "guinee_po_update" on geg_guinee.purchase_orders;
drop policy if exists "guinee_po_delete" on geg_guinee.purchase_orders;
create policy "guinee_po_select" on geg_guinee.purchase_orders for select using (auth.uid() is not null);
create policy "guinee_po_insert" on geg_guinee.purchase_orders for insert with check (auth.uid() is not null);
create policy "guinee_po_update" on geg_guinee.purchase_orders for update using (auth.uid() is not null);
create policy "guinee_po_delete" on geg_guinee.purchase_orders for delete using (geg_guinee.is_admin_or_manager());

-- purchase_order_lines
alter table geg_guinee.purchase_order_lines enable row level security;
drop policy if exists "guinee_po_lines_select" on geg_guinee.purchase_order_lines;
drop policy if exists "guinee_po_lines_insert" on geg_guinee.purchase_order_lines;
drop policy if exists "guinee_po_lines_update" on geg_guinee.purchase_order_lines;
drop policy if exists "guinee_po_lines_delete" on geg_guinee.purchase_order_lines;
create policy "guinee_po_lines_select" on geg_guinee.purchase_order_lines for select using (auth.uid() is not null);
create policy "guinee_po_lines_insert" on geg_guinee.purchase_order_lines for insert with check (auth.uid() is not null);
create policy "guinee_po_lines_update" on geg_guinee.purchase_order_lines for update using (auth.uid() is not null);
create policy "guinee_po_lines_delete" on geg_guinee.purchase_order_lines for delete using (geg_guinee.is_admin_or_manager());

-- purchase_receptions
alter table geg_guinee.purchase_receptions enable row level security;
drop policy if exists "guinee_receptions_select" on geg_guinee.purchase_receptions;
drop policy if exists "guinee_receptions_insert" on geg_guinee.purchase_receptions;
drop policy if exists "guinee_receptions_update" on geg_guinee.purchase_receptions;
drop policy if exists "guinee_receptions_delete" on geg_guinee.purchase_receptions;
create policy "guinee_receptions_select" on geg_guinee.purchase_receptions for select using (auth.uid() is not null);
create policy "guinee_receptions_insert" on geg_guinee.purchase_receptions for insert with check (auth.uid() is not null);
create policy "guinee_receptions_update" on geg_guinee.purchase_receptions for update using (auth.uid() is not null);
create policy "guinee_receptions_delete" on geg_guinee.purchase_receptions for delete using (geg_guinee.is_admin_or_manager());

-- purchase_reception_lines
alter table geg_guinee.purchase_reception_lines enable row level security;
drop policy if exists "guinee_reception_lines_select" on geg_guinee.purchase_reception_lines;
drop policy if exists "guinee_reception_lines_insert" on geg_guinee.purchase_reception_lines;
drop policy if exists "guinee_reception_lines_update" on geg_guinee.purchase_reception_lines;
drop policy if exists "guinee_reception_lines_delete" on geg_guinee.purchase_reception_lines;
create policy "guinee_reception_lines_select" on geg_guinee.purchase_reception_lines for select using (auth.uid() is not null);
create policy "guinee_reception_lines_insert" on geg_guinee.purchase_reception_lines for insert with check (auth.uid() is not null);
create policy "guinee_reception_lines_update" on geg_guinee.purchase_reception_lines for update using (auth.uid() is not null);
create policy "guinee_reception_lines_delete" on geg_guinee.purchase_reception_lines for delete using (geg_guinee.is_admin_or_manager());

-- sales_orders
alter table geg_guinee.sales_orders enable row level security;
drop policy if exists "guinee_so_select" on geg_guinee.sales_orders;
drop policy if exists "guinee_so_insert" on geg_guinee.sales_orders;
drop policy if exists "guinee_so_update" on geg_guinee.sales_orders;
drop policy if exists "guinee_so_delete" on geg_guinee.sales_orders;
create policy "guinee_so_select" on geg_guinee.sales_orders for select using (auth.uid() is not null);
create policy "guinee_so_insert" on geg_guinee.sales_orders for insert with check (auth.uid() is not null);
create policy "guinee_so_update" on geg_guinee.sales_orders for update using (auth.uid() is not null);
create policy "guinee_so_delete" on geg_guinee.sales_orders for delete using (geg_guinee.is_admin_or_manager());

-- sales_order_lines
alter table geg_guinee.sales_order_lines enable row level security;
drop policy if exists "guinee_so_lines_select" on geg_guinee.sales_order_lines;
drop policy if exists "guinee_so_lines_insert" on geg_guinee.sales_order_lines;
drop policy if exists "guinee_so_lines_update" on geg_guinee.sales_order_lines;
drop policy if exists "guinee_so_lines_delete" on geg_guinee.sales_order_lines;
create policy "guinee_so_lines_select" on geg_guinee.sales_order_lines for select using (auth.uid() is not null);
create policy "guinee_so_lines_insert" on geg_guinee.sales_order_lines for insert with check (auth.uid() is not null);
create policy "guinee_so_lines_update" on geg_guinee.sales_order_lines for update using (auth.uid() is not null);
create policy "guinee_so_lines_delete" on geg_guinee.sales_order_lines for delete using (geg_guinee.is_admin_or_manager());

-- stock_moves
alter table geg_guinee.stock_moves enable row level security;
drop policy if exists "guinee_stock_moves_select" on geg_guinee.stock_moves;
drop policy if exists "guinee_stock_moves_insert" on geg_guinee.stock_moves;
drop policy if exists "guinee_stock_moves_delete" on geg_guinee.stock_moves;
create policy "guinee_stock_moves_select" on geg_guinee.stock_moves for select using (auth.uid() is not null);
create policy "guinee_stock_moves_insert" on geg_guinee.stock_moves for insert with check (auth.uid() is not null);
create policy "guinee_stock_moves_delete" on geg_guinee.stock_moves for delete using (geg_guinee.is_admin_or_manager());

-- stock_levels
alter table geg_guinee.stock_levels enable row level security;
drop policy if exists "guinee_stock_levels_select" on geg_guinee.stock_levels;
drop policy if exists "guinee_stock_levels_all" on geg_guinee.stock_levels;
create policy "guinee_stock_levels_select" on geg_guinee.stock_levels for select using (auth.uid() is not null);
create policy "guinee_stock_levels_all" on geg_guinee.stock_levels for all using (auth.uid() is not null);

-- delivery_notes
alter table geg_guinee.delivery_notes enable row level security;
drop policy if exists "guinee_dn_select" on geg_guinee.delivery_notes;
drop policy if exists "guinee_dn_insert" on geg_guinee.delivery_notes;
drop policy if exists "guinee_dn_update" on geg_guinee.delivery_notes;
drop policy if exists "guinee_dn_delete" on geg_guinee.delivery_notes;
create policy "guinee_dn_select" on geg_guinee.delivery_notes for select using (auth.uid() is not null);
create policy "guinee_dn_insert" on geg_guinee.delivery_notes for insert with check (auth.uid() is not null);
create policy "guinee_dn_update" on geg_guinee.delivery_notes for update using (auth.uid() is not null);
create policy "guinee_dn_delete" on geg_guinee.delivery_notes for delete using (geg_guinee.is_admin_or_manager());

-- delivery_note_lines
alter table geg_guinee.delivery_note_lines enable row level security;
drop policy if exists "guinee_dn_lines_select" on geg_guinee.delivery_note_lines;
drop policy if exists "guinee_dn_lines_insert" on geg_guinee.delivery_note_lines;
drop policy if exists "guinee_dn_lines_update" on geg_guinee.delivery_note_lines;
drop policy if exists "guinee_dn_lines_delete" on geg_guinee.delivery_note_lines;
create policy "guinee_dn_lines_select" on geg_guinee.delivery_note_lines for select using (auth.uid() is not null);
create policy "guinee_dn_lines_insert" on geg_guinee.delivery_note_lines for insert with check (auth.uid() is not null);
create policy "guinee_dn_lines_update" on geg_guinee.delivery_note_lines for update using (auth.uid() is not null);
create policy "guinee_dn_lines_delete" on geg_guinee.delivery_note_lines for delete using (geg_guinee.is_admin_or_manager());

-- shipments
alter table geg_guinee.shipments enable row level security;
drop policy if exists "guinee_shipments_select" on geg_guinee.shipments;
drop policy if exists "guinee_shipments_insert" on geg_guinee.shipments;
drop policy if exists "guinee_shipments_update" on geg_guinee.shipments;
drop policy if exists "guinee_shipments_delete" on geg_guinee.shipments;
create policy "guinee_shipments_select" on geg_guinee.shipments for select using (auth.uid() is not null);
create policy "guinee_shipments_insert" on geg_guinee.shipments for insert with check (auth.uid() is not null);
create policy "guinee_shipments_update" on geg_guinee.shipments for update using (auth.uid() is not null);
create policy "guinee_shipments_delete" on geg_guinee.shipments for delete using (geg_guinee.is_admin_or_manager());

-- employees
alter table geg_guinee.employees enable row level security;
drop policy if exists "guinee_employees_select" on geg_guinee.employees;
drop policy if exists "guinee_employees_insert" on geg_guinee.employees;
drop policy if exists "guinee_employees_update" on geg_guinee.employees;
drop policy if exists "guinee_employees_delete" on geg_guinee.employees;
create policy "guinee_employees_select" on geg_guinee.employees for select using (auth.uid() is not null);
create policy "guinee_employees_insert" on geg_guinee.employees for insert with check (geg_guinee.is_admin_or_manager());
create policy "guinee_employees_update" on geg_guinee.employees for update using (geg_guinee.is_admin_or_manager());
create policy "guinee_employees_delete" on geg_guinee.employees for delete using (geg_guinee.is_admin_or_manager());

-- commissions
alter table geg_guinee.commissions enable row level security;
drop policy if exists "guinee_commissions_select" on geg_guinee.commissions;
drop policy if exists "guinee_commissions_insert" on geg_guinee.commissions;
drop policy if exists "guinee_commissions_update" on geg_guinee.commissions;
drop policy if exists "guinee_commissions_delete" on geg_guinee.commissions;
create policy "guinee_commissions_select" on geg_guinee.commissions for select using (auth.uid() is not null);
create policy "guinee_commissions_insert" on geg_guinee.commissions for insert with check (auth.uid() is not null);
create policy "guinee_commissions_update" on geg_guinee.commissions for update using (geg_guinee.is_admin_or_manager());
create policy "guinee_commissions_delete" on geg_guinee.commissions for delete using (geg_guinee.is_admin_or_manager());

-- exchange_rates
alter table geg_guinee.exchange_rates enable row level security;
drop policy if exists "guinee_fx_select" on geg_guinee.exchange_rates;
drop policy if exists "guinee_fx_insert" on geg_guinee.exchange_rates;
drop policy if exists "guinee_fx_update" on geg_guinee.exchange_rates;
drop policy if exists "guinee_fx_delete" on geg_guinee.exchange_rates;
create policy "guinee_fx_select" on geg_guinee.exchange_rates for select using (auth.uid() is not null);
create policy "guinee_fx_insert" on geg_guinee.exchange_rates for insert with check (geg_guinee.is_admin_or_manager());
create policy "guinee_fx_update" on geg_guinee.exchange_rates for update using (geg_guinee.is_admin_or_manager());
create policy "guinee_fx_delete" on geg_guinee.exchange_rates for delete using (geg_guinee.is_admin_or_manager());

-- chat_rooms
alter table geg_guinee.chat_rooms enable row level security;
drop policy if exists "guinee_chat_rooms_select" on geg_guinee.chat_rooms;
drop policy if exists "guinee_chat_rooms_insert" on geg_guinee.chat_rooms;
drop policy if exists "guinee_chat_rooms_update" on geg_guinee.chat_rooms;
create policy "guinee_chat_rooms_select" on geg_guinee.chat_rooms for select using (auth.uid() is not null);
create policy "guinee_chat_rooms_insert" on geg_guinee.chat_rooms for insert with check (auth.uid() is not null);
create policy "guinee_chat_rooms_update" on geg_guinee.chat_rooms for update using (auth.uid() is not null);

-- chat_messages
alter table geg_guinee.chat_messages enable row level security;
drop policy if exists "guinee_chat_messages_select" on geg_guinee.chat_messages;
drop policy if exists "guinee_chat_messages_insert" on geg_guinee.chat_messages;
drop policy if exists "guinee_chat_messages_delete" on geg_guinee.chat_messages;
create policy "guinee_chat_messages_select" on geg_guinee.chat_messages for select using (auth.uid() is not null);
create policy "guinee_chat_messages_insert" on geg_guinee.chat_messages for insert with check (auth.uid() is not null);
create policy "guinee_chat_messages_delete" on geg_guinee.chat_messages for delete using (auth.uid() is not null);

-- chat_read_receipts
alter table geg_guinee.chat_read_receipts enable row level security;
drop policy if exists "guinee_read_receipts_select" on geg_guinee.chat_read_receipts;
drop policy if exists "guinee_read_receipts_insert" on geg_guinee.chat_read_receipts;
drop policy if exists "guinee_read_receipts_update" on geg_guinee.chat_read_receipts;
create policy "guinee_read_receipts_select" on geg_guinee.chat_read_receipts for select using (auth.uid() is not null);
create policy "guinee_read_receipts_insert" on geg_guinee.chat_read_receipts for insert with check (auth.uid() is not null);
create policy "guinee_read_receipts_update" on geg_guinee.chat_read_receipts for update using (auth.uid() is not null);

-- documents / document_settings / document_tokens (read-only for all, write for admin)
alter table geg_guinee.documents enable row level security;
drop policy if exists "guinee_documents_select" on geg_guinee.documents;
drop policy if exists "guinee_documents_insert" on geg_guinee.documents;
drop policy if exists "guinee_documents_update" on geg_guinee.documents;
drop policy if exists "guinee_documents_delete" on geg_guinee.documents;
create policy "guinee_documents_select" on geg_guinee.documents for select using (auth.uid() is not null);
create policy "guinee_documents_insert" on geg_guinee.documents for insert with check (auth.uid() is not null);
create policy "guinee_documents_update" on geg_guinee.documents for update using (auth.uid() is not null);
create policy "guinee_documents_delete" on geg_guinee.documents for delete using (geg_guinee.is_admin_or_manager());

-- activity_logs (append-only for all authenticated, no delete for non-admin)
alter table geg_guinee.activity_logs enable row level security;
drop policy if exists "guinee_activity_logs_select" on geg_guinee.activity_logs;
drop policy if exists "guinee_activity_logs_insert" on geg_guinee.activity_logs;
drop policy if exists "guinee_activity_logs_delete" on geg_guinee.activity_logs;
create policy "guinee_activity_logs_select" on geg_guinee.activity_logs for select using (auth.uid() is not null);
create policy "guinee_activity_logs_insert" on geg_guinee.activity_logs for insert with check (auth.uid() is not null);
create policy "guinee_activity_logs_delete" on geg_guinee.activity_logs for delete using (geg_guinee.is_admin_or_manager());

-- purchase_costs
alter table geg_guinee.purchase_costs enable row level security;
drop policy if exists "guinee_purchase_costs_select" on geg_guinee.purchase_costs;
drop policy if exists "guinee_purchase_costs_insert" on geg_guinee.purchase_costs;
drop policy if exists "guinee_purchase_costs_update" on geg_guinee.purchase_costs;
drop policy if exists "guinee_purchase_costs_delete" on geg_guinee.purchase_costs;
create policy "guinee_purchase_costs_select" on geg_guinee.purchase_costs for select using (auth.uid() is not null);
create policy "guinee_purchase_costs_insert" on geg_guinee.purchase_costs for insert with check (auth.uid() is not null);
create policy "guinee_purchase_costs_update" on geg_guinee.purchase_costs for update using (auth.uid() is not null);
create policy "guinee_purchase_costs_delete" on geg_guinee.purchase_costs for delete using (geg_guinee.is_admin_or_manager());

-- ─── geg_singapore schema ────────────────────────────────────────────────────
-- Singapore is accessed exclusively via SECURITY DEFINER RPC functions
-- (insert_singapore_lead, etc.) — never via direct PostgREST anon calls.
-- Enabling RLS here is a belt-and-suspenders measure.

alter table geg_singapore.accounts enable row level security;
drop policy if exists "sg_accounts_service_only" on geg_singapore.accounts;
create policy "sg_accounts_service_only" on geg_singapore.accounts
  using (auth.role() = 'service_role');

alter table geg_singapore.deals enable row level security;
drop policy if exists "sg_deals_service_only" on geg_singapore.deals;
create policy "sg_deals_service_only" on geg_singapore.deals
  using (auth.role() = 'service_role');

alter table geg_singapore.contacts enable row level security;
drop policy if exists "sg_contacts_service_only" on geg_singapore.contacts;
create policy "sg_contacts_service_only" on geg_singapore.contacts
  using (auth.role() = 'service_role');
