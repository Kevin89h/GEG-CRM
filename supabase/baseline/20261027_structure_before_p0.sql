-- Baseline: structure of the GEG CRM database (production asdzjdbsoccsploeiuuw) as read on 27/10/2026, before the P0 security migration.
-- Schemas public, api, geg_guinee, geg_singapore + storage buckets and policies. Structure only, no data.
-- Reference document: this is ALREADY in place on production and on GEG CRM Dev. Do NOT run it on an existing database.
-- To rebuild an empty project: run this file, then the files of supabase/migrations/ dated after 2026-10-27.

set check_function_bodies = off;


-- Schemas ------------------------------------------------------------
create schema if not exists api;
create schema if not exists geg_guinee;
create schema if not exists geg_singapore;

-- Extensions ------------------------------------------------------------
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- Sequences ------------------------------------------------------------
create sequence if not exists public.invoice_seq as bigint increment 1 minvalue 1 maxvalue 9223372036854775807 start 1;
create sequence if not exists public.purchase_order_seq as bigint increment 1 minvalue 1 maxvalue 9223372036854775807 start 1;
create sequence if not exists public.sales_order_seq as bigint increment 1 minvalue 1 maxvalue 9223372036854775807 start 1;

-- Tables ------------------------------------------------------------
create table geg_guinee.accounts (id uuid not null, name text not null, type text, industry text, country text, city text, phone text, email text, website text, notes text, owner_id uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, salesperson_id uuid, address text, nif text, cgv_text text);
create table geg_guinee.activities (id uuid not null, type text not null, subject text not null, notes text, date timestamp with time zone not null, follow_up_date date, completed boolean not null, account_id uuid, contact_id uuid, deal_id uuid, user_id uuid not null, created_at timestamp with time zone not null);
create table geg_guinee.activity_logs (id uuid not null, user_id uuid, user_email text, user_name text, action text not null, resource text not null, resource_id text, label text, details jsonb, created_at timestamp with time zone);
create table geg_guinee.chat_messages (id uuid not null, room_id uuid not null, user_id uuid not null, user_name text not null, content text not null, created_at timestamp with time zone);
create table geg_guinee.chat_read_receipts (user_id uuid not null, room_id uuid not null, last_read_at timestamp with time zone);
create table geg_guinee.chat_rooms (id uuid not null, type text not null, reference_id uuid, name text not null, created_at timestamp with time zone);
create table geg_guinee.commissions (id uuid not null, employee_id uuid not null, invoice_id uuid, sales_order_id uuid, rate numeric(5,2) not null, amount numeric(14,2) not null, currency text not null, status text not null, paid_date date, treasury_transaction_id uuid, notes text, created_at timestamp with time zone not null);
create table geg_guinee.contacts (id uuid not null, account_id uuid not null, first_name text not null, last_name text not null, title text, email text, phone text, is_primary boolean not null, notes text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
create table geg_guinee.deal_costs (id uuid not null, deal_id uuid not null, type text not null, label text, amount numeric(18,2) not null, currency text not null, paid boolean not null, created_at timestamp with time zone);
create table geg_guinee.deals (id uuid not null, account_id uuid, title text not null, stage text not null, value numeric(18,2), currency text not null, probability integer, close_date date, owner_id uuid, notes text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, prospect_name text, source text, source_detail text, products_requested text, assigned_to uuid[], priority text not null, next_action text, next_action_date date, deal_date date, country text, original_request text, contact_name text, contact_role text, contact_email text, contact_phone text, sector text[], preferred_channel text, selling_price numeric(18,2), cost numeric(18,2));
create table geg_guinee.delivery_note_lines (id uuid not null, delivery_note_id uuid not null, product_id uuid, warehouse_id uuid, description text not null, quantity numeric(18,4) not null, "position" integer not null, order_line_id uuid, qty_delivered numeric(14,3));
create table geg_guinee.delivery_notes (id uuid not null, number text not null, invoice_id uuid, account_id uuid, status text not null, delivery_date date, notes text, user_id uuid, created_at timestamp with time zone not null, order_id uuid);
create table geg_guinee.document_categories (id uuid not null, name text not null, color text not null, created_at timestamp with time zone not null);
create table geg_guinee.documents (id uuid not null, name text not null, description text, category_id uuid, file_url text not null, file_name text not null, file_size bigint, file_type text, account_id uuid, deal_id uuid, contact_id uuid, uploaded_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, visibility text, is_company_doc boolean, doc_type text);
create table geg_guinee.employees (id uuid not null, full_name text not null, title text, job_description text, start_date date not null, salary numeric(12,2), salary_currency text not null, commission_rate numeric(5,2) not null, is_active boolean not null, email text, phone text, notes text, created_at timestamp with time zone not null, profile_id uuid);
create table geg_guinee.exchange_rates (id uuid not null, from_currency text not null, to_currency text not null, rate numeric(18,4) not null, effective_date date not null, notes text, created_by uuid, created_at timestamp with time zone not null);
create table geg_guinee.invoice_lines (id uuid not null, invoice_id uuid not null, product_id uuid, description text not null, quantity numeric(18,3) not null, unit_price numeric(18,2) not null, discount numeric(5,2) not null, "position" integer not null, tva_rate numeric);
create table geg_guinee.invoices (id uuid not null, number text not null, order_id uuid, account_id uuid, status text not null, currency text not null, issue_date date not null, due_date date, notes text, user_id uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, deal_id uuid, salesperson_id uuid);
create table geg_guinee.payments (id uuid not null, invoice_id uuid not null, amount numeric(18,2) not null, currency text not null, method text not null, reference text, notes text, paid_at timestamp with time zone not null, user_id uuid not null, created_at timestamp with time zone not null, treasury_account_id uuid, exchange_rate numeric, amount_in_invoice_currency numeric);
create table geg_guinee.product_categories (id uuid not null, name text not null, color text not null, created_at timestamp with time zone not null);
create table geg_guinee.product_documents (id uuid not null, product_id uuid not null, type text not null, name text not null, url text not null, file_size integer, uploaded_by uuid, created_at timestamp with time zone);
create table geg_guinee.product_packaging (id uuid not null, product_id uuid not null, unit_id uuid not null, sell_price numeric, buy_price numeric, currency text not null, buy_price_currency text not null, created_at timestamp with time zone);
create table geg_guinee.products (id uuid not null, reference text, name text not null, category_id uuid, unit_id uuid, description text, buy_price numeric(18,2), sell_price numeric(18,2), currency text not null, is_active boolean not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, buy_price_currency text, can_be_sold boolean not null, can_be_purchased boolean not null, product_type text not null, barcode text, tva_vente numeric(5,2), tva_achat numeric(5,2), merchant_reference text, sku text, origin text, internal_notes text, image_url text, unit_ids uuid[], product_code text);
create table geg_guinee.purchase_costs (id uuid not null, order_id uuid not null, type text not null, label text not null, amount numeric(18,2) not null, currency text not null);
create table geg_guinee.purchase_order_events (id uuid not null, order_id uuid not null, event_type text not null, payload jsonb, created_at timestamp with time zone, user_id uuid);
create table geg_guinee.purchase_order_lines (id uuid not null, order_id uuid not null, product_id uuid, description text not null, quantity numeric(18,3) not null, fob_unit_price numeric(18,2) not null, warehouse_id uuid, "position" integer not null, qty_received numeric(14,3) not null);
create table geg_guinee.purchase_orders (id uuid not null, number text not null, supplier_name text not null, status text not null, currency text not null, order_date date not null, expected_date date, notes text, user_id uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, incoterm text not null, global_discount_pct numeric(5,2) not null, freight_cost numeric(18,2) not null, insurance_cost numeric(18,2) not null, supplier_id uuid, project_code text, terms_conditions text, commission_client numeric, pret_montant numeric, pret_devise text, pret_entite text, pret_echeance date);
create table geg_guinee.purchase_reception_lines (id uuid not null, reception_id uuid not null, order_line_id uuid, product_id uuid, description text not null, quantity numeric not null, unit_price numeric not null, warehouse_id uuid, created_at timestamp with time zone not null);
create table geg_guinee.purchase_receptions (id uuid not null, order_id uuid not null, number text not null, received_at timestamp with time zone not null, notes text, user_id uuid, created_at timestamp with time zone not null);
create table geg_guinee.sales_order_lines (id uuid not null, order_id uuid not null, product_id uuid, description text not null, quantity numeric(18,3) not null, unit_price numeric(18,2) not null, discount numeric(5,2) not null, "position" integer not null, tva_exempt boolean, qty_delivered numeric(14,3) not null, unit_id uuid);
create table geg_guinee.sales_orders (id uuid not null, number text not null, status text not null, account_id uuid, contact_id uuid, currency text not null, valid_until date, notes text, user_id uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, salesperson_id uuid, commission_rate numeric(5,2), payment_terms text, client_order_ref text, date_order date, tva boolean, additional_info text, title text, project_code text, commission_client numeric, conditions_generales text, terms_conditions jsonb);
create table geg_guinee.shipments (id uuid not null, type text not null, carrier text not null, tracking_number text not null, description text, status text not null, eta date, origin text, destination text, notes text, created_at timestamp with time zone, updated_at timestamp with time zone, bill_of_lading text, supplier_invoice_id uuid);
create table geg_guinee.stock_levels (id uuid not null, product_id uuid not null, warehouse_id uuid not null, quantity numeric(18,3) not null, updated_at timestamp with time zone not null);
create table geg_guinee.stock_moves (id uuid not null, type text not null, product_id uuid not null, from_warehouse_id uuid, to_warehouse_id uuid, quantity numeric(18,3) not null, reference text, notes text, date timestamp with time zone not null, user_id uuid, created_at timestamp with time zone not null);
create table geg_guinee.supplier_invoice_lines (id uuid not null, invoice_id uuid not null, description text not null, quantity numeric not null, unit_price numeric not null, tax_rate numeric not null, "position" integer not null);
create table geg_guinee.supplier_invoices (id uuid not null, number text not null, supplier_name text not null, currency text not null, invoice_date date not null, due_date date, reference text, notes text, total_ht numeric not null, tax_amount numeric not null, total_ttc numeric not null, status text not null, created_at timestamp with time zone, updated_at timestamp with time zone, purchase_order_id uuid, reception_id uuid, supplier_id uuid, deal_id uuid);
create table geg_guinee.supplier_payments (id uuid not null, supplier_invoice_id uuid not null, amount numeric(15,2) not null, currency text not null, method text not null, treasury_account_id uuid, reference text, notes text, paid_at timestamp with time zone not null, created_at timestamp with time zone, exchange_rate numeric(18,6));
create table geg_guinee.suppliers (id uuid not null, name text not null, email text, phone text, country text, city text, address text, payment_terms text, currency text, iban text, swift text, bank_name text, notes text, is_active boolean not null, created_at timestamp with time zone, updated_at timestamp with time zone);
create table geg_guinee.treasury_accounts (id uuid not null, name text not null, type text not null, institution text, account_number text, currency text not null, initial_balance numeric(18,2) not null, is_active boolean not null, color text not null, created_at timestamp with time zone not null, swift text, iban text);
create table geg_guinee.treasury_transactions (id uuid not null, account_id uuid not null, type text not null, amount numeric(18,2) not null, currency text not null, description text not null, reference text, category text, payment_id uuid, transfer_account_id uuid, date timestamp with time zone not null, user_id uuid, created_at timestamp with time zone not null);
create table geg_guinee.units (id uuid not null, name text not null, type text not null);
create table geg_guinee.warehouses (id uuid not null, name text not null, city text, address text, is_active boolean not null, created_at timestamp with time zone not null);
create table geg_singapore.accounts (id uuid not null, name text not null, type text, is_supplier boolean, supplier_currency text, supplier_notes text, phone text, email text, website text, notes text, salesperson_id uuid, industry text, country text, city text, created_at timestamp with time zone, address text, nif text, updated_at timestamp with time zone);
create table geg_singapore.activities (id uuid not null, date timestamp with time zone not null, account_id uuid, deal_id uuid, contact_id uuid, action text, type text, status text, notes text, user_id uuid, created_at timestamp with time zone);
create table geg_singapore.activity_logs (id uuid not null, user_id uuid, user_email text, user_name text, action text not null, resource text, resource_id text, details jsonb, label text, "timestamp" timestamp with time zone);
create table geg_singapore.chat_messages (id uuid not null, room_id uuid not null, user_id uuid not null, user_name text, content text not null, created_at timestamp with time zone);
create table geg_singapore.chat_read_receipts (id uuid not null, user_id uuid not null, room_id uuid not null, last_read_at timestamp with time zone);
create table geg_singapore.chat_rooms (id uuid not null, type text, reference_id uuid, name text, created_at timestamp with time zone);
create table geg_singapore.commissions (id uuid not null, employee_id uuid, invoice_id uuid, amount numeric(18,2) not null, currency text, status text, paid_date date, treasury_transaction_id uuid, created_at timestamp with time zone);
create table geg_singapore.contacts (id uuid not null, first_name text not null, last_name text, account_id uuid, title text, email text, phone text, is_primary boolean, notes text, created_at timestamp with time zone);
create table geg_singapore.deals (id uuid not null, title text not null, account_id uuid, status text, amount numeric(18,2), currency text, close_date date, notes text, created_at timestamp with time zone, stage text, source_detail text, probability integer, priority text, next_action text, next_action_date date, owner_id uuid, updated_at timestamp with time zone, deal_date date, country text, original_request text, contact_name text, contact_role text, contact_email text, contact_phone text, sector text, preferred_channel text, selling_price numeric, cost numeric, source text, products_requested text, assigned_to uuid, prospect_name text);
create table geg_singapore.delivery_note_lines (id uuid not null, delivery_note_id uuid not null, product_id uuid, description text not null, quantity numeric(18,3) not null, warehouse_id uuid, "position" integer);
create table geg_singapore.delivery_notes (id uuid not null, number text not null, invoice_id uuid, order_id uuid, account_id uuid, status text, delivery_date date, notes text, user_id uuid, created_at timestamp with time zone);
create table geg_singapore.document_categories (id uuid not null, name text not null, color text, created_at timestamp with time zone);
create table geg_singapore.documents (id uuid not null, name text not null, description text, category_id uuid, account_id uuid, file_url text not null, created_at timestamp with time zone);
create table geg_singapore.employees (id uuid not null, full_name text not null, email text, is_active boolean, commission_rate numeric(5,2), created_at timestamp with time zone);
create table geg_singapore.exchange_rates (id uuid not null, from_currency text not null, to_currency text not null, rate numeric(18,6) not null, effective_date date not null, created_at timestamp with time zone);
create table geg_singapore.invoice_lines (id uuid not null, invoice_id uuid not null, product_id uuid, description text not null, quantity numeric(18,3) not null, unit_price numeric(18,2) not null, discount numeric(5,2), tva_rate numeric(5,2), "position" integer, created_at timestamp with time zone);
create table geg_singapore.invoices (id uuid not null, number text not null, status text not null, currency text not null, account_id uuid, order_id uuid, issue_date date, due_date date, total_ht numeric(18,2), total_paid numeric(18,2), balance numeric(18,2), notes text, created_at timestamp with time zone, deal_id uuid, user_id uuid, updated_at timestamp with time zone, salesperson_id uuid);
create table geg_singapore.payments (id uuid not null, invoice_id uuid not null, amount numeric(18,2) not null, currency text not null, method text, reference text, paid_at date, treasury_account_id uuid, notes text, created_at timestamp with time zone, exchange_rate numeric, amount_in_invoice_currency numeric, user_id uuid);
create table geg_singapore.product_categories (id uuid not null, name text not null, color text, created_at timestamp with time zone);
create table geg_singapore.product_documents (id uuid not null, product_id uuid not null, type text not null, name text not null, url text not null, file_size bigint, created_at timestamp with time zone);
create table geg_singapore.products (id uuid not null, name text not null, reference text, merchant_reference text, sku text, description text, internal_notes text, origin text, category_id uuid, unit_id uuid, product_type text, buy_price numeric(18,2), buy_price_currency text, sell_price numeric(18,2), currency text, tva_vente numeric(5,2), tva_achat numeric(5,2), can_be_sold boolean, can_be_purchased boolean, is_active boolean, barcode text, image_url text, created_at timestamp with time zone);
create table geg_singapore.purchase_costs (id uuid not null, order_id uuid not null, type text, label text not null, amount numeric(18,2) not null, currency text, "position" integer);
create table geg_singapore.purchase_order_lines (id uuid not null, order_id uuid not null, product_id uuid, description text not null, quantity numeric(18,3) not null, unit_price numeric(18,2) not null, fob_unit_price numeric(18,2), "position" integer);
create table geg_singapore.purchase_orders (id uuid not null, number text not null, supplier_name text, supplier_id uuid, status text not null, currency text not null, order_date date, expected_date date, payment_terms text, global_discount_pct numeric(5,2), total numeric(18,2), notes text, user_id uuid, created_at timestamp with time zone, project_code text, terms_conditions text, commission_client numeric, pret_montant numeric, pret_devise text, pret_entite text, pret_echeance date);
create table geg_singapore.purchase_reception_lines (id uuid not null, reception_id uuid not null, order_line_id uuid, product_id uuid, description text, quantity numeric(18,3) not null, unit_price numeric(18,2), warehouse_id uuid);
create table geg_singapore.purchase_receptions (id uuid not null, order_id uuid not null, number text not null, received_at date, user_id uuid, created_at timestamp with time zone);
create table geg_singapore.sales_order_lines (id uuid not null, order_id uuid not null, product_id uuid, description text not null, quantity numeric(18,3) not null, unit_price numeric(18,2) not null, discount numeric(5,2), tva_exempt boolean, "position" integer, created_at timestamp with time zone);
create table geg_singapore.sales_orders (id uuid not null, number text not null, status text not null, currency text not null, account_id uuid, contact_id uuid, salesperson_id uuid, date_order date, valid_until date, payment_terms text, client_order_ref text, tva boolean, notes text, additional_info text, created_at timestamp with time zone, title text, project_code text, commission_client numeric, conditions_generales text);
create table geg_singapore.shipments (id uuid not null, description text, origin text, destination text, eta date, status text, notes text, created_at timestamp with time zone);
create table geg_singapore.stock_levels (id uuid not null, product_id uuid not null, warehouse_id uuid not null, quantity numeric(18,3));
create table geg_singapore.stock_moves (id uuid not null, type text not null, product_id uuid not null, from_warehouse_id uuid, to_warehouse_id uuid, quantity numeric(18,3) not null, notes text, reference text, date date, user_id uuid, created_at timestamp with time zone);
create table geg_singapore.supplier_invoice_lines (id uuid not null, invoice_id uuid not null, description text not null, quantity numeric(18,3) not null, unit_price numeric(18,2) not null, tax_rate numeric(5,2), "position" integer);
create table geg_singapore.supplier_invoices (id uuid not null, number text not null, supplier_name text, supplier_id uuid, purchase_order_id uuid, reception_id uuid, status text not null, currency text not null, invoice_date date, due_date date, total_ht numeric(18,2), tax_amount numeric(18,2), total_ttc numeric(18,2), balance numeric(18,2), reference text, notes text, created_at timestamp with time zone, updated_at timestamp with time zone);
create table geg_singapore.supplier_payments (id uuid not null, supplier_invoice_id uuid, amount numeric(18,2) not null, currency text not null, method text, reference text, paid_at date, treasury_account_id uuid, notes text, created_at timestamp with time zone);
create table geg_singapore.suppliers (id uuid not null, name text not null, email text, phone text, country text, city text, address text, payment_terms text, currency text, iban text, swift text, bank_name text, notes text, is_active boolean not null, created_at timestamp with time zone, updated_at timestamp with time zone);
create table geg_singapore.treasury_accounts (id uuid not null, name text not null, type text not null, currency text not null, institution text, account_number text, swift text, iban text, color text, is_active boolean, initial_balance numeric(18,2), total_in numeric(18,2), total_out numeric(18,2), created_at timestamp with time zone);
create table geg_singapore.treasury_transactions (id uuid not null, account_id uuid not null, type text not null, amount numeric(18,2) not null, currency text not null, description text, reference text, category text, date date, user_id uuid, created_at timestamp with time zone, payment_id uuid, transfer_account_id uuid);
create table geg_singapore.units (id uuid not null, name text not null, type text, created_at timestamp with time zone);
create table geg_singapore.warehouses (id uuid not null, name text not null, city text, address text, is_active boolean, created_at timestamp with time zone);
create table public.accounts (id uuid not null, name text not null, type text not null, industry text, country text not null, city text, phone text, email text, website text, notes text, owner_id uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, salesperson_id uuid, is_supplier boolean, supplier_currency text, supplier_notes text, cgv_text text);
create table public.activities (id uuid not null, type text not null, subject text not null, notes text, date timestamp with time zone not null, follow_up_date date, completed boolean not null, account_id uuid, contact_id uuid, deal_id uuid, user_id uuid not null, created_at timestamp with time zone not null);
create table public.commissions (id uuid not null, employee_id uuid not null, invoice_id uuid, sales_order_id uuid, rate numeric(5,2) not null, amount numeric(14,2) not null, currency text not null, status text not null, paid_date date, treasury_transaction_id uuid, notes text, created_at timestamp with time zone not null);
create table public.companies (id uuid not null, name text not null, schema_name text not null, country text, currency text not null, logo_url text, is_active boolean not null, created_at timestamp with time zone not null);
create table public.contacts (id uuid not null, account_id uuid not null, first_name text not null, last_name text not null, title text, email text, phone text, is_primary boolean not null, notes text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
create table public.deals (id uuid not null, account_id uuid, title text not null, stage text not null, value numeric(18,2), currency text not null, probability integer, close_date date, owner_id uuid, notes text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, prospect_name text, source text, source_detail text, products_requested text, priority text, next_action text, next_action_date date, assigned_to uuid);
create table public.document_categories (id uuid not null, name text not null, color text not null, created_at timestamp with time zone not null);
create table public.document_settings (id uuid not null, company_id uuid, company_name text, tagline text, address_line1 text, address_line2 text, city text, country text, phone text, email text, website text, rccm text, nif text, logo_url text, devis_prefix text, invoice_prefix text, po_prefix text, footer_text text, bank_details text, brand_color text, created_at timestamp with time zone, updated_at timestamp with time zone, layout_config jsonb, cgv_text text);
create table public.document_tokens (token uuid not null, document_id uuid not null, document_type text not null, expires_at timestamp with time zone not null, created_at timestamp with time zone);
create table public.documents (id uuid not null, name text not null, description text, category_id uuid, file_url text not null, file_name text not null, file_size bigint, file_type text, account_id uuid, deal_id uuid, contact_id uuid, uploaded_by uuid, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
create table public.employees (id uuid not null, full_name text not null, title text, job_description text, start_date date not null, salary numeric(12,2), salary_currency text not null, commission_rate numeric(5,2) not null, is_active boolean not null, email text, phone text, notes text, created_at timestamp with time zone not null);
create table public.exchange_rates (id uuid not null, from_currency text not null, to_currency text not null, rate numeric(18,4) not null, effective_date date not null, notes text, created_by uuid, created_at timestamp with time zone not null);
create table public.invoice_lines (id uuid not null, invoice_id uuid not null, product_id uuid, description text not null, quantity numeric(18,3) not null, unit_price numeric(18,2) not null, discount numeric(5,2) not null, "position" integer not null);
create table public.invoices (id uuid not null, number text not null, order_id uuid, account_id uuid, status text not null, currency text not null, issue_date date not null, due_date date, notes text, user_id uuid not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null);
create table public.notifications (id uuid not null, user_id uuid not null, type text not null, title text not null, body text not null, link text, read boolean not null, created_at timestamp with time zone not null);
create table public.payments (id uuid not null, invoice_id uuid not null, amount numeric(18,2) not null, currency text not null, method text not null, reference text, notes text, paid_at timestamp with time zone not null, user_id uuid not null, created_at timestamp with time zone not null, treasury_account_id uuid);
create table public.product_categories (id uuid not null, name text not null, color text not null, created_at timestamp with time zone not null);
create table public.products (id uuid not null, reference text, name text not null, category_id uuid, unit_id uuid, description text, buy_price numeric(18,2), sell_price numeric(18,2), currency text not null, is_active boolean not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, buy_price_currency text, image_url text, unit_ids uuid[]);
create table public.profiles (id uuid not null, email text not null, full_name text, role text not null, avatar_url text, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, permissions jsonb not null, current_company_id uuid, company_access uuid[] not null);
create table public.purchase_costs (id uuid not null, order_id uuid not null, type text not null, label text not null, amount numeric(18,2) not null, currency text not null);
create table public.purchase_order_lines (id uuid not null, order_id uuid not null, product_id uuid, description text not null, quantity numeric(18,3) not null, fob_unit_price numeric(18,2) not null, warehouse_id uuid, "position" integer not null);
create table public.purchase_orders (id uuid not null, number text not null, supplier_name text not null, status text not null, currency text not null, order_date date not null, expected_date date, notes text, user_id uuid not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, incoterm text not null, global_discount_pct numeric(5,2) not null, freight_cost numeric(18,2) not null, insurance_cost numeric(18,2) not null);
create table public.push_subscriptions (id uuid not null, user_id uuid not null, endpoint text not null, p256dh text not null, auth text not null, created_at timestamp with time zone);
create table public.sales_order_lines (id uuid not null, order_id uuid not null, product_id uuid, description text not null, quantity numeric(18,3) not null, unit_price numeric(18,2) not null, discount numeric(5,2) not null, "position" integer not null);
create table public.sales_orders (id uuid not null, number text not null, status text not null, account_id uuid, contact_id uuid, currency text not null, valid_until date, notes text, user_id uuid not null, created_at timestamp with time zone not null, updated_at timestamp with time zone not null, salesperson_id uuid, commission_rate numeric(5,2));
create table public.stock_levels (id uuid not null, product_id uuid not null, warehouse_id uuid not null, quantity numeric(18,3) not null, updated_at timestamp with time zone not null);
create table public.stock_moves (id uuid not null, type text not null, product_id uuid not null, from_warehouse_id uuid, to_warehouse_id uuid, quantity numeric(18,3) not null, reference text, notes text, date timestamp with time zone not null, user_id uuid not null, created_at timestamp with time zone not null);
create table public.treasury_accounts (id uuid not null, name text not null, type text not null, institution text, account_number text, currency text not null, initial_balance numeric(18,2) not null, is_active boolean not null, color text not null, created_at timestamp with time zone not null);
create table public.treasury_transactions (id uuid not null, account_id uuid not null, type text not null, amount numeric(18,2) not null, currency text not null, description text not null, reference text, category text, payment_id uuid, transfer_account_id uuid, date timestamp with time zone not null, user_id uuid not null, created_at timestamp with time zone not null);
create table public.units (id uuid not null, name text not null, type text not null);
create table public.warehouses (id uuid not null, name text not null, city text, address text, is_active boolean not null, created_at timestamp with time zone not null);

-- Functions ------------------------------------------------------------
CREATE OR REPLACE FUNCTION geg_guinee.set_delivery_note_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  yr   text := to_char(now(), 'YYYY');
  seq  int;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(number, '[^0-9]', '', 'g'), '')::int
  ), 0) + 1
  INTO seq
  FROM geg_guinee.delivery_notes
  WHERE number LIKE 'BL-' || yr || '-%';

  NEW.number := 'BL-' || yr || '-' || lpad(seq::text, 4, '0');
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.apply_stock_move()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.type = 'in' THEN
    INSERT INTO public.stock_levels (product_id, warehouse_id, quantity)
      VALUES (NEW.product_id, NEW.to_warehouse_id, NEW.quantity)
      ON CONFLICT (product_id, warehouse_id)
      DO UPDATE SET quantity = stock_levels.quantity + NEW.quantity, updated_at = now();

  ELSIF NEW.type IN ('out','damaged','lost','destroyed') THEN
    INSERT INTO public.stock_levels (product_id, warehouse_id, quantity)
      VALUES (NEW.product_id, NEW.from_warehouse_id, -NEW.quantity)
      ON CONFLICT (product_id, warehouse_id)
      DO UPDATE SET quantity = stock_levels.quantity - NEW.quantity, updated_at = now();

  ELSIF NEW.type = 'transfer' THEN
    INSERT INTO public.stock_levels (product_id, warehouse_id, quantity)
      VALUES (NEW.product_id, NEW.from_warehouse_id, -NEW.quantity)
      ON CONFLICT (product_id, warehouse_id)
      DO UPDATE SET quantity = stock_levels.quantity - NEW.quantity, updated_at = now();
    INSERT INTO public.stock_levels (product_id, warehouse_id, quantity)
      VALUES (NEW.product_id, NEW.to_warehouse_id, NEW.quantity)
      ON CONFLICT (product_id, warehouse_id)
      DO UPDATE SET quantity = stock_levels.quantity + NEW.quantity, updated_at = now();

  ELSIF NEW.type = 'adjustment' THEN
    INSERT INTO public.stock_levels (product_id, warehouse_id, quantity)
      VALUES (NEW.product_id, NEW.to_warehouse_id, NEW.quantity)
      ON CONFLICT (product_id, warehouse_id)
      DO UPDATE SET quantity = NEW.quantity, updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_singapore_deal(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'geg_singapore', 'public'
AS $function$
  DELETE FROM geg_singapore.deals WHERE id = p_id;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_singapore_supplier(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'geg_singapore', 'public'
AS $function$
  UPDATE geg_singapore.suppliers SET is_active = false WHERE id = p_id;
$function$
;
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.number := 'FAC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 4, '0');
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.number := 'DEV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.sales_order_seq')::text, 4, '0');
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.generate_purchase_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.number := 'ACH-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.purchase_order_seq')::text, 4, '0');
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.get_singapore_deal(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', d.id,
    'title', d.title,
    'status', d.status,
    'stage', COALESCE(d.stage, 'lead'),
    'notes', d.notes,
    'amount', d.amount,
    'currency', d.currency,
    'created_at', d.created_at,
    'account_id', d.account_id,
    'assigned_to', '[]'::jsonb,
    'priority', 'normal',
    'prospect_name', a.name,
    'account', jsonb_build_object(
      'id', a.id,
      'name', a.name,
      'type', a.type,
      'email', a.email,
      'phone', a.phone,
      'country', a.country,
      'city', a.city
    )
  )
  INTO v_result
  FROM geg_singapore.deals d
  LEFT JOIN geg_singapore.accounts a ON a.id = d.account_id
  WHERE d.id = p_id;

  RETURN v_result;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_singapore_deals()
 RETURNS TABLE(id uuid, title text, status text, stage text, notes text, created_at timestamp with time zone, account_name text, account_email text, account_country text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT
    d.id,
    d.title,
    d.status,
    COALESCE(d.stage, 'lead') AS stage,
    d.notes,
    d.created_at,
    a.name AS account_name,
    a.email AS account_email,
    a.country AS account_country
  FROM geg_singapore.deals d
  LEFT JOIN geg_singapore.accounts a ON a.id = d.account_id
  ORDER BY d.created_at DESC;
$function$
;
CREATE OR REPLACE FUNCTION public.get_singapore_suppliers()
 RETURNS TABLE(id uuid, name text, email text, phone text, country text, city text, payment_terms text, currency text, iban text, swift text, bank_name text, notes text, is_active boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'geg_singapore', 'public'
AS $function$
  SELECT id, name, email, phone, country, city, payment_terms, currency, iban, swift, bank_name, notes, is_active
  FROM geg_singapore.suppliers
  WHERE is_active = true
  ORDER BY name;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.insert_singapore_account(p_name text, p_type text DEFAULT 'enterprise'::text, p_industry text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_website text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'geg_singapore'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO geg_singapore.accounts (name, type, industry, country, city, phone, email, website, notes)
  VALUES (p_name, p_type, p_industry, p_country, p_city, p_phone, p_email, p_website, p_notes)
  RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id, 'name', p_name);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.insert_singapore_lead(p_name text, p_email text DEFAULT ''::text, p_phone text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_deal_title text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_source_url text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'geg_singapore'
AS $function$
DECLARE
  v_account_id uuid;
  v_deal_id    uuid;
BEGIN
  INSERT INTO geg_singapore.accounts (name, email, phone, country, city)
  VALUES (p_name, p_email, p_phone, p_country, p_city)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_account_id;

  IF v_account_id IS NULL THEN
    SELECT id INTO v_account_id FROM geg_singapore.accounts
    WHERE email = p_email AND email != ''
    LIMIT 1;
  END IF;

  INSERT INTO geg_singapore.deals (account_id, title, stage, notes, source_detail)
  VALUES (v_account_id, COALESCE(p_deal_title, p_name), 'lead', p_notes, p_source_url)
  RETURNING id INTO v_deal_id;

  RETURN json_build_object('account_id', v_account_id, 'deal_id', v_deal_id);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.insert_singapore_supplier(p_name text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_payment_terms text DEFAULT NULL::text, p_currency text DEFAULT 'USD'::text, p_iban text DEFAULT NULL::text, p_swift text DEFAULT NULL::text, p_bank_name text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, email text, phone text, country text, city text, payment_terms text, currency text, iban text, swift text, bank_name text, notes text, is_active boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'geg_singapore', 'public'
AS $function$
  INSERT INTO geg_singapore.suppliers (name, email, phone, country, city, address, payment_terms, currency, iban, swift, bank_name, notes)
  VALUES (p_name, p_email, p_phone, p_country, p_city, p_address, p_payment_terms, p_currency, p_iban, p_swift, p_bank_name, p_notes)
  RETURNING id, name, email, phone, country, city, payment_terms, currency, iban, swift, bank_name, notes, is_active;
$function$
;
CREATE OR REPLACE FUNCTION public.payment_to_treasury()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if new.treasury_account_id is not null then
    insert into public.treasury_transactions
      (account_id, type, amount, currency, description, payment_id, user_id)
    values
      (new.treasury_account_id, 'credit', new.amount, new.currency,
       'Paiement facture', new.id, new.user_id);
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.transfer_singapore_to_guinee(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'geg_singapore', 'public'
AS $function$
DECLARE
  v_deal geg_singapore.deals%ROWTYPE;
  v_account geg_singapore.accounts%ROWTYPE;
  v_new_account_id uuid;
  v_new_deal_id uuid;
BEGIN
  SELECT * INTO v_deal FROM geg_singapore.deals WHERE id = p_deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  SELECT * INTO v_account FROM geg_singapore.accounts WHERE id = v_deal.account_id;

  SELECT id INTO v_new_account_id FROM geg_guinee.accounts WHERE lower(email) = lower(v_account.email) LIMIT 1;
  IF v_new_account_id IS NULL THEN
    INSERT INTO geg_guinee.accounts (name, type, email, phone, country, city)
    VALUES (v_account.name, COALESCE(v_account.type, 'enterprise'), v_account.email, v_account.phone, v_account.country, v_account.city)
    RETURNING id INTO v_new_account_id;
  END IF;

  INSERT INTO geg_guinee.deals (title, account_id, prospect_name, stage, source, notes, assigned_to, priority)
  VALUES (v_deal.title, v_new_account_id, v_account.name, 'lead', 'website', v_deal.notes, '{}', 'normal')
  RETURNING id INTO v_new_deal_id;

  DELETE FROM geg_singapore.deals WHERE id = p_deal_id;

  RETURN jsonb_build_object('deal_id', v_new_deal_id, 'account_id', v_new_account_id);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_invoice_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_total   numeric;
  v_paid    numeric;
  v_status  text;
begin
  select coalesce(sum(il.quantity * il.unit_price * (1 - il.discount / 100)), 0)
    into v_total
    from public.invoice_lines il
    where il.invoice_id = coalesce(new.invoice_id, old.invoice_id);

  select coalesce(sum(p.amount), 0)
    into v_paid
    from public.payments p
    where p.invoice_id = coalesce(new.invoice_id, old.invoice_id);

  if v_paid <= 0 then
    v_status := 'sent';
  elsif v_paid >= v_total then
    v_status := 'paid';
  else
    v_status := 'partial';
  end if;

  update public.invoices
    set status = v_status, updated_at = now()
    where id = coalesce(new.invoice_id, old.invoice_id)
      and status not in ('draft', 'cancelled');

  return coalesce(new, old);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_singapore_supplier(p_id uuid, p_name text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_payment_terms text DEFAULT NULL::text, p_currency text DEFAULT 'USD'::text, p_iban text DEFAULT NULL::text, p_swift text DEFAULT NULL::text, p_bank_name text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, email text, phone text, country text, city text, payment_terms text, currency text, iban text, swift text, bank_name text, notes text, is_active boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'geg_singapore', 'public'
AS $function$
  UPDATE geg_singapore.suppliers
  SET name = p_name, email = p_email, phone = p_phone, country = p_country,
      city = p_city, address = p_address, payment_terms = p_payment_terms,
      currency = p_currency, iban = p_iban, swift = p_swift, bank_name = p_bank_name,
      notes = p_notes, updated_at = now()
  WHERE id = p_id
  RETURNING id, name, email, phone, country, city, payment_terms, currency, iban, swift, bank_name, notes, is_active;
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;

-- Column defaults ------------------------------------------------------------
alter table geg_guinee.accounts alter column country set default 'Guinée'::text;
alter table geg_guinee.accounts alter column created_at set default now();
alter table geg_guinee.accounts alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.accounts alter column type set default 'enterprise'::text;
alter table geg_guinee.accounts alter column updated_at set default now();
alter table geg_guinee.activities alter column completed set default false;
alter table geg_guinee.activities alter column created_at set default now();
alter table geg_guinee.activities alter column date set default now();
alter table geg_guinee.activities alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.activity_logs alter column created_at set default now();
alter table geg_guinee.activity_logs alter column id set default gen_random_uuid();
alter table geg_guinee.chat_messages alter column created_at set default now();
alter table geg_guinee.chat_messages alter column id set default gen_random_uuid();
alter table geg_guinee.chat_read_receipts alter column last_read_at set default now();
alter table geg_guinee.chat_rooms alter column created_at set default now();
alter table geg_guinee.chat_rooms alter column id set default gen_random_uuid();
alter table geg_guinee.chat_rooms alter column type set default 'global'::text;
alter table geg_guinee.commissions alter column created_at set default now();
alter table geg_guinee.commissions alter column currency set default 'GNF'::text;
alter table geg_guinee.commissions alter column id set default gen_random_uuid();
alter table geg_guinee.commissions alter column rate set default 0;
alter table geg_guinee.commissions alter column status set default 'pending'::text;
alter table geg_guinee.contacts alter column created_at set default now();
alter table geg_guinee.contacts alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.contacts alter column is_primary set default false;
alter table geg_guinee.contacts alter column updated_at set default now();
alter table geg_guinee.deal_costs alter column amount set default 0;
alter table geg_guinee.deal_costs alter column created_at set default now();
alter table geg_guinee.deal_costs alter column currency set default 'GNF'::text;
alter table geg_guinee.deal_costs alter column id set default gen_random_uuid();
alter table geg_guinee.deal_costs alter column paid set default false;
alter table geg_guinee.deals alter column created_at set default now();
alter table geg_guinee.deals alter column currency set default 'USD'::text;
alter table geg_guinee.deals alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.deals alter column priority set default 'normal'::text;
alter table geg_guinee.deals alter column sector set default '{}'::text[];
alter table geg_guinee.deals alter column source set default 'other'::text;
alter table geg_guinee.deals alter column stage set default 'lead'::text;
alter table geg_guinee.deals alter column updated_at set default now();
alter table geg_guinee.delivery_note_lines alter column id set default gen_random_uuid();
alter table geg_guinee.delivery_note_lines alter column "position" set default 0;
alter table geg_guinee.delivery_note_lines alter column quantity set default 1;
alter table geg_guinee.delivery_notes alter column created_at set default now();
alter table geg_guinee.delivery_notes alter column id set default gen_random_uuid();
alter table geg_guinee.delivery_notes alter column number set default ''::text;
alter table geg_guinee.delivery_notes alter column status set default 'draft'::text;
alter table geg_guinee.document_categories alter column color set default '#6366f1'::text;
alter table geg_guinee.document_categories alter column created_at set default now();
alter table geg_guinee.document_categories alter column id set default gen_random_uuid();
alter table geg_guinee.documents alter column created_at set default now();
alter table geg_guinee.documents alter column id set default gen_random_uuid();
alter table geg_guinee.documents alter column is_company_doc set default false;
alter table geg_guinee.documents alter column updated_at set default now();
alter table geg_guinee.documents alter column visibility set default 'all'::text;
alter table geg_guinee.employees alter column commission_rate set default 0;
alter table geg_guinee.employees alter column created_at set default now();
alter table geg_guinee.employees alter column id set default gen_random_uuid();
alter table geg_guinee.employees alter column is_active set default true;
alter table geg_guinee.employees alter column salary_currency set default 'GNF'::text;
alter table geg_guinee.employees alter column start_date set default CURRENT_DATE;
alter table geg_guinee.exchange_rates alter column created_at set default now();
alter table geg_guinee.exchange_rates alter column effective_date set default CURRENT_DATE;
alter table geg_guinee.exchange_rates alter column id set default gen_random_uuid();
alter table geg_guinee.invoice_lines alter column discount set default 0;
alter table geg_guinee.invoice_lines alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.invoice_lines alter column "position" set default 0;
alter table geg_guinee.invoice_lines alter column quantity set default 1;
alter table geg_guinee.invoice_lines alter column tva_rate set default 0;
alter table geg_guinee.invoice_lines alter column unit_price set default 0;
alter table geg_guinee.invoices alter column created_at set default now();
alter table geg_guinee.invoices alter column currency set default 'USD'::text;
alter table geg_guinee.invoices alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.invoices alter column issue_date set default CURRENT_DATE;
alter table geg_guinee.invoices alter column status set default 'draft'::text;
alter table geg_guinee.invoices alter column updated_at set default now();
alter table geg_guinee.payments alter column created_at set default now();
alter table geg_guinee.payments alter column currency set default 'USD'::text;
alter table geg_guinee.payments alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.payments alter column method set default 'bank'::text;
alter table geg_guinee.payments alter column paid_at set default now();
alter table geg_guinee.product_categories alter column color set default 'blue'::text;
alter table geg_guinee.product_categories alter column created_at set default now();
alter table geg_guinee.product_categories alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.product_documents alter column created_at set default now();
alter table geg_guinee.product_documents alter column id set default gen_random_uuid();
alter table geg_guinee.product_packaging alter column buy_price_currency set default 'GNF'::text;
alter table geg_guinee.product_packaging alter column created_at set default now();
alter table geg_guinee.product_packaging alter column currency set default 'GNF'::text;
alter table geg_guinee.product_packaging alter column id set default gen_random_uuid();
alter table geg_guinee.products alter column buy_price_currency set default 'GNF'::text;
alter table geg_guinee.products alter column can_be_purchased set default true;
alter table geg_guinee.products alter column can_be_sold set default true;
alter table geg_guinee.products alter column created_at set default now();
alter table geg_guinee.products alter column currency set default 'USD'::text;
alter table geg_guinee.products alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.products alter column is_active set default true;
alter table geg_guinee.products alter column product_type set default 'storable'::text;
alter table geg_guinee.products alter column tva_achat set default 18;
alter table geg_guinee.products alter column tva_vente set default 18;
alter table geg_guinee.products alter column updated_at set default now();
alter table geg_guinee.purchase_costs alter column amount set default 0;
alter table geg_guinee.purchase_costs alter column currency set default 'USD'::text;
alter table geg_guinee.purchase_costs alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.purchase_order_events alter column created_at set default now();
alter table geg_guinee.purchase_order_events alter column id set default gen_random_uuid();
alter table geg_guinee.purchase_order_events alter column payload set default '{}'::jsonb;
alter table geg_guinee.purchase_order_lines alter column fob_unit_price set default 0;
alter table geg_guinee.purchase_order_lines alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.purchase_order_lines alter column "position" set default 0;
alter table geg_guinee.purchase_order_lines alter column qty_received set default 0;
alter table geg_guinee.purchase_order_lines alter column quantity set default 1;
alter table geg_guinee.purchase_orders alter column created_at set default now();
alter table geg_guinee.purchase_orders alter column currency set default 'USD'::text;
alter table geg_guinee.purchase_orders alter column freight_cost set default 0;
alter table geg_guinee.purchase_orders alter column global_discount_pct set default 0;
alter table geg_guinee.purchase_orders alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.purchase_orders alter column incoterm set default 'FOB'::text;
alter table geg_guinee.purchase_orders alter column insurance_cost set default 0;
alter table geg_guinee.purchase_orders alter column order_date set default CURRENT_DATE;
alter table geg_guinee.purchase_orders alter column status set default 'draft'::text;
alter table geg_guinee.purchase_orders alter column updated_at set default now();
alter table geg_guinee.purchase_reception_lines alter column created_at set default now();
alter table geg_guinee.purchase_reception_lines alter column id set default gen_random_uuid();
alter table geg_guinee.purchase_reception_lines alter column unit_price set default 0;
alter table geg_guinee.purchase_receptions alter column created_at set default now();
alter table geg_guinee.purchase_receptions alter column id set default gen_random_uuid();
alter table geg_guinee.purchase_receptions alter column received_at set default now();
alter table geg_guinee.sales_order_lines alter column discount set default 0;
alter table geg_guinee.sales_order_lines alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.sales_order_lines alter column "position" set default 0;
alter table geg_guinee.sales_order_lines alter column qty_delivered set default 0;
alter table geg_guinee.sales_order_lines alter column quantity set default 1;
alter table geg_guinee.sales_order_lines alter column tva_exempt set default false;
alter table geg_guinee.sales_order_lines alter column unit_price set default 0;
alter table geg_guinee.sales_orders alter column created_at set default now();
alter table geg_guinee.sales_orders alter column currency set default 'USD'::text;
alter table geg_guinee.sales_orders alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.sales_orders alter column status set default 'draft'::text;
alter table geg_guinee.sales_orders alter column tva set default false;
alter table geg_guinee.sales_orders alter column updated_at set default now();
alter table geg_guinee.shipments alter column created_at set default now();
alter table geg_guinee.shipments alter column id set default gen_random_uuid();
alter table geg_guinee.shipments alter column status set default 'in_transit'::text;
alter table geg_guinee.shipments alter column updated_at set default now();
alter table geg_guinee.stock_levels alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.stock_levels alter column quantity set default 0;
alter table geg_guinee.stock_levels alter column updated_at set default now();
alter table geg_guinee.stock_moves alter column created_at set default now();
alter table geg_guinee.stock_moves alter column date set default now();
alter table geg_guinee.stock_moves alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.supplier_invoice_lines alter column id set default gen_random_uuid();
alter table geg_guinee.supplier_invoice_lines alter column "position" set default 0;
alter table geg_guinee.supplier_invoice_lines alter column quantity set default 1;
alter table geg_guinee.supplier_invoice_lines alter column tax_rate set default 0;
alter table geg_guinee.supplier_invoice_lines alter column unit_price set default 0;
alter table geg_guinee.supplier_invoices alter column created_at set default now();
alter table geg_guinee.supplier_invoices alter column currency set default 'GNF'::text;
alter table geg_guinee.supplier_invoices alter column id set default gen_random_uuid();
alter table geg_guinee.supplier_invoices alter column status set default 'pending'::text;
alter table geg_guinee.supplier_invoices alter column tax_amount set default 0;
alter table geg_guinee.supplier_invoices alter column total_ht set default 0;
alter table geg_guinee.supplier_invoices alter column total_ttc set default 0;
alter table geg_guinee.supplier_invoices alter column updated_at set default now();
alter table geg_guinee.supplier_payments alter column created_at set default now();
alter table geg_guinee.supplier_payments alter column currency set default 'GNF'::text;
alter table geg_guinee.supplier_payments alter column exchange_rate set default NULL::numeric;
alter table geg_guinee.supplier_payments alter column id set default gen_random_uuid();
alter table geg_guinee.supplier_payments alter column method set default 'bank'::text;
alter table geg_guinee.supplier_payments alter column paid_at set default now();
alter table geg_guinee.suppliers alter column created_at set default now();
alter table geg_guinee.suppliers alter column currency set default 'USD'::text;
alter table geg_guinee.suppliers alter column id set default gen_random_uuid();
alter table geg_guinee.suppliers alter column is_active set default true;
alter table geg_guinee.suppliers alter column updated_at set default now();
alter table geg_guinee.treasury_accounts alter column color set default 'blue'::text;
alter table geg_guinee.treasury_accounts alter column created_at set default now();
alter table geg_guinee.treasury_accounts alter column currency set default 'GNF'::text;
alter table geg_guinee.treasury_accounts alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.treasury_accounts alter column initial_balance set default 0;
alter table geg_guinee.treasury_accounts alter column is_active set default true;
alter table geg_guinee.treasury_transactions alter column created_at set default now();
alter table geg_guinee.treasury_transactions alter column currency set default 'GNF'::text;
alter table geg_guinee.treasury_transactions alter column date set default now();
alter table geg_guinee.treasury_transactions alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.units alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.units alter column type set default 'volume'::text;
alter table geg_guinee.warehouses alter column created_at set default now();
alter table geg_guinee.warehouses alter column id set default extensions.uuid_generate_v4();
alter table geg_guinee.warehouses alter column is_active set default true;
alter table geg_singapore.accounts alter column created_at set default now();
alter table geg_singapore.accounts alter column id set default gen_random_uuid();
alter table geg_singapore.accounts alter column is_supplier set default false;
alter table geg_singapore.accounts alter column supplier_currency set default 'USD'::text;
alter table geg_singapore.accounts alter column type set default 'prospect'::text;
alter table geg_singapore.accounts alter column updated_at set default now();
alter table geg_singapore.activities alter column created_at set default now();
alter table geg_singapore.activities alter column date set default now();
alter table geg_singapore.activities alter column id set default gen_random_uuid();
alter table geg_singapore.activities alter column status set default 'planned'::text;
alter table geg_singapore.activity_logs alter column details set default '{}'::jsonb;
alter table geg_singapore.activity_logs alter column id set default gen_random_uuid();
alter table geg_singapore.activity_logs alter column "timestamp" set default now();
alter table geg_singapore.chat_messages alter column created_at set default now();
alter table geg_singapore.chat_messages alter column id set default gen_random_uuid();
alter table geg_singapore.chat_read_receipts alter column id set default gen_random_uuid();
alter table geg_singapore.chat_read_receipts alter column last_read_at set default now();
alter table geg_singapore.chat_rooms alter column created_at set default now();
alter table geg_singapore.chat_rooms alter column id set default gen_random_uuid();
alter table geg_singapore.chat_rooms alter column type set default 'general'::text;
alter table geg_singapore.commissions alter column amount set default 0;
alter table geg_singapore.commissions alter column created_at set default now();
alter table geg_singapore.commissions alter column currency set default 'USD'::text;
alter table geg_singapore.commissions alter column id set default gen_random_uuid();
alter table geg_singapore.commissions alter column status set default 'pending'::text;
alter table geg_singapore.contacts alter column created_at set default now();
alter table geg_singapore.contacts alter column id set default gen_random_uuid();
alter table geg_singapore.contacts alter column is_primary set default false;
alter table geg_singapore.deals alter column created_at set default now();
alter table geg_singapore.deals alter column currency set default 'USD'::text;
alter table geg_singapore.deals alter column id set default gen_random_uuid();
alter table geg_singapore.deals alter column stage set default 'lead'::text;
alter table geg_singapore.deals alter column status set default 'open'::text;
alter table geg_singapore.deals alter column updated_at set default now();
alter table geg_singapore.delivery_note_lines alter column id set default gen_random_uuid();
alter table geg_singapore.delivery_note_lines alter column "position" set default 0;
alter table geg_singapore.delivery_note_lines alter column quantity set default 1;
alter table geg_singapore.delivery_notes alter column created_at set default now();
alter table geg_singapore.delivery_notes alter column id set default gen_random_uuid();
alter table geg_singapore.delivery_notes alter column status set default 'draft'::text;
alter table geg_singapore.document_categories alter column color set default '#6366f1'::text;
alter table geg_singapore.document_categories alter column created_at set default now();
alter table geg_singapore.document_categories alter column id set default gen_random_uuid();
alter table geg_singapore.documents alter column created_at set default now();
alter table geg_singapore.documents alter column id set default gen_random_uuid();
alter table geg_singapore.employees alter column commission_rate set default 0;
alter table geg_singapore.employees alter column created_at set default now();
alter table geg_singapore.employees alter column id set default gen_random_uuid();
alter table geg_singapore.employees alter column is_active set default true;
alter table geg_singapore.exchange_rates alter column created_at set default now();
alter table geg_singapore.exchange_rates alter column effective_date set default CURRENT_DATE;
alter table geg_singapore.exchange_rates alter column id set default gen_random_uuid();
alter table geg_singapore.invoice_lines alter column created_at set default now();
alter table geg_singapore.invoice_lines alter column discount set default 0;
alter table geg_singapore.invoice_lines alter column id set default gen_random_uuid();
alter table geg_singapore.invoice_lines alter column "position" set default 0;
alter table geg_singapore.invoice_lines alter column quantity set default 1;
alter table geg_singapore.invoice_lines alter column tva_rate set default 0;
alter table geg_singapore.invoice_lines alter column unit_price set default 0;
alter table geg_singapore.invoices alter column balance set default 0;
alter table geg_singapore.invoices alter column created_at set default now();
alter table geg_singapore.invoices alter column currency set default 'USD'::text;
alter table geg_singapore.invoices alter column id set default gen_random_uuid();
alter table geg_singapore.invoices alter column issue_date set default CURRENT_DATE;
alter table geg_singapore.invoices alter column status set default 'draft'::text;
alter table geg_singapore.invoices alter column total_ht set default 0;
alter table geg_singapore.invoices alter column total_paid set default 0;
alter table geg_singapore.invoices alter column updated_at set default now();
alter table geg_singapore.payments alter column created_at set default now();
alter table geg_singapore.payments alter column currency set default 'USD'::text;
alter table geg_singapore.payments alter column id set default gen_random_uuid();
alter table geg_singapore.payments alter column method set default 'virement'::text;
alter table geg_singapore.payments alter column paid_at set default CURRENT_DATE;
alter table geg_singapore.product_categories alter column color set default '#6366f1'::text;
alter table geg_singapore.product_categories alter column created_at set default now();
alter table geg_singapore.product_categories alter column id set default gen_random_uuid();
alter table geg_singapore.product_documents alter column created_at set default now();
alter table geg_singapore.product_documents alter column id set default gen_random_uuid();
alter table geg_singapore.product_documents alter column type set default 'other'::text;
alter table geg_singapore.products alter column buy_price_currency set default 'USD'::text;
alter table geg_singapore.products alter column can_be_purchased set default true;
alter table geg_singapore.products alter column can_be_sold set default true;
alter table geg_singapore.products alter column created_at set default now();
alter table geg_singapore.products alter column currency set default 'USD'::text;
alter table geg_singapore.products alter column id set default gen_random_uuid();
alter table geg_singapore.products alter column is_active set default true;
alter table geg_singapore.products alter column product_type set default 'consumable'::text;
alter table geg_singapore.products alter column tva_achat set default 18;
alter table geg_singapore.products alter column tva_vente set default 18;
alter table geg_singapore.purchase_costs alter column amount set default 0;
alter table geg_singapore.purchase_costs alter column currency set default 'USD'::text;
alter table geg_singapore.purchase_costs alter column id set default gen_random_uuid();
alter table geg_singapore.purchase_costs alter column "position" set default 0;
alter table geg_singapore.purchase_order_lines alter column id set default gen_random_uuid();
alter table geg_singapore.purchase_order_lines alter column "position" set default 0;
alter table geg_singapore.purchase_order_lines alter column quantity set default 1;
alter table geg_singapore.purchase_order_lines alter column unit_price set default 0;
alter table geg_singapore.purchase_orders alter column created_at set default now();
alter table geg_singapore.purchase_orders alter column currency set default 'USD'::text;
alter table geg_singapore.purchase_orders alter column global_discount_pct set default 0;
alter table geg_singapore.purchase_orders alter column id set default gen_random_uuid();
alter table geg_singapore.purchase_orders alter column order_date set default CURRENT_DATE;
alter table geg_singapore.purchase_orders alter column status set default 'draft'::text;
alter table geg_singapore.purchase_orders alter column total set default 0;
alter table geg_singapore.purchase_reception_lines alter column id set default gen_random_uuid();
alter table geg_singapore.purchase_reception_lines alter column quantity set default 0;
alter table geg_singapore.purchase_reception_lines alter column unit_price set default 0;
alter table geg_singapore.purchase_receptions alter column created_at set default now();
alter table geg_singapore.purchase_receptions alter column id set default gen_random_uuid();
alter table geg_singapore.purchase_receptions alter column received_at set default CURRENT_DATE;
alter table geg_singapore.sales_order_lines alter column created_at set default now();
alter table geg_singapore.sales_order_lines alter column discount set default 0;
alter table geg_singapore.sales_order_lines alter column id set default gen_random_uuid();
alter table geg_singapore.sales_order_lines alter column "position" set default 0;
alter table geg_singapore.sales_order_lines alter column quantity set default 1;
alter table geg_singapore.sales_order_lines alter column tva_exempt set default false;
alter table geg_singapore.sales_order_lines alter column unit_price set default 0;
alter table geg_singapore.sales_orders alter column created_at set default now();
alter table geg_singapore.sales_orders alter column currency set default 'USD'::text;
alter table geg_singapore.sales_orders alter column date_order set default CURRENT_DATE;
alter table geg_singapore.sales_orders alter column id set default gen_random_uuid();
alter table geg_singapore.sales_orders alter column payment_terms set default '30 jours'::text;
alter table geg_singapore.sales_orders alter column status set default 'draft'::text;
alter table geg_singapore.sales_orders alter column tva set default true;
alter table geg_singapore.shipments alter column created_at set default now();
alter table geg_singapore.shipments alter column id set default gen_random_uuid();
alter table geg_singapore.shipments alter column status set default 'pending'::text;
alter table geg_singapore.stock_levels alter column id set default gen_random_uuid();
alter table geg_singapore.stock_levels alter column quantity set default 0;
alter table geg_singapore.stock_moves alter column created_at set default now();
alter table geg_singapore.stock_moves alter column date set default CURRENT_DATE;
alter table geg_singapore.stock_moves alter column id set default gen_random_uuid();
alter table geg_singapore.supplier_invoice_lines alter column id set default gen_random_uuid();
alter table geg_singapore.supplier_invoice_lines alter column "position" set default 0;
alter table geg_singapore.supplier_invoice_lines alter column quantity set default 1;
alter table geg_singapore.supplier_invoice_lines alter column tax_rate set default 0;
alter table geg_singapore.supplier_invoice_lines alter column unit_price set default 0;
alter table geg_singapore.supplier_invoices alter column balance set default 0;
alter table geg_singapore.supplier_invoices alter column created_at set default now();
alter table geg_singapore.supplier_invoices alter column currency set default 'USD'::text;
alter table geg_singapore.supplier_invoices alter column id set default gen_random_uuid();
alter table geg_singapore.supplier_invoices alter column invoice_date set default CURRENT_DATE;
alter table geg_singapore.supplier_invoices alter column status set default 'draft'::text;
alter table geg_singapore.supplier_invoices alter column tax_amount set default 0;
alter table geg_singapore.supplier_invoices alter column total_ht set default 0;
alter table geg_singapore.supplier_invoices alter column total_ttc set default 0;
alter table geg_singapore.supplier_invoices alter column updated_at set default now();
alter table geg_singapore.supplier_payments alter column created_at set default now();
alter table geg_singapore.supplier_payments alter column currency set default 'USD'::text;
alter table geg_singapore.supplier_payments alter column id set default gen_random_uuid();
alter table geg_singapore.supplier_payments alter column method set default 'virement'::text;
alter table geg_singapore.supplier_payments alter column paid_at set default CURRENT_DATE;
alter table geg_singapore.suppliers alter column created_at set default now();
alter table geg_singapore.suppliers alter column currency set default 'USD'::text;
alter table geg_singapore.suppliers alter column id set default gen_random_uuid();
alter table geg_singapore.suppliers alter column is_active set default true;
alter table geg_singapore.suppliers alter column updated_at set default now();
alter table geg_singapore.treasury_accounts alter column color set default '#3b82f6'::text;
alter table geg_singapore.treasury_accounts alter column created_at set default now();
alter table geg_singapore.treasury_accounts alter column currency set default 'USD'::text;
alter table geg_singapore.treasury_accounts alter column id set default gen_random_uuid();
alter table geg_singapore.treasury_accounts alter column initial_balance set default 0;
alter table geg_singapore.treasury_accounts alter column is_active set default true;
alter table geg_singapore.treasury_accounts alter column total_in set default 0;
alter table geg_singapore.treasury_accounts alter column total_out set default 0;
alter table geg_singapore.treasury_accounts alter column type set default 'bank'::text;
alter table geg_singapore.treasury_transactions alter column created_at set default now();
alter table geg_singapore.treasury_transactions alter column currency set default 'USD'::text;
alter table geg_singapore.treasury_transactions alter column date set default CURRENT_DATE;
alter table geg_singapore.treasury_transactions alter column id set default gen_random_uuid();
alter table geg_singapore.units alter column created_at set default now();
alter table geg_singapore.units alter column id set default gen_random_uuid();
alter table geg_singapore.warehouses alter column created_at set default now();
alter table geg_singapore.warehouses alter column id set default gen_random_uuid();
alter table geg_singapore.warehouses alter column is_active set default true;
alter table public.accounts alter column country set default 'Guinée'::text;
alter table public.accounts alter column created_at set default now();
alter table public.accounts alter column id set default extensions.uuid_generate_v4();
alter table public.accounts alter column is_supplier set default false;
alter table public.accounts alter column supplier_currency set default 'USD'::text;
alter table public.accounts alter column updated_at set default now();
alter table public.activities alter column completed set default false;
alter table public.activities alter column created_at set default now();
alter table public.activities alter column date set default now();
alter table public.activities alter column id set default extensions.uuid_generate_v4();
alter table public.commissions alter column created_at set default now();
alter table public.commissions alter column currency set default 'GNF'::text;
alter table public.commissions alter column id set default gen_random_uuid();
alter table public.commissions alter column rate set default 0;
alter table public.commissions alter column status set default 'pending'::text;
alter table public.companies alter column created_at set default now();
alter table public.companies alter column currency set default 'GNF'::text;
alter table public.companies alter column id set default gen_random_uuid();
alter table public.companies alter column is_active set default true;
alter table public.contacts alter column created_at set default now();
alter table public.contacts alter column id set default extensions.uuid_generate_v4();
alter table public.contacts alter column is_primary set default false;
alter table public.contacts alter column updated_at set default now();
alter table public.deals alter column created_at set default now();
alter table public.deals alter column currency set default 'USD'::text;
alter table public.deals alter column id set default extensions.uuid_generate_v4();
alter table public.deals alter column priority set default 'normal'::text;
alter table public.deals alter column source set default 'other'::text;
alter table public.deals alter column stage set default 'lead'::text;
alter table public.deals alter column updated_at set default now();
alter table public.document_categories alter column color set default '#6366f1'::text;
alter table public.document_categories alter column created_at set default now();
alter table public.document_categories alter column id set default gen_random_uuid();
alter table public.document_settings alter column brand_color set default '#2563eb'::text;
alter table public.document_settings alter column country set default 'Guinée'::text;
alter table public.document_settings alter column created_at set default now();
alter table public.document_settings alter column devis_prefix set default 'DEV'::text;
alter table public.document_settings alter column id set default gen_random_uuid();
alter table public.document_settings alter column invoice_prefix set default 'FAC'::text;
alter table public.document_settings alter column layout_config set default '{}'::jsonb;
alter table public.document_settings alter column po_prefix set default 'CMD'::text;
alter table public.document_settings alter column updated_at set default now();
alter table public.document_tokens alter column created_at set default now();
alter table public.document_tokens alter column token set default gen_random_uuid();
alter table public.documents alter column created_at set default now();
alter table public.documents alter column id set default gen_random_uuid();
alter table public.documents alter column updated_at set default now();
alter table public.employees alter column commission_rate set default 0;
alter table public.employees alter column created_at set default now();
alter table public.employees alter column id set default gen_random_uuid();
alter table public.employees alter column is_active set default true;
alter table public.employees alter column salary_currency set default 'GNF'::text;
alter table public.employees alter column start_date set default CURRENT_DATE;
alter table public.exchange_rates alter column created_at set default now();
alter table public.exchange_rates alter column effective_date set default CURRENT_DATE;
alter table public.exchange_rates alter column id set default gen_random_uuid();
alter table public.invoice_lines alter column discount set default 0;
alter table public.invoice_lines alter column id set default extensions.uuid_generate_v4();
alter table public.invoice_lines alter column "position" set default 0;
alter table public.invoice_lines alter column quantity set default 1;
alter table public.invoice_lines alter column unit_price set default 0;
alter table public.invoices alter column created_at set default now();
alter table public.invoices alter column currency set default 'USD'::text;
alter table public.invoices alter column id set default extensions.uuid_generate_v4();
alter table public.invoices alter column issue_date set default CURRENT_DATE;
alter table public.invoices alter column status set default 'draft'::text;
alter table public.invoices alter column updated_at set default now();
alter table public.notifications alter column body set default ''::text;
alter table public.notifications alter column created_at set default now();
alter table public.notifications alter column id set default extensions.uuid_generate_v4();
alter table public.notifications alter column read set default false;
alter table public.notifications alter column type set default 'info'::text;
alter table public.payments alter column created_at set default now();
alter table public.payments alter column currency set default 'USD'::text;
alter table public.payments alter column id set default extensions.uuid_generate_v4();
alter table public.payments alter column method set default 'bank'::text;
alter table public.payments alter column paid_at set default now();
alter table public.product_categories alter column color set default 'blue'::text;
alter table public.product_categories alter column created_at set default now();
alter table public.product_categories alter column id set default extensions.uuid_generate_v4();
alter table public.products alter column buy_price_currency set default 'GNF'::text;
alter table public.products alter column created_at set default now();
alter table public.products alter column currency set default 'USD'::text;
alter table public.products alter column id set default extensions.uuid_generate_v4();
alter table public.products alter column is_active set default true;
alter table public.products alter column updated_at set default now();
alter table public.profiles alter column company_access set default '{}'::uuid[];
alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column permissions set default '{"deals": {"edit": true, "view": true, "create": true, "delete": false}, "stock": {"edit": true, "view": true, "create": true, "delete": false}, "achats": {"edit": true, "view": true, "create": true, "delete": false}, "ventes": {"edit": true, "view": true, "create": true, "delete": false}, "accounts": {"edit": true, "view": true, "create": true, "delete": false}, "contacts": {"edit": true, "view": true, "create": true, "delete": false}, "employes": {"edit": false, "view": true, "create": false, "delete": false}, "dashboard": {"edit": false, "view": true, "create": false, "delete": false}, "documents": {"edit": true, "view": true, "create": true, "delete": false}, "activities": {"edit": true, "view": true, "create": true, "delete": false}, "parametres": {"edit": false, "view": false, "create": false, "delete": false}, "comptabilite": {"edit": false, "view": true, "create": false, "delete": false}}'::jsonb;
alter table public.profiles alter column role set default 'sales_rep'::text;
alter table public.profiles alter column updated_at set default now();
alter table public.purchase_costs alter column amount set default 0;
alter table public.purchase_costs alter column currency set default 'USD'::text;
alter table public.purchase_costs alter column id set default extensions.uuid_generate_v4();
alter table public.purchase_order_lines alter column fob_unit_price set default 0;
alter table public.purchase_order_lines alter column id set default extensions.uuid_generate_v4();
alter table public.purchase_order_lines alter column "position" set default 0;
alter table public.purchase_order_lines alter column quantity set default 1;
alter table public.purchase_orders alter column created_at set default now();
alter table public.purchase_orders alter column currency set default 'USD'::text;
alter table public.purchase_orders alter column freight_cost set default 0;
alter table public.purchase_orders alter column global_discount_pct set default 0;
alter table public.purchase_orders alter column id set default extensions.uuid_generate_v4();
alter table public.purchase_orders alter column incoterm set default 'FOB'::text;
alter table public.purchase_orders alter column insurance_cost set default 0;
alter table public.purchase_orders alter column order_date set default CURRENT_DATE;
alter table public.purchase_orders alter column status set default 'draft'::text;
alter table public.purchase_orders alter column updated_at set default now();
alter table public.push_subscriptions alter column created_at set default now();
alter table public.push_subscriptions alter column id set default gen_random_uuid();
alter table public.sales_order_lines alter column discount set default 0;
alter table public.sales_order_lines alter column id set default extensions.uuid_generate_v4();
alter table public.sales_order_lines alter column "position" set default 0;
alter table public.sales_order_lines alter column quantity set default 1;
alter table public.sales_order_lines alter column unit_price set default 0;
alter table public.sales_orders alter column created_at set default now();
alter table public.sales_orders alter column currency set default 'USD'::text;
alter table public.sales_orders alter column id set default extensions.uuid_generate_v4();
alter table public.sales_orders alter column status set default 'draft'::text;
alter table public.sales_orders alter column updated_at set default now();
alter table public.stock_levels alter column id set default extensions.uuid_generate_v4();
alter table public.stock_levels alter column quantity set default 0;
alter table public.stock_levels alter column updated_at set default now();
alter table public.stock_moves alter column created_at set default now();
alter table public.stock_moves alter column date set default now();
alter table public.stock_moves alter column id set default extensions.uuid_generate_v4();
alter table public.treasury_accounts alter column color set default 'blue'::text;
alter table public.treasury_accounts alter column created_at set default now();
alter table public.treasury_accounts alter column currency set default 'GNF'::text;
alter table public.treasury_accounts alter column id set default extensions.uuid_generate_v4();
alter table public.treasury_accounts alter column initial_balance set default 0;
alter table public.treasury_accounts alter column is_active set default true;
alter table public.treasury_transactions alter column created_at set default now();
alter table public.treasury_transactions alter column currency set default 'GNF'::text;
alter table public.treasury_transactions alter column date set default now();
alter table public.treasury_transactions alter column id set default extensions.uuid_generate_v4();
alter table public.units alter column id set default extensions.uuid_generate_v4();
alter table public.units alter column type set default 'volume'::text;
alter table public.warehouses alter column created_at set default now();
alter table public.warehouses alter column id set default extensions.uuid_generate_v4();
alter table public.warehouses alter column is_active set default true;

-- Primary keys, unique and check constraints ------------------------------------------------------------
alter table geg_guinee.accounts add constraint accounts_pkey PRIMARY KEY (id);
alter table geg_guinee.accounts add constraint accounts_type_check CHECK ((type = ANY (ARRAY['government'::text, 'enterprise'::text, 'sme'::text, 'client'::text, 'prospect'::text])));
alter table geg_guinee.activities add constraint activities_pkey PRIMARY KEY (id);
alter table geg_guinee.activities add constraint activities_type_check CHECK ((type = ANY (ARRAY['call'::text, 'meeting'::text, 'email'::text, 'note'::text])));
alter table geg_guinee.activity_logs add constraint activity_logs_pkey PRIMARY KEY (id);
alter table geg_guinee.chat_messages add constraint chat_messages_pkey PRIMARY KEY (id);
alter table geg_guinee.chat_read_receipts add constraint chat_read_receipts_pkey PRIMARY KEY (user_id, room_id);
alter table geg_guinee.chat_rooms add constraint chat_rooms_pkey PRIMARY KEY (id);
alter table geg_guinee.commissions add constraint commissions_pkey PRIMARY KEY (id);
alter table geg_guinee.commissions add constraint commissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text])));
alter table geg_guinee.contacts add constraint contacts_pkey PRIMARY KEY (id);
alter table geg_guinee.deal_costs add constraint deal_costs_pkey PRIMARY KEY (id);
alter table geg_guinee.deal_costs add constraint deal_costs_type_check CHECK ((type = ANY (ARRAY['commission'::text, 'transport'::text, 'achat'::text, 'autre'::text])));
alter table geg_guinee.deals add constraint deals_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'GNF'::text, 'EUR'::text])));
alter table geg_guinee.deals add constraint deals_pkey PRIMARY KEY (id);
alter table geg_guinee.deals add constraint deals_priority_check CHECK ((priority = ANY (ARRAY['normal'::text, 'urgent'::text])));
alter table geg_guinee.deals add constraint deals_probability_check CHECK (((probability >= 0) AND (probability <= 100)));
alter table geg_guinee.deals add constraint deals_stage_check CHECK ((stage = ANY (ARRAY['lead'::text, 'qualified'::text, 'proposal'::text, 'negotiation'::text, 'won'::text, 'lost'::text])));
alter table geg_guinee.delivery_note_lines add constraint delivery_note_lines_pkey PRIMARY KEY (id);
alter table geg_guinee.delivery_notes add constraint delivery_notes_pkey PRIMARY KEY (id);
alter table geg_guinee.delivery_notes add constraint delivery_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'delivered'::text, 'cancelled'::text])));
alter table geg_guinee.document_categories add constraint document_categories_pkey PRIMARY KEY (id);
alter table geg_guinee.documents add constraint documents_pkey PRIMARY KEY (id);
alter table geg_guinee.employees add constraint employees_commission_rate_check CHECK (((commission_rate >= (0)::numeric) AND (commission_rate <= (100)::numeric)));
alter table geg_guinee.employees add constraint employees_pkey PRIMARY KEY (id);
alter table geg_guinee.employees add constraint employees_salary_currency_check CHECK ((salary_currency = ANY (ARRAY['GNF'::text, 'USD'::text, 'EUR'::text])));
alter table geg_guinee.exchange_rates add constraint different_currencies CHECK ((from_currency <> to_currency));
alter table geg_guinee.exchange_rates add constraint exchange_rates_from_currency_check CHECK ((from_currency = ANY (ARRAY['GNF'::text, 'USD'::text, 'EUR'::text, 'XOF'::text])));
alter table geg_guinee.exchange_rates add constraint exchange_rates_pkey PRIMARY KEY (id);
alter table geg_guinee.exchange_rates add constraint exchange_rates_rate_check CHECK ((rate > (0)::numeric));
alter table geg_guinee.exchange_rates add constraint exchange_rates_to_currency_check CHECK ((to_currency = ANY (ARRAY['GNF'::text, 'USD'::text, 'EUR'::text, 'XOF'::text])));
alter table geg_guinee.invoice_lines add constraint invoice_lines_discount_check CHECK (((discount >= (0)::numeric) AND (discount <= (100)::numeric)));
alter table geg_guinee.invoice_lines add constraint invoice_lines_pkey PRIMARY KEY (id);
alter table geg_guinee.invoices add constraint invoices_currency_check CHECK ((currency = ANY (ARRAY['GNF'::text, 'USD'::text, 'EUR'::text, 'XOF'::text])));
alter table geg_guinee.invoices add constraint invoices_number_key UNIQUE (number);
alter table geg_guinee.invoices add constraint invoices_pkey PRIMARY KEY (id);
alter table geg_guinee.invoices add constraint invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'partial'::text, 'paid'::text, 'cancelled'::text])));
alter table geg_guinee.payments add constraint payments_amount_check CHECK ((amount > (0)::numeric));
alter table geg_guinee.payments add constraint payments_currency_check CHECK ((currency = ANY (ARRAY['GNF'::text, 'USD'::text, 'EUR'::text, 'XOF'::text])));
alter table geg_guinee.payments add constraint payments_method_check CHECK ((method = ANY (ARRAY['cash'::text, 'bank'::text, 'mobile'::text, 'cheque'::text, 'other'::text])));
alter table geg_guinee.payments add constraint payments_pkey PRIMARY KEY (id);
alter table geg_guinee.product_categories add constraint product_categories_pkey PRIMARY KEY (id);
alter table geg_guinee.product_documents add constraint product_documents_pkey PRIMARY KEY (id);
alter table geg_guinee.product_documents add constraint product_documents_type_check CHECK ((type = ANY (ARRAY['technical_sheet'::text, 'safety_data_sheet'::text, 'other'::text])));
alter table geg_guinee.product_packaging add constraint product_packaging_pkey PRIMARY KEY (id);
alter table geg_guinee.product_packaging add constraint product_packaging_product_id_unit_id_key UNIQUE (product_id, unit_id);
alter table geg_guinee.products add constraint products_buy_price_currency_check CHECK ((buy_price_currency = ANY (ARRAY['USD'::text, 'EUR'::text, 'GNF'::text])));
alter table geg_guinee.products add constraint products_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'GNF'::text, 'EUR'::text])));
alter table geg_guinee.products add constraint products_pkey PRIMARY KEY (id);
alter table geg_guinee.products add constraint products_product_code_key UNIQUE (product_code);
alter table geg_guinee.products add constraint products_product_type_check CHECK ((product_type = ANY (ARRAY['consumable'::text, 'service'::text, 'storable'::text])));
alter table geg_guinee.products add constraint products_reference_key UNIQUE (reference);
alter table geg_guinee.purchase_costs add constraint purchase_costs_pkey PRIMARY KEY (id);
alter table geg_guinee.purchase_costs add constraint purchase_costs_type_check CHECK ((type = ANY (ARRAY['transport_maritime'::text, 'transport_routier'::text, 'douane'::text, 'tva_avance'::text, 'transport_entrepot'::text, 'dechargement'::text, 'autre'::text])));
alter table geg_guinee.purchase_order_events add constraint purchase_order_events_pkey PRIMARY KEY (id);
alter table geg_guinee.purchase_order_lines add constraint purchase_order_lines_pkey PRIMARY KEY (id);
alter table geg_guinee.purchase_orders add constraint purchase_orders_currency_check CHECK ((currency = ANY (ARRAY['GNF'::text, 'USD'::text, 'EUR'::text, 'XOF'::text])));
alter table geg_guinee.purchase_orders add constraint purchase_orders_incoterm_check CHECK ((incoterm = ANY (ARRAY['EXW'::text, 'FOB'::text, 'CFR'::text, 'CIF'::text, 'DDP'::text])));
alter table geg_guinee.purchase_orders add constraint purchase_orders_number_key UNIQUE (number);
alter table geg_guinee.purchase_orders add constraint purchase_orders_pkey PRIMARY KEY (id);
alter table geg_guinee.purchase_orders add constraint purchase_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'confirmed'::text, 'ordered'::text, 'in_transit'::text, 'partial'::text, 'received'::text, 'cancelled'::text])));
alter table geg_guinee.purchase_reception_lines add constraint purchase_reception_lines_pkey PRIMARY KEY (id);
alter table geg_guinee.purchase_receptions add constraint purchase_receptions_pkey PRIMARY KEY (id);
alter table geg_guinee.sales_order_lines add constraint sales_order_lines_discount_check CHECK (((discount >= (0)::numeric) AND (discount <= (100)::numeric)));
alter table geg_guinee.sales_order_lines add constraint sales_order_lines_pkey PRIMARY KEY (id);
alter table geg_guinee.sales_orders add constraint sales_orders_currency_check CHECK ((currency = ANY (ARRAY['GNF'::text, 'USD'::text, 'EUR'::text, 'XOF'::text])));
alter table geg_guinee.sales_orders add constraint sales_orders_number_key UNIQUE (number);
alter table geg_guinee.sales_orders add constraint sales_orders_pkey PRIMARY KEY (id);
alter table geg_guinee.sales_orders add constraint sales_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'invoiced'::text, 'cancelled'::text])));
alter table geg_guinee.shipments add constraint shipments_pkey PRIMARY KEY (id);
alter table geg_guinee.shipments add constraint shipments_status_check CHECK ((status = ANY (ARRAY['in_transit'::text, 'arrived'::text, 'delayed'::text, 'delivered'::text])));
alter table geg_guinee.shipments add constraint shipments_type_check CHECK ((type = ANY (ARRAY['container'::text, 'parcel'::text])));
alter table geg_guinee.stock_levels add constraint stock_levels_pkey PRIMARY KEY (id);
alter table geg_guinee.stock_levels add constraint stock_levels_product_id_warehouse_id_key UNIQUE (product_id, warehouse_id);
alter table geg_guinee.stock_moves add constraint stock_moves_pkey PRIMARY KEY (id);
alter table geg_guinee.stock_moves add constraint stock_moves_quantity_check CHECK ((quantity > (0)::numeric));
alter table geg_guinee.stock_moves add constraint stock_moves_type_check CHECK ((type = ANY (ARRAY['in'::text, 'out'::text, 'transfer'::text, 'adjustment'::text, 'damaged'::text, 'lost'::text, 'destroyed'::text])));
alter table geg_guinee.supplier_invoice_lines add constraint supplier_invoice_lines_pkey PRIMARY KEY (id);
alter table geg_guinee.supplier_invoices add constraint supplier_invoices_number_key UNIQUE (number);
alter table geg_guinee.supplier_invoices add constraint supplier_invoices_pkey PRIMARY KEY (id);
alter table geg_guinee.supplier_payments add constraint supplier_payments_pkey PRIMARY KEY (id);
alter table geg_guinee.suppliers add constraint suppliers_pkey PRIMARY KEY (id);
alter table geg_guinee.treasury_accounts add constraint treasury_accounts_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'GNF'::text, 'EUR'::text])));
alter table geg_guinee.treasury_accounts add constraint treasury_accounts_pkey PRIMARY KEY (id);
alter table geg_guinee.treasury_accounts add constraint treasury_accounts_type_check CHECK ((type = ANY (ARRAY['bank'::text, 'mobile_money'::text, 'cash'::text])));
alter table geg_guinee.treasury_transactions add constraint treasury_transactions_amount_check CHECK ((amount > (0)::numeric));
alter table geg_guinee.treasury_transactions add constraint treasury_transactions_pkey PRIMARY KEY (id);
alter table geg_guinee.treasury_transactions add constraint treasury_transactions_type_check CHECK ((type = ANY (ARRAY['credit'::text, 'debit'::text, 'transfer_in'::text, 'transfer_out'::text])));
alter table geg_guinee.units add constraint units_pkey PRIMARY KEY (id);
alter table geg_guinee.units add constraint units_type_check CHECK ((type = ANY (ARRAY['volume'::text, 'weight'::text, 'unit'::text])));
alter table geg_guinee.warehouses add constraint warehouses_pkey PRIMARY KEY (id);
alter table geg_singapore.accounts add constraint accounts_pkey PRIMARY KEY (id);
alter table geg_singapore.accounts add constraint accounts_type_check CHECK ((type = ANY (ARRAY['government'::text, 'enterprise'::text, 'sme'::text, 'client'::text, 'prospect'::text])));
alter table geg_singapore.activities add constraint activities_pkey PRIMARY KEY (id);
alter table geg_singapore.activity_logs add constraint activity_logs_pkey PRIMARY KEY (id);
alter table geg_singapore.chat_messages add constraint chat_messages_pkey PRIMARY KEY (id);
alter table geg_singapore.chat_read_receipts add constraint chat_read_receipts_pkey PRIMARY KEY (id);
alter table geg_singapore.chat_read_receipts add constraint chat_read_receipts_user_id_room_id_key UNIQUE (user_id, room_id);
alter table geg_singapore.chat_rooms add constraint chat_rooms_pkey PRIMARY KEY (id);
alter table geg_singapore.commissions add constraint commissions_pkey PRIMARY KEY (id);
alter table geg_singapore.contacts add constraint contacts_pkey PRIMARY KEY (id);
alter table geg_singapore.deals add constraint deals_pkey PRIMARY KEY (id);
alter table geg_singapore.delivery_note_lines add constraint delivery_note_lines_pkey PRIMARY KEY (id);
alter table geg_singapore.delivery_notes add constraint delivery_notes_number_key UNIQUE (number);
alter table geg_singapore.delivery_notes add constraint delivery_notes_pkey PRIMARY KEY (id);
alter table geg_singapore.document_categories add constraint document_categories_pkey PRIMARY KEY (id);
alter table geg_singapore.documents add constraint documents_pkey PRIMARY KEY (id);
alter table geg_singapore.employees add constraint employees_pkey PRIMARY KEY (id);
alter table geg_singapore.exchange_rates add constraint exchange_rates_pkey PRIMARY KEY (id);
alter table geg_singapore.invoice_lines add constraint invoice_lines_pkey PRIMARY KEY (id);
alter table geg_singapore.invoices add constraint invoices_number_key UNIQUE (number);
alter table geg_singapore.invoices add constraint invoices_pkey PRIMARY KEY (id);
alter table geg_singapore.payments add constraint payments_pkey PRIMARY KEY (id);
alter table geg_singapore.product_categories add constraint product_categories_pkey PRIMARY KEY (id);
alter table geg_singapore.product_documents add constraint product_documents_pkey PRIMARY KEY (id);
alter table geg_singapore.products add constraint products_pkey PRIMARY KEY (id);
alter table geg_singapore.purchase_costs add constraint purchase_costs_pkey PRIMARY KEY (id);
alter table geg_singapore.purchase_order_lines add constraint purchase_order_lines_pkey PRIMARY KEY (id);
alter table geg_singapore.purchase_orders add constraint purchase_orders_number_key UNIQUE (number);
alter table geg_singapore.purchase_orders add constraint purchase_orders_pkey PRIMARY KEY (id);
alter table geg_singapore.purchase_reception_lines add constraint purchase_reception_lines_pkey PRIMARY KEY (id);
alter table geg_singapore.purchase_receptions add constraint purchase_receptions_number_key UNIQUE (number);
alter table geg_singapore.purchase_receptions add constraint purchase_receptions_pkey PRIMARY KEY (id);
alter table geg_singapore.sales_order_lines add constraint sales_order_lines_pkey PRIMARY KEY (id);
alter table geg_singapore.sales_orders add constraint sales_orders_number_key UNIQUE (number);
alter table geg_singapore.sales_orders add constraint sales_orders_pkey PRIMARY KEY (id);
alter table geg_singapore.shipments add constraint shipments_pkey PRIMARY KEY (id);
alter table geg_singapore.stock_levels add constraint stock_levels_pkey PRIMARY KEY (id);
alter table geg_singapore.stock_levels add constraint stock_levels_product_id_warehouse_id_key UNIQUE (product_id, warehouse_id);
alter table geg_singapore.stock_moves add constraint stock_moves_pkey PRIMARY KEY (id);
alter table geg_singapore.supplier_invoice_lines add constraint supplier_invoice_lines_pkey PRIMARY KEY (id);
alter table geg_singapore.supplier_invoices add constraint supplier_invoices_pkey PRIMARY KEY (id);
alter table geg_singapore.supplier_payments add constraint supplier_payments_pkey PRIMARY KEY (id);
alter table geg_singapore.suppliers add constraint suppliers_pkey PRIMARY KEY (id);
alter table geg_singapore.treasury_accounts add constraint treasury_accounts_pkey PRIMARY KEY (id);
alter table geg_singapore.treasury_transactions add constraint treasury_transactions_pkey PRIMARY KEY (id);
alter table geg_singapore.units add constraint units_pkey PRIMARY KEY (id);
alter table geg_singapore.warehouses add constraint warehouses_pkey PRIMARY KEY (id);
alter table public.accounts add constraint accounts_pkey PRIMARY KEY (id);
alter table public.accounts add constraint accounts_type_check CHECK ((type = ANY (ARRAY['government'::text, 'enterprise'::text, 'sme'::text])));
alter table public.activities add constraint activities_pkey PRIMARY KEY (id);
alter table public.activities add constraint activities_type_check CHECK ((type = ANY (ARRAY['call'::text, 'meeting'::text, 'email'::text, 'note'::text])));
alter table public.commissions add constraint commissions_pkey PRIMARY KEY (id);
alter table public.commissions add constraint commissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text])));
alter table public.companies add constraint companies_pkey PRIMARY KEY (id);
alter table public.companies add constraint companies_schema_name_key UNIQUE (schema_name);
alter table public.contacts add constraint contacts_pkey PRIMARY KEY (id);
alter table public.deals add constraint deals_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'GNF'::text, 'EUR'::text])));
alter table public.deals add constraint deals_pkey PRIMARY KEY (id);
alter table public.deals add constraint deals_probability_check CHECK (((probability >= 0) AND (probability <= 100)));
alter table public.deals add constraint deals_stage_check CHECK ((stage = ANY (ARRAY['lead'::text, 'qualified'::text, 'proposal'::text, 'negotiation'::text, 'won'::text, 'lost'::text])));
alter table public.document_categories add constraint document_categories_pkey PRIMARY KEY (id);
alter table public.document_settings add constraint document_settings_company_id_key UNIQUE (company_id);
alter table public.document_settings add constraint document_settings_pkey PRIMARY KEY (id);
alter table public.document_tokens add constraint document_tokens_document_type_check CHECK ((document_type = ANY (ARRAY['facture'::text, 'devis'::text])));
alter table public.document_tokens add constraint document_tokens_pkey PRIMARY KEY (token);
alter table public.documents add constraint documents_pkey PRIMARY KEY (id);
alter table public.employees add constraint employees_commission_rate_check CHECK (((commission_rate >= (0)::numeric) AND (commission_rate <= (100)::numeric)));
alter table public.employees add constraint employees_pkey PRIMARY KEY (id);
alter table public.employees add constraint employees_salary_currency_check CHECK ((salary_currency = ANY (ARRAY['GNF'::text, 'USD'::text, 'EUR'::text])));
alter table public.exchange_rates add constraint different_currencies CHECK ((from_currency <> to_currency));
alter table public.exchange_rates add constraint exchange_rates_from_currency_check CHECK ((from_currency = ANY (ARRAY['USD'::text, 'EUR'::text, 'GNF'::text])));
alter table public.exchange_rates add constraint exchange_rates_pkey PRIMARY KEY (id);
alter table public.exchange_rates add constraint exchange_rates_rate_check CHECK ((rate > (0)::numeric));
alter table public.exchange_rates add constraint exchange_rates_to_currency_check CHECK ((to_currency = ANY (ARRAY['USD'::text, 'EUR'::text, 'GNF'::text])));
alter table public.invoice_lines add constraint invoice_lines_discount_check CHECK (((discount >= (0)::numeric) AND (discount <= (100)::numeric)));
alter table public.invoice_lines add constraint invoice_lines_pkey PRIMARY KEY (id);
alter table public.invoices add constraint invoices_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'GNF'::text, 'EUR'::text])));
alter table public.invoices add constraint invoices_number_key UNIQUE (number);
alter table public.invoices add constraint invoices_pkey PRIMARY KEY (id);
alter table public.invoices add constraint invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'partial'::text, 'paid'::text, 'cancelled'::text])));
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.payments add constraint payments_amount_check CHECK ((amount > (0)::numeric));
alter table public.payments add constraint payments_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'GNF'::text, 'EUR'::text])));
alter table public.payments add constraint payments_method_check CHECK ((method = ANY (ARRAY['cash'::text, 'bank'::text, 'mobile'::text, 'cheque'::text, 'other'::text])));
alter table public.payments add constraint payments_pkey PRIMARY KEY (id);
alter table public.product_categories add constraint product_categories_pkey PRIMARY KEY (id);
alter table public.products add constraint products_buy_price_currency_check CHECK ((buy_price_currency = ANY (ARRAY['USD'::text, 'EUR'::text, 'GNF'::text])));
alter table public.products add constraint products_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'GNF'::text, 'EUR'::text])));
alter table public.products add constraint products_pkey PRIMARY KEY (id);
alter table public.products add constraint products_reference_key UNIQUE (reference);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'sales_rep'::text])));
alter table public.purchase_costs add constraint purchase_costs_pkey PRIMARY KEY (id);
alter table public.purchase_costs add constraint purchase_costs_type_check CHECK ((type = ANY (ARRAY['transport_maritime'::text, 'transport_routier'::text, 'douane'::text, 'tva_avance'::text, 'transport_entrepot'::text, 'dechargement'::text, 'autre'::text])));
alter table public.purchase_order_lines add constraint purchase_order_lines_pkey PRIMARY KEY (id);
alter table public.purchase_orders add constraint purchase_orders_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'GNF'::text, 'EUR'::text])));
alter table public.purchase_orders add constraint purchase_orders_incoterm_check CHECK ((incoterm = ANY (ARRAY['EXW'::text, 'FOB'::text, 'CFR'::text, 'CIF'::text, 'DDP'::text])));
alter table public.purchase_orders add constraint purchase_orders_number_key UNIQUE (number);
alter table public.purchase_orders add constraint purchase_orders_pkey PRIMARY KEY (id);
alter table public.purchase_orders add constraint purchase_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'received'::text, 'cancelled'::text])));
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);
alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
alter table public.sales_order_lines add constraint sales_order_lines_discount_check CHECK (((discount >= (0)::numeric) AND (discount <= (100)::numeric)));
alter table public.sales_order_lines add constraint sales_order_lines_pkey PRIMARY KEY (id);
alter table public.sales_orders add constraint sales_orders_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'GNF'::text, 'EUR'::text])));
alter table public.sales_orders add constraint sales_orders_number_key UNIQUE (number);
alter table public.sales_orders add constraint sales_orders_pkey PRIMARY KEY (id);
alter table public.sales_orders add constraint sales_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'invoiced'::text, 'cancelled'::text])));
alter table public.stock_levels add constraint stock_levels_pkey PRIMARY KEY (id);
alter table public.stock_levels add constraint stock_levels_product_id_warehouse_id_key UNIQUE (product_id, warehouse_id);
alter table public.stock_moves add constraint stock_moves_pkey PRIMARY KEY (id);
alter table public.stock_moves add constraint stock_moves_quantity_check CHECK ((quantity > (0)::numeric));
alter table public.stock_moves add constraint stock_moves_type_check CHECK ((type = ANY (ARRAY['in'::text, 'out'::text, 'transfer'::text, 'adjustment'::text, 'damaged'::text, 'lost'::text, 'destroyed'::text])));
alter table public.treasury_accounts add constraint treasury_accounts_currency_check CHECK ((currency = ANY (ARRAY['USD'::text, 'GNF'::text, 'EUR'::text])));
alter table public.treasury_accounts add constraint treasury_accounts_pkey PRIMARY KEY (id);
alter table public.treasury_accounts add constraint treasury_accounts_type_check CHECK ((type = ANY (ARRAY['bank'::text, 'mobile_money'::text, 'cash'::text])));
alter table public.treasury_transactions add constraint treasury_transactions_amount_check CHECK ((amount > (0)::numeric));
alter table public.treasury_transactions add constraint treasury_transactions_pkey PRIMARY KEY (id);
alter table public.treasury_transactions add constraint treasury_transactions_type_check CHECK ((type = ANY (ARRAY['credit'::text, 'debit'::text, 'transfer_in'::text, 'transfer_out'::text])));
alter table public.units add constraint units_pkey PRIMARY KEY (id);
alter table public.units add constraint units_type_check CHECK ((type = ANY (ARRAY['volume'::text, 'weight'::text, 'unit'::text])));
alter table public.warehouses add constraint warehouses_pkey PRIMARY KEY (id);

-- Foreign keys ------------------------------------------------------------
alter table geg_guinee.accounts add constraint accounts_salesperson_fkey FOREIGN KEY (salesperson_id) REFERENCES geg_guinee.employees(id) ON DELETE SET NULL;
alter table geg_guinee.activities add constraint activities_account_fkey FOREIGN KEY (account_id) REFERENCES geg_guinee.accounts(id) ON DELETE SET NULL;
alter table geg_guinee.activities add constraint activities_contact_fkey FOREIGN KEY (contact_id) REFERENCES geg_guinee.contacts(id) ON DELETE SET NULL;
alter table geg_guinee.activities add constraint activities_deal_fkey FOREIGN KEY (deal_id) REFERENCES geg_guinee.deals(id) ON DELETE SET NULL;
alter table geg_guinee.activities add constraint activities_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table geg_guinee.activity_logs add constraint activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table geg_guinee.chat_messages add constraint chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES geg_guinee.chat_rooms(id) ON DELETE CASCADE;
alter table geg_guinee.chat_read_receipts add constraint chat_read_receipts_room_id_fkey FOREIGN KEY (room_id) REFERENCES geg_guinee.chat_rooms(id) ON DELETE CASCADE;
alter table geg_guinee.commissions add constraint comm_employee_fkey FOREIGN KEY (employee_id) REFERENCES geg_guinee.employees(id) ON DELETE SET NULL;
alter table geg_guinee.commissions add constraint comm_invoice_fkey FOREIGN KEY (invoice_id) REFERENCES geg_guinee.invoices(id) ON DELETE SET NULL;
alter table geg_guinee.commissions add constraint comm_sales_order_fkey FOREIGN KEY (sales_order_id) REFERENCES geg_guinee.sales_orders(id) ON DELETE SET NULL;
alter table geg_guinee.commissions add constraint comm_treasury_fkey FOREIGN KEY (treasury_transaction_id) REFERENCES geg_guinee.treasury_transactions(id) ON DELETE SET NULL;
alter table geg_guinee.contacts add constraint contacts_account_fkey FOREIGN KEY (account_id) REFERENCES geg_guinee.accounts(id) ON DELETE SET NULL;
alter table geg_guinee.deal_costs add constraint deal_costs_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES geg_guinee.deals(id) ON DELETE CASCADE;
alter table geg_guinee.deals add constraint deals_account_fkey FOREIGN KEY (account_id) REFERENCES geg_guinee.accounts(id) ON DELETE SET NULL;
alter table geg_guinee.deals add constraint deals_owner_fkey FOREIGN KEY (owner_id) REFERENCES geg_guinee.employees(id) ON DELETE SET NULL;
alter table geg_guinee.delivery_note_lines add constraint delivery_note_lines_delivery_note_id_fkey FOREIGN KEY (delivery_note_id) REFERENCES geg_guinee.delivery_notes(id) ON DELETE CASCADE;
alter table geg_guinee.delivery_note_lines add constraint delivery_note_lines_order_line_id_fkey FOREIGN KEY (order_line_id) REFERENCES geg_guinee.sales_order_lines(id) ON DELETE SET NULL;
alter table geg_guinee.delivery_note_lines add constraint delivery_note_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES geg_guinee.products(id) ON DELETE SET NULL;
alter table geg_guinee.delivery_note_lines add constraint delivery_note_lines_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES geg_guinee.warehouses(id) ON DELETE SET NULL;
alter table geg_guinee.delivery_notes add constraint delivery_notes_account_id_fkey FOREIGN KEY (account_id) REFERENCES geg_guinee.accounts(id) ON DELETE SET NULL;
alter table geg_guinee.delivery_notes add constraint delivery_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES geg_guinee.invoices(id) ON DELETE SET NULL;
alter table geg_guinee.delivery_notes add constraint delivery_notes_order_id_fkey FOREIGN KEY (order_id) REFERENCES geg_guinee.sales_orders(id) ON DELETE SET NULL;
alter table geg_guinee.delivery_notes add constraint delivery_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table geg_guinee.delivery_notes add constraint dn_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table geg_guinee.documents add constraint documents_account_fkey FOREIGN KEY (account_id) REFERENCES geg_guinee.accounts(id) ON DELETE SET NULL;
alter table geg_guinee.documents add constraint documents_contact_fkey FOREIGN KEY (contact_id) REFERENCES geg_guinee.contacts(id) ON DELETE SET NULL;
alter table geg_guinee.documents add constraint documents_deal_fkey FOREIGN KEY (deal_id) REFERENCES geg_guinee.deals(id) ON DELETE SET NULL;
alter table geg_guinee.employees add constraint employees_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table geg_guinee.invoice_lines add constraint il_invoice_fkey FOREIGN KEY (invoice_id) REFERENCES geg_guinee.invoices(id) ON DELETE CASCADE;
alter table geg_guinee.invoice_lines add constraint il_product_fkey FOREIGN KEY (product_id) REFERENCES geg_guinee.products(id) ON DELETE SET NULL;
alter table geg_guinee.invoices add constraint inv_account_fkey FOREIGN KEY (account_id) REFERENCES geg_guinee.accounts(id) ON DELETE SET NULL;
alter table geg_guinee.invoices add constraint inv_order_fkey FOREIGN KEY (order_id) REFERENCES geg_guinee.sales_orders(id) ON DELETE SET NULL;
alter table geg_guinee.invoices add constraint inv_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table geg_guinee.invoices add constraint invoices_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES geg_guinee.deals(id) ON DELETE SET NULL;
alter table geg_guinee.invoices add constraint invoices_salesperson_id_fkey FOREIGN KEY (salesperson_id) REFERENCES geg_guinee.employees(id);
alter table geg_guinee.payments add constraint pay_invoice_fkey FOREIGN KEY (invoice_id) REFERENCES geg_guinee.invoices(id) ON DELETE CASCADE;
alter table geg_guinee.payments add constraint pay_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table geg_guinee.product_documents add constraint product_documents_product_id_fkey FOREIGN KEY (product_id) REFERENCES geg_guinee.products(id) ON DELETE CASCADE;
alter table geg_guinee.product_documents add constraint product_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
alter table geg_guinee.product_packaging add constraint product_packaging_product_id_fkey FOREIGN KEY (product_id) REFERENCES geg_guinee.products(id) ON DELETE CASCADE;
alter table geg_guinee.product_packaging add constraint product_packaging_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES geg_guinee.units(id);
alter table geg_guinee.products add constraint products_category_id_fkey FOREIGN KEY (category_id) REFERENCES geg_guinee.product_categories(id) ON DELETE SET NULL;
alter table geg_guinee.products add constraint products_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES geg_guinee.units(id) ON DELETE SET NULL;
alter table geg_guinee.purchase_costs add constraint pc_order_fkey FOREIGN KEY (order_id) REFERENCES geg_guinee.purchase_orders(id) ON DELETE CASCADE;
alter table geg_guinee.purchase_order_events add constraint purchase_order_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES geg_guinee.purchase_orders(id) ON DELETE CASCADE;
alter table geg_guinee.purchase_order_events add constraint purchase_order_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
alter table geg_guinee.purchase_order_lines add constraint pol_order_fkey FOREIGN KEY (order_id) REFERENCES geg_guinee.purchase_orders(id) ON DELETE CASCADE;
alter table geg_guinee.purchase_order_lines add constraint pol_product_fkey FOREIGN KEY (product_id) REFERENCES geg_guinee.products(id) ON DELETE SET NULL;
alter table geg_guinee.purchase_order_lines add constraint pol_warehouse_fkey FOREIGN KEY (warehouse_id) REFERENCES geg_guinee.warehouses(id) ON DELETE SET NULL;
alter table geg_guinee.purchase_orders add constraint po_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table geg_guinee.purchase_orders add constraint purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES geg_guinee.suppliers(id) ON DELETE SET NULL;
alter table geg_guinee.purchase_reception_lines add constraint purchase_reception_lines_reception_id_fkey FOREIGN KEY (reception_id) REFERENCES geg_guinee.purchase_receptions(id) ON DELETE CASCADE;
alter table geg_guinee.sales_order_lines add constraint sales_order_lines_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES geg_guinee.units(id) ON DELETE SET NULL;
alter table geg_guinee.sales_order_lines add constraint sol_order_fkey FOREIGN KEY (order_id) REFERENCES geg_guinee.sales_orders(id) ON DELETE CASCADE;
alter table geg_guinee.sales_order_lines add constraint sol_product_fkey FOREIGN KEY (product_id) REFERENCES geg_guinee.products(id) ON DELETE SET NULL;
alter table geg_guinee.sales_orders add constraint so_account_fkey FOREIGN KEY (account_id) REFERENCES geg_guinee.accounts(id) ON DELETE SET NULL;
alter table geg_guinee.sales_orders add constraint so_contact_fkey FOREIGN KEY (contact_id) REFERENCES geg_guinee.contacts(id) ON DELETE SET NULL;
alter table geg_guinee.sales_orders add constraint so_salesperson_fkey FOREIGN KEY (salesperson_id) REFERENCES geg_guinee.employees(id) ON DELETE SET NULL;
alter table geg_guinee.sales_orders add constraint so_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table geg_guinee.shipments add constraint shipments_supplier_invoice_id_fkey FOREIGN KEY (supplier_invoice_id) REFERENCES geg_guinee.supplier_invoices(id) ON DELETE SET NULL;
alter table geg_guinee.stock_levels add constraint sl_product_fkey FOREIGN KEY (product_id) REFERENCES geg_guinee.products(id) ON DELETE CASCADE;
alter table geg_guinee.stock_levels add constraint sl_warehouse_fkey FOREIGN KEY (warehouse_id) REFERENCES geg_guinee.warehouses(id) ON DELETE CASCADE;
alter table geg_guinee.stock_moves add constraint sm_from_warehouse_fkey FOREIGN KEY (from_warehouse_id) REFERENCES geg_guinee.warehouses(id) ON DELETE SET NULL;
alter table geg_guinee.stock_moves add constraint sm_product_fkey FOREIGN KEY (product_id) REFERENCES geg_guinee.products(id) ON DELETE SET NULL;
alter table geg_guinee.stock_moves add constraint sm_to_warehouse_fkey FOREIGN KEY (to_warehouse_id) REFERENCES geg_guinee.warehouses(id) ON DELETE SET NULL;
alter table geg_guinee.stock_moves add constraint sm_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table geg_guinee.supplier_invoice_lines add constraint supplier_invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES geg_guinee.supplier_invoices(id) ON DELETE CASCADE;
alter table geg_guinee.supplier_invoices add constraint supplier_invoices_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES geg_guinee.deals(id) ON DELETE SET NULL;
alter table geg_guinee.supplier_invoices add constraint supplier_invoices_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES geg_guinee.suppliers(id) ON DELETE SET NULL;
alter table geg_guinee.supplier_payments add constraint supplier_payments_supplier_invoice_id_fkey FOREIGN KEY (supplier_invoice_id) REFERENCES geg_guinee.supplier_invoices(id) ON DELETE CASCADE;
alter table geg_guinee.supplier_payments add constraint supplier_payments_treasury_account_id_fkey FOREIGN KEY (treasury_account_id) REFERENCES geg_guinee.treasury_accounts(id) ON DELETE SET NULL;
alter table geg_guinee.treasury_transactions add constraint tt_account_fkey FOREIGN KEY (account_id) REFERENCES geg_guinee.treasury_accounts(id) ON DELETE SET NULL;
alter table geg_guinee.treasury_transactions add constraint tt_payment_fkey FOREIGN KEY (payment_id) REFERENCES geg_guinee.payments(id) ON DELETE SET NULL;
alter table geg_guinee.treasury_transactions add constraint tt_transfer_account_fkey FOREIGN KEY (transfer_account_id) REFERENCES geg_guinee.treasury_accounts(id) ON DELETE SET NULL;
alter table geg_guinee.treasury_transactions add constraint tt_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table geg_singapore.accounts add constraint accounts_salesperson_id_fkey FOREIGN KEY (salesperson_id) REFERENCES geg_singapore.employees(id) ON DELETE SET NULL;
alter table geg_singapore.activities add constraint activities_account_id_fkey FOREIGN KEY (account_id) REFERENCES geg_singapore.accounts(id) ON DELETE SET NULL;
alter table geg_singapore.activities add constraint activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES geg_singapore.contacts(id) ON DELETE SET NULL;
alter table geg_singapore.activities add constraint activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES geg_singapore.deals(id) ON DELETE SET NULL;
alter table geg_singapore.chat_messages add constraint chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES geg_singapore.chat_rooms(id) ON DELETE CASCADE;
alter table geg_singapore.chat_read_receipts add constraint chat_read_receipts_room_id_fkey FOREIGN KEY (room_id) REFERENCES geg_singapore.chat_rooms(id) ON DELETE CASCADE;
alter table geg_singapore.commissions add constraint commissions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES geg_singapore.employees(id) ON DELETE SET NULL;
alter table geg_singapore.commissions add constraint commissions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES geg_singapore.invoices(id) ON DELETE SET NULL;
alter table geg_singapore.commissions add constraint commissions_treasury_transaction_id_fkey FOREIGN KEY (treasury_transaction_id) REFERENCES geg_singapore.treasury_transactions(id) ON DELETE SET NULL;
alter table geg_singapore.contacts add constraint contacts_account_id_fkey FOREIGN KEY (account_id) REFERENCES geg_singapore.accounts(id) ON DELETE SET NULL;
alter table geg_singapore.deals add constraint deals_account_id_fkey FOREIGN KEY (account_id) REFERENCES geg_singapore.accounts(id) ON DELETE SET NULL;
alter table geg_singapore.delivery_note_lines add constraint delivery_note_lines_delivery_note_id_fkey FOREIGN KEY (delivery_note_id) REFERENCES geg_singapore.delivery_notes(id) ON DELETE CASCADE;
alter table geg_singapore.delivery_note_lines add constraint delivery_note_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES geg_singapore.products(id) ON DELETE SET NULL;
alter table geg_singapore.delivery_note_lines add constraint delivery_note_lines_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES geg_singapore.warehouses(id) ON DELETE SET NULL;
alter table geg_singapore.delivery_notes add constraint delivery_notes_account_id_fkey FOREIGN KEY (account_id) REFERENCES geg_singapore.accounts(id) ON DELETE SET NULL;
alter table geg_singapore.delivery_notes add constraint delivery_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES geg_singapore.invoices(id) ON DELETE SET NULL;
alter table geg_singapore.delivery_notes add constraint delivery_notes_order_id_fkey FOREIGN KEY (order_id) REFERENCES geg_singapore.sales_orders(id) ON DELETE SET NULL;
alter table geg_singapore.documents add constraint documents_account_id_fkey FOREIGN KEY (account_id) REFERENCES geg_singapore.accounts(id) ON DELETE SET NULL;
alter table geg_singapore.documents add constraint documents_category_id_fkey FOREIGN KEY (category_id) REFERENCES geg_singapore.document_categories(id) ON DELETE SET NULL;
alter table geg_singapore.invoice_lines add constraint invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES geg_singapore.invoices(id) ON DELETE CASCADE;
alter table geg_singapore.invoice_lines add constraint invoice_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES geg_singapore.products(id) ON DELETE SET NULL;
alter table geg_singapore.invoices add constraint invoices_account_id_fkey FOREIGN KEY (account_id) REFERENCES geg_singapore.accounts(id) ON DELETE SET NULL;
alter table geg_singapore.invoices add constraint invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES geg_singapore.sales_orders(id) ON DELETE SET NULL;
alter table geg_singapore.invoices add constraint invoices_salesperson_id_fkey FOREIGN KEY (salesperson_id) REFERENCES geg_singapore.employees(id);
alter table geg_singapore.payments add constraint payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES geg_singapore.invoices(id) ON DELETE CASCADE;
alter table geg_singapore.payments add constraint payments_treasury_account_id_fkey FOREIGN KEY (treasury_account_id) REFERENCES geg_singapore.treasury_accounts(id) ON DELETE SET NULL;
alter table geg_singapore.product_documents add constraint product_documents_product_id_fkey FOREIGN KEY (product_id) REFERENCES geg_singapore.products(id) ON DELETE CASCADE;
alter table geg_singapore.products add constraint products_category_id_fkey FOREIGN KEY (category_id) REFERENCES geg_singapore.product_categories(id) ON DELETE SET NULL;
alter table geg_singapore.products add constraint products_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES geg_singapore.units(id) ON DELETE SET NULL;
alter table geg_singapore.purchase_costs add constraint purchase_costs_order_id_fkey FOREIGN KEY (order_id) REFERENCES geg_singapore.purchase_orders(id) ON DELETE CASCADE;
alter table geg_singapore.purchase_order_lines add constraint purchase_order_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES geg_singapore.purchase_orders(id) ON DELETE CASCADE;
alter table geg_singapore.purchase_order_lines add constraint purchase_order_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES geg_singapore.products(id) ON DELETE SET NULL;
alter table geg_singapore.purchase_orders add constraint purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES geg_singapore.accounts(id) ON DELETE SET NULL;
alter table geg_singapore.purchase_reception_lines add constraint purchase_reception_lines_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES geg_singapore.warehouses(id) ON DELETE SET NULL;
alter table geg_singapore.purchase_reception_lines add constraint purchase_reception_lines_reception_id_fkey FOREIGN KEY (reception_id) REFERENCES geg_singapore.purchase_receptions(id) ON DELETE CASCADE;
alter table geg_singapore.purchase_reception_lines add constraint purchase_reception_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES geg_singapore.products(id) ON DELETE SET NULL;
alter table geg_singapore.purchase_reception_lines add constraint purchase_reception_lines_order_line_id_fkey FOREIGN KEY (order_line_id) REFERENCES geg_singapore.purchase_order_lines(id) ON DELETE SET NULL;
alter table geg_singapore.purchase_receptions add constraint purchase_receptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES geg_singapore.purchase_orders(id) ON DELETE CASCADE;
alter table geg_singapore.sales_order_lines add constraint sales_order_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES geg_singapore.sales_orders(id) ON DELETE CASCADE;
alter table geg_singapore.sales_order_lines add constraint sales_order_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES geg_singapore.products(id) ON DELETE SET NULL;
alter table geg_singapore.sales_orders add constraint sales_orders_account_id_fkey FOREIGN KEY (account_id) REFERENCES geg_singapore.accounts(id) ON DELETE SET NULL;
alter table geg_singapore.sales_orders add constraint sales_orders_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES geg_singapore.contacts(id) ON DELETE SET NULL;
alter table geg_singapore.sales_orders add constraint sales_orders_salesperson_id_fkey FOREIGN KEY (salesperson_id) REFERENCES geg_singapore.employees(id) ON DELETE SET NULL;
alter table geg_singapore.stock_levels add constraint stock_levels_product_id_fkey FOREIGN KEY (product_id) REFERENCES geg_singapore.products(id) ON DELETE CASCADE;
alter table geg_singapore.stock_levels add constraint stock_levels_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES geg_singapore.warehouses(id) ON DELETE CASCADE;
alter table geg_singapore.stock_moves add constraint stock_moves_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES geg_singapore.warehouses(id) ON DELETE SET NULL;
alter table geg_singapore.stock_moves add constraint stock_moves_product_id_fkey FOREIGN KEY (product_id) REFERENCES geg_singapore.products(id) ON DELETE CASCADE;
alter table geg_singapore.stock_moves add constraint stock_moves_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES geg_singapore.warehouses(id) ON DELETE SET NULL;
alter table geg_singapore.supplier_invoice_lines add constraint supplier_invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES geg_singapore.supplier_invoices(id) ON DELETE CASCADE;
alter table geg_singapore.supplier_invoices add constraint supplier_invoices_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES geg_singapore.purchase_orders(id) ON DELETE SET NULL;
alter table geg_singapore.supplier_invoices add constraint supplier_invoices_reception_id_fkey FOREIGN KEY (reception_id) REFERENCES geg_singapore.purchase_receptions(id) ON DELETE SET NULL;
alter table geg_singapore.supplier_invoices add constraint supplier_invoices_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES geg_singapore.accounts(id) ON DELETE SET NULL;
alter table geg_singapore.supplier_payments add constraint supplier_payments_supplier_invoice_id_fkey FOREIGN KEY (supplier_invoice_id) REFERENCES geg_singapore.supplier_invoices(id) ON DELETE SET NULL;
alter table geg_singapore.supplier_payments add constraint supplier_payments_treasury_account_id_fkey FOREIGN KEY (treasury_account_id) REFERENCES geg_singapore.treasury_accounts(id) ON DELETE SET NULL;
alter table geg_singapore.treasury_transactions add constraint treasury_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES geg_singapore.treasury_accounts(id) ON DELETE CASCADE;
alter table public.accounts add constraint accounts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.accounts add constraint accounts_salesperson_id_fkey FOREIGN KEY (salesperson_id) REFERENCES employees(id) ON DELETE SET NULL;
alter table public.activities add constraint activities_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;
alter table public.activities add constraint activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
alter table public.activities add constraint activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
alter table public.activities add constraint activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.commissions add constraint commissions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public.commissions add constraint commissions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
alter table public.commissions add constraint commissions_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL;
alter table public.commissions add constraint commissions_treasury_transaction_id_fkey FOREIGN KEY (treasury_transaction_id) REFERENCES treasury_transactions(id) ON DELETE SET NULL;
alter table public.contacts add constraint contacts_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
alter table public.deals add constraint deals_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
alter table public.deals add constraint deals_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL;
alter table public.deals add constraint deals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.document_settings add constraint document_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public.documents add constraint documents_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;
alter table public.documents add constraint documents_category_id_fkey FOREIGN KEY (category_id) REFERENCES document_categories(id) ON DELETE SET NULL;
alter table public.documents add constraint documents_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
alter table public.documents add constraint documents_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
alter table public.documents add constraint documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.exchange_rates add constraint exchange_rates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public.invoice_lines add constraint invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
alter table public.invoice_lines add constraint invoice_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
alter table public.invoices add constraint invoices_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;
alter table public.invoices add constraint invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE SET NULL;
alter table public.invoices add constraint invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_treasury_account_id_fkey FOREIGN KEY (treasury_account_id) REFERENCES treasury_accounts(id) ON DELETE SET NULL;
alter table public.payments add constraint payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table public.products add constraint products_category_id_fkey FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL;
alter table public.products add constraint products_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_current_company_id_fkey FOREIGN KEY (current_company_id) REFERENCES companies(id);
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.purchase_costs add constraint purchase_costs_order_id_fkey FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;
alter table public.purchase_order_lines add constraint purchase_order_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;
alter table public.purchase_order_lines add constraint purchase_order_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
alter table public.purchase_order_lines add constraint purchase_order_lines_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
alter table public.purchase_orders add constraint purchase_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.sales_order_lines add constraint sales_order_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE;
alter table public.sales_order_lines add constraint sales_order_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
alter table public.sales_orders add constraint sales_orders_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;
alter table public.sales_orders add constraint sales_orders_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
alter table public.sales_orders add constraint sales_orders_salesperson_id_fkey FOREIGN KEY (salesperson_id) REFERENCES employees(id) ON DELETE SET NULL;
alter table public.sales_orders add constraint sales_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table public.stock_levels add constraint stock_levels_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.stock_levels add constraint stock_levels_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;
alter table public.stock_moves add constraint stock_moves_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT;
alter table public.stock_moves add constraint stock_moves_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
alter table public.stock_moves add constraint stock_moves_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES warehouses(id) ON DELETE RESTRICT;
alter table public.stock_moves add constraint stock_moves_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
alter table public.treasury_transactions add constraint treasury_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES treasury_accounts(id) ON DELETE RESTRICT;
alter table public.treasury_transactions add constraint treasury_transactions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
alter table public.treasury_transactions add constraint treasury_transactions_transfer_account_id_fkey FOREIGN KEY (transfer_account_id) REFERENCES treasury_accounts(id) ON DELETE SET NULL;
alter table public.treasury_transactions add constraint treasury_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);

-- Indexes ------------------------------------------------------------
CREATE INDEX accounts_owner_id_idx ON geg_guinee.accounts USING btree (owner_id);
CREATE INDEX accounts_type_idx ON geg_guinee.accounts USING btree (type);
CREATE INDEX activities_account_id_idx ON geg_guinee.activities USING btree (account_id);
CREATE INDEX activities_deal_id_idx ON geg_guinee.activities USING btree (deal_id);
CREATE INDEX activities_follow_up_date_idx ON geg_guinee.activities USING btree (follow_up_date) WHERE (completed = false);
CREATE INDEX activities_user_id_idx ON geg_guinee.activities USING btree (user_id);
CREATE INDEX activity_logs_created_at_idx ON geg_guinee.activity_logs USING btree (created_at DESC);
CREATE INDEX activity_logs_user_id_idx ON geg_guinee.activity_logs USING btree (user_id);
CREATE INDEX chat_messages_room_created ON geg_guinee.chat_messages USING btree (room_id, created_at DESC);
CREATE UNIQUE INDEX chat_rooms_global_unique ON geg_guinee.chat_rooms USING btree (type) WHERE (type = 'global'::text);
CREATE UNIQUE INDEX chat_rooms_reference_unique ON geg_guinee.chat_rooms USING btree (type, reference_id) WHERE (reference_id IS NOT NULL);
CREATE INDEX contacts_account_id_idx ON geg_guinee.contacts USING btree (account_id);
CREATE INDEX deals_account_id_idx ON geg_guinee.deals USING btree (account_id);
CREATE INDEX deals_owner_id_idx ON geg_guinee.deals USING btree (owner_id);
CREATE INDEX deals_stage_idx ON geg_guinee.deals USING btree (stage);
CREATE INDEX exchange_rates_from_currency_to_currency_effective_date_idx ON geg_guinee.exchange_rates USING btree (from_currency, to_currency, effective_date DESC);
CREATE INDEX idx_deal_costs_deal_id ON geg_guinee.deal_costs USING btree (deal_id);
CREATE INDEX idx_delivery_note_lines_dn_id ON geg_guinee.delivery_note_lines USING btree (delivery_note_id);
CREATE INDEX idx_delivery_notes_invoice_id ON geg_guinee.delivery_notes USING btree (invoice_id);
CREATE INDEX idx_delivery_notes_order_id ON geg_guinee.delivery_notes USING btree (order_id);
CREATE INDEX idx_invoices_deal_id ON geg_guinee.invoices USING btree (deal_id);
CREATE INDEX idx_po_events_order ON geg_guinee.purchase_order_events USING btree (order_id);
CREATE INDEX idx_supplier_invoices_deal_id ON geg_guinee.supplier_invoices USING btree (deal_id);
CREATE INDEX idx_suppliers_name ON geg_guinee.suppliers USING btree (name);
CREATE INDEX invoice_lines_invoice_id_idx ON geg_guinee.invoice_lines USING btree (invoice_id);
CREATE INDEX invoices_account_id_idx ON geg_guinee.invoices USING btree (account_id);
CREATE INDEX invoices_order_id_idx ON geg_guinee.invoices USING btree (order_id);
CREATE INDEX invoices_status_idx ON geg_guinee.invoices USING btree (status);
CREATE INDEX payments_invoice_id_idx ON geg_guinee.payments USING btree (invoice_id);
CREATE INDEX payments_paid_at_idx ON geg_guinee.payments USING btree (paid_at DESC);
CREATE INDEX products_category_id_idx ON geg_guinee.products USING btree (category_id);
CREATE INDEX products_is_active_idx ON geg_guinee.products USING btree (is_active);
CREATE INDEX purchase_costs_order_id_idx ON geg_guinee.purchase_costs USING btree (order_id);
CREATE INDEX purchase_order_lines_order_id_idx ON geg_guinee.purchase_order_lines USING btree (order_id);
CREATE INDEX purchase_orders_status_idx ON geg_guinee.purchase_orders USING btree (status);
CREATE INDEX sales_order_lines_order_id_idx ON geg_guinee.sales_order_lines USING btree (order_id);
CREATE INDEX sales_orders_account_id_idx ON geg_guinee.sales_orders USING btree (account_id);
CREATE INDEX sales_orders_created_at_idx ON geg_guinee.sales_orders USING btree (created_at DESC);
CREATE INDEX sales_orders_status_idx ON geg_guinee.sales_orders USING btree (status);
CREATE INDEX stock_moves_date_idx ON geg_guinee.stock_moves USING btree (date DESC);
CREATE INDEX stock_moves_product_id_idx ON geg_guinee.stock_moves USING btree (product_id);
CREATE INDEX stock_moves_type_idx ON geg_guinee.stock_moves USING btree (type);
CREATE INDEX treasury_transactions_account_id_idx ON geg_guinee.treasury_transactions USING btree (account_id);
CREATE INDEX treasury_transactions_date_idx ON geg_guinee.treasury_transactions USING btree (date DESC);
CREATE INDEX treasury_transactions_payment_id_idx ON geg_guinee.treasury_transactions USING btree (payment_id);
CREATE INDEX activities_account_id_idx ON geg_singapore.activities USING btree (account_id);
CREATE INDEX contacts_account_id_idx ON geg_singapore.contacts USING btree (account_id);
CREATE INDEX idx_sgp_activities_account ON geg_singapore.activities USING btree (account_id);
CREATE INDEX idx_sgp_contacts_account ON geg_singapore.contacts USING btree (account_id);
CREATE INDEX idx_sgp_invoice_lines_invoice ON geg_singapore.invoice_lines USING btree (invoice_id);
CREATE INDEX idx_sgp_invoices_account ON geg_singapore.invoices USING btree (account_id);
CREATE INDEX idx_sgp_invoices_order ON geg_singapore.invoices USING btree (order_id);
CREATE INDEX idx_sgp_invoices_status ON geg_singapore.invoices USING btree (status);
CREATE INDEX idx_sgp_payments_invoice ON geg_singapore.payments USING btree (invoice_id);
CREATE INDEX idx_sgp_po_status ON geg_singapore.purchase_orders USING btree (status);
CREATE INDEX idx_sgp_po_supplier ON geg_singapore.purchase_orders USING btree (supplier_id);
CREATE INDEX idx_sgp_pol_order ON geg_singapore.purchase_order_lines USING btree (order_id);
CREATE INDEX idx_sgp_sales_orders_account ON geg_singapore.sales_orders USING btree (account_id);
CREATE INDEX idx_sgp_sales_orders_status ON geg_singapore.sales_orders USING btree (status);
CREATE INDEX idx_sgp_si_po ON geg_singapore.supplier_invoices USING btree (purchase_order_id);
CREATE INDEX idx_sgp_si_supplier ON geg_singapore.supplier_invoices USING btree (supplier_id);
CREATE INDEX idx_sgp_sol_order ON geg_singapore.sales_order_lines USING btree (order_id);
CREATE INDEX idx_sgp_sp_invoice ON geg_singapore.supplier_payments USING btree (supplier_invoice_id);
CREATE INDEX idx_sgp_stock_levels_product ON geg_singapore.stock_levels USING btree (product_id);
CREATE INDEX idx_sgp_stock_moves_product ON geg_singapore.stock_moves USING btree (product_id);
CREATE INDEX idx_sgp_treasury_tx_account ON geg_singapore.treasury_transactions USING btree (account_id);
CREATE INDEX idx_singapore_suppliers_name ON geg_singapore.suppliers USING btree (name);
CREATE INDEX invoice_lines_invoice_id_idx ON geg_singapore.invoice_lines USING btree (invoice_id);
CREATE INDEX invoices_account_id_idx ON geg_singapore.invoices USING btree (account_id);
CREATE INDEX invoices_order_id_idx ON geg_singapore.invoices USING btree (order_id);
CREATE INDEX invoices_status_idx ON geg_singapore.invoices USING btree (status);
CREATE INDEX payments_invoice_id_idx ON geg_singapore.payments USING btree (invoice_id);
CREATE INDEX purchase_order_lines_order_id_idx ON geg_singapore.purchase_order_lines USING btree (order_id);
CREATE INDEX purchase_orders_status_idx ON geg_singapore.purchase_orders USING btree (status);
CREATE INDEX purchase_orders_supplier_id_idx ON geg_singapore.purchase_orders USING btree (supplier_id);
CREATE INDEX sales_order_lines_order_id_idx ON geg_singapore.sales_order_lines USING btree (order_id);
CREATE INDEX sales_orders_account_id_idx ON geg_singapore.sales_orders USING btree (account_id);
CREATE INDEX sales_orders_status_idx ON geg_singapore.sales_orders USING btree (status);
CREATE INDEX stock_levels_product_id_idx ON geg_singapore.stock_levels USING btree (product_id);
CREATE INDEX stock_moves_product_id_idx ON geg_singapore.stock_moves USING btree (product_id);
CREATE INDEX supplier_invoices_purchase_order_id_idx ON geg_singapore.supplier_invoices USING btree (purchase_order_id);
CREATE INDEX supplier_invoices_supplier_id_idx ON geg_singapore.supplier_invoices USING btree (supplier_id);
CREATE INDEX supplier_payments_supplier_invoice_id_idx ON geg_singapore.supplier_payments USING btree (supplier_invoice_id);
CREATE INDEX treasury_transactions_account_id_idx ON geg_singapore.treasury_transactions USING btree (account_id);
CREATE INDEX accounts_owner_id_idx ON public.accounts USING btree (owner_id);
CREATE INDEX accounts_type_idx ON public.accounts USING btree (type);
CREATE INDEX activities_account_id_idx ON public.activities USING btree (account_id);
CREATE INDEX activities_deal_id_idx ON public.activities USING btree (deal_id);
CREATE INDEX activities_follow_up_date_idx ON public.activities USING btree (follow_up_date) WHERE (completed = false);
CREATE INDEX activities_user_id_idx ON public.activities USING btree (user_id);
CREATE INDEX contacts_account_id_idx ON public.contacts USING btree (account_id);
CREATE INDEX deals_account_id_idx ON public.deals USING btree (account_id);
CREATE INDEX deals_owner_id_idx ON public.deals USING btree (owner_id);
CREATE INDEX deals_stage_idx ON public.deals USING btree (stage);
CREATE INDEX exchange_rates_lookup_idx ON public.exchange_rates USING btree (from_currency, to_currency, effective_date DESC);
CREATE INDEX invoice_lines_invoice_id_idx ON public.invoice_lines USING btree (invoice_id);
CREATE INDEX invoices_account_id_idx ON public.invoices USING btree (account_id);
CREATE INDEX invoices_order_id_idx ON public.invoices USING btree (order_id);
CREATE INDEX invoices_status_idx ON public.invoices USING btree (status);
CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX notifications_user_id_created_at_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX payments_invoice_id_idx ON public.payments USING btree (invoice_id);
CREATE INDEX payments_paid_at_idx ON public.payments USING btree (paid_at DESC);
CREATE INDEX products_category_id_idx ON public.products USING btree (category_id);
CREATE INDEX products_is_active_idx ON public.products USING btree (is_active);
CREATE INDEX purchase_costs_order_id_idx ON public.purchase_costs USING btree (order_id);
CREATE INDEX purchase_order_lines_order_id_idx ON public.purchase_order_lines USING btree (order_id);
CREATE INDEX purchase_orders_status_idx ON public.purchase_orders USING btree (status);
CREATE INDEX sales_order_lines_order_id_idx ON public.sales_order_lines USING btree (order_id);
CREATE INDEX sales_orders_account_id_idx ON public.sales_orders USING btree (account_id);
CREATE INDEX sales_orders_created_at_idx ON public.sales_orders USING btree (created_at DESC);
CREATE INDEX sales_orders_status_idx ON public.sales_orders USING btree (status);
CREATE INDEX stock_moves_date_idx ON public.stock_moves USING btree (date DESC);
CREATE INDEX stock_moves_product_id_idx ON public.stock_moves USING btree (product_id);
CREATE INDEX stock_moves_type_idx ON public.stock_moves USING btree (type);
CREATE INDEX treasury_transactions_account_id_idx ON public.treasury_transactions USING btree (account_id);
CREATE INDEX treasury_transactions_date_idx ON public.treasury_transactions USING btree (date DESC);
CREATE INDEX treasury_transactions_payment_id_idx ON public.treasury_transactions USING btree (payment_id);

-- Views ------------------------------------------------------------
create or replace view public.sales_order_totals as  SELECT o.id,
    o.number,
    o.status,
    o.currency,
    o.account_id,
    o.created_at,
    COALESCE(sum(((l.quantity * l.unit_price) * ((1)::numeric - (l.discount / (100)::numeric)))), (0)::numeric) AS total_ht
   FROM (sales_orders o
     LEFT JOIN sales_order_lines l ON ((l.order_id = o.id)))
  GROUP BY o.id;
create or replace view public.invoice_totals as  SELECT i.id,
    i.number,
    i.status,
    i.currency,
    i.account_id,
    i.order_id,
    i.issue_date,
    i.due_date,
    i.created_at,
    COALESCE(sum(((l.quantity * l.unit_price) * ((1)::numeric - (l.discount / (100)::numeric)))), (0)::numeric) AS total_ht,
    COALESCE(( SELECT sum(p.amount) AS sum
           FROM payments p
          WHERE (p.invoice_id = i.id)), (0)::numeric) AS total_paid,
    (COALESCE(sum(((l.quantity * l.unit_price) * ((1)::numeric - (l.discount / (100)::numeric)))), (0)::numeric) - COALESCE(( SELECT sum(p.amount) AS sum
           FROM payments p
          WHERE (p.invoice_id = i.id)), (0)::numeric)) AS balance
   FROM (invoices i
     LEFT JOIN invoice_lines l ON ((l.invoice_id = i.id)))
  GROUP BY i.id;
create or replace view public.treasury_balances as  SELECT a.id,
    a.name,
    a.type,
    a.institution,
    a.currency,
    a.color,
    a.is_active,
    a.initial_balance,
    COALESCE(sum(
        CASE
            WHEN (t.type = ANY (ARRAY['credit'::text, 'transfer_in'::text])) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_in,
    COALESCE(sum(
        CASE
            WHEN (t.type = ANY (ARRAY['debit'::text, 'transfer_out'::text])) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_out,
    ((a.initial_balance + COALESCE(sum(
        CASE
            WHEN (t.type = ANY (ARRAY['credit'::text, 'transfer_in'::text])) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric)) - COALESCE(sum(
        CASE
            WHEN (t.type = ANY (ARRAY['debit'::text, 'transfer_out'::text])) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric)) AS balance
   FROM (treasury_accounts a
     LEFT JOIN treasury_transactions t ON ((t.account_id = a.id)))
  GROUP BY a.id;
create or replace view public.purchase_landed_costs as  SELECT l.id AS line_id,
    l.order_id,
    l.product_id,
    l.description,
    l.quantity,
    l.fob_unit_price,
    (l.fob_unit_price * l.quantity) AS fob_total,
    sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id) AS order_fob_total,
    COALESCE(( SELECT sum(c.amount) AS sum
           FROM purchase_costs c
          WHERE (c.order_id = l.order_id)), (0)::numeric) AS total_extra_costs,
        CASE
            WHEN (sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id) = (0)::numeric) THEN (0)::numeric
            ELSE ((COALESCE(( SELECT sum(c.amount) AS sum
               FROM purchase_costs c
              WHERE (c.order_id = l.order_id)), (0)::numeric) * (l.fob_unit_price * l.quantity)) / sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id))
        END AS allocated_costs,
    ((l.fob_unit_price * l.quantity) +
        CASE
            WHEN (sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id) = (0)::numeric) THEN (0)::numeric
            ELSE ((COALESCE(( SELECT sum(c.amount) AS sum
               FROM purchase_costs c
              WHERE (c.order_id = l.order_id)), (0)::numeric) * (l.fob_unit_price * l.quantity)) / sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id))
        END) AS landed_total,
        CASE
            WHEN (l.quantity = (0)::numeric) THEN (0)::numeric
            ELSE (((l.fob_unit_price * l.quantity) +
            CASE
                WHEN (sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id) = (0)::numeric) THEN (0)::numeric
                ELSE ((COALESCE(( SELECT sum(c.amount) AS sum
                   FROM purchase_costs c
                  WHERE (c.order_id = l.order_id)), (0)::numeric) * (l.fob_unit_price * l.quantity)) / sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id))
            END) / l.quantity)
        END AS landed_unit_price,
    l.warehouse_id,
    l."position"
   FROM (purchase_order_lines l
     JOIN purchase_order_lines l2 ON ((l2.order_id = l.order_id)));
create or replace view geg_guinee.sales_order_totals as  SELECT o.id,
    o.number,
    o.status,
    o.currency,
    o.account_id,
    o.created_at,
    o.salesperson_id,
    COALESCE(sum(((l.quantity * l.unit_price) * ((1)::numeric - (l.discount / (100)::numeric)))), (0)::numeric) AS total_ht
   FROM (geg_guinee.sales_orders o
     LEFT JOIN geg_guinee.sales_order_lines l ON ((l.order_id = o.id)))
  GROUP BY o.id;
create or replace view geg_guinee.purchase_landed_costs as  SELECT l.id AS line_id,
    l.order_id,
    l.product_id,
    l.description,
    l.quantity,
    l.fob_unit_price,
    (l.fob_unit_price * l.quantity) AS fob_total,
    sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id) AS order_fob_total,
    COALESCE(( SELECT sum(c.amount) AS sum
           FROM geg_guinee.purchase_costs c
          WHERE (c.order_id = l.order_id)), (0)::numeric) AS total_extra_costs,
        CASE
            WHEN (sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id) = (0)::numeric) THEN (0)::numeric
            ELSE (((COALESCE(( SELECT sum(c.amount) AS sum
               FROM geg_guinee.purchase_costs c
              WHERE (c.order_id = l.order_id)), (0)::numeric) * l.fob_unit_price) * l.quantity) / sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id))
        END AS allocated_costs,
    ((l.fob_unit_price * l.quantity) +
        CASE
            WHEN (sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id) = (0)::numeric) THEN (0)::numeric
            ELSE (((COALESCE(( SELECT sum(c.amount) AS sum
               FROM geg_guinee.purchase_costs c
              WHERE (c.order_id = l.order_id)), (0)::numeric) * l.fob_unit_price) * l.quantity) / sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id))
        END) AS landed_total,
        CASE
            WHEN (l.quantity = (0)::numeric) THEN (0)::numeric
            ELSE (((l.fob_unit_price * l.quantity) +
            CASE
                WHEN (sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id) = (0)::numeric) THEN (0)::numeric
                ELSE (((COALESCE(( SELECT sum(c.amount) AS sum
                   FROM geg_guinee.purchase_costs c
                  WHERE (c.order_id = l.order_id)), (0)::numeric) * l.fob_unit_price) * l.quantity) / sum((l2.fob_unit_price * l2.quantity)) OVER (PARTITION BY l.order_id))
            END) / l.quantity)
        END AS landed_unit_price,
    l.warehouse_id,
    l."position"
   FROM (geg_guinee.purchase_order_lines l
     JOIN geg_guinee.purchase_order_lines l2 ON ((l2.order_id = l.order_id)));
create or replace view geg_guinee.treasury_balances as  SELECT a.id,
    a.name,
    a.type,
    a.institution,
    a.account_number,
    a.currency,
    a.color,
    a.is_active,
    a.initial_balance,
    COALESCE(sum(
        CASE
            WHEN (t.type = ANY (ARRAY['credit'::text, 'transfer_in'::text])) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_in,
    COALESCE(sum(
        CASE
            WHEN (t.type = ANY (ARRAY['debit'::text, 'transfer_out'::text])) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_out,
    ((a.initial_balance + COALESCE(sum(
        CASE
            WHEN (t.type = ANY (ARRAY['credit'::text, 'transfer_in'::text])) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric)) - COALESCE(sum(
        CASE
            WHEN (t.type = ANY (ARRAY['debit'::text, 'transfer_out'::text])) THEN t.amount
            ELSE (0)::numeric
        END), (0)::numeric)) AS balance
   FROM (geg_guinee.treasury_accounts a
     LEFT JOIN geg_guinee.treasury_transactions t ON ((t.account_id = a.id)))
  GROUP BY a.id;
create or replace view geg_guinee.supplier_invoice_totals as  SELECT si.id,
    si.number,
    si.supplier_name,
    si.status,
    si.currency,
    si.total_ht,
    si.total_ttc,
    si.invoice_date,
    si.due_date,
    COALESCE(sum(sp.amount), (0)::numeric) AS total_paid,
    (si.total_ttc - COALESCE(sum(sp.amount), (0)::numeric)) AS balance
   FROM (geg_guinee.supplier_invoices si
     LEFT JOIN geg_guinee.supplier_payments sp ON ((sp.supplier_invoice_id = si.id)))
  GROUP BY si.id;
create or replace view geg_guinee.invoice_totals as  SELECT i.id,
    i.number,
    i.status,
    i.currency,
    i.issue_date,
    i.due_date,
    i.account_id,
    i.order_id,
    i.deal_id,
    COALESCE(sum(((il.quantity * il.unit_price) * ((1)::numeric - (COALESCE(il.discount, (0)::numeric) / (100)::numeric)))), (0)::numeric) AS total_ht,
    COALESCE(sum((((il.quantity * il.unit_price) * ((1)::numeric - (COALESCE(il.discount, (0)::numeric) / (100)::numeric))) * ((1)::numeric + (COALESCE(il.tva_rate, (0)::numeric) / (100)::numeric)))), (0)::numeric) AS total_ttc,
    COALESCE(( SELECT sum(COALESCE(p.amount_in_invoice_currency, p.amount)) AS sum
           FROM geg_guinee.payments p
          WHERE (p.invoice_id = i.id)), (0)::numeric) AS total_paid,
    (COALESCE(sum((((il.quantity * il.unit_price) * ((1)::numeric - (COALESCE(il.discount, (0)::numeric) / (100)::numeric))) * ((1)::numeric + (COALESCE(il.tva_rate, (0)::numeric) / (100)::numeric)))), (0)::numeric) - COALESCE(( SELECT sum(COALESCE(p.amount_in_invoice_currency, p.amount)) AS sum
           FROM geg_guinee.payments p
          WHERE (p.invoice_id = i.id)), (0)::numeric)) AS balance
   FROM (geg_guinee.invoices i
     LEFT JOIN geg_guinee.invoice_lines il ON ((il.invoice_id = i.id)))
  GROUP BY i.id;

-- Triggers ------------------------------------------------------------
CREATE TRIGGER trg_delivery_note_number BEFORE INSERT ON geg_guinee.delivery_notes FOR EACH ROW WHEN ((new.number = ''::text)) EXECUTE FUNCTION geg_guinee.set_delivery_note_number();
CREATE TRIGGER set_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_invoice_number BEFORE INSERT ON public.invoices FOR EACH ROW WHEN ((new.number = ''::text)) EXECUTE FUNCTION generate_invoice_number();
CREATE TRIGGER set_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER on_payment_change AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_invoice_status();
CREATE TRIGGER on_payment_insert AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION payment_to_treasury();
CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_purchase_number BEFORE INSERT ON public.purchase_orders FOR EACH ROW WHEN ((new.number = ''::text)) EXECUTE FUNCTION generate_purchase_number();
CREATE TRIGGER set_purchase_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_order_number BEFORE INSERT ON public.sales_orders FOR EACH ROW WHEN ((new.number = ''::text)) EXECUTE FUNCTION generate_order_number();
CREATE TRIGGER set_sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER on_stock_move_insert AFTER INSERT ON public.stock_moves FOR EACH ROW EXECUTE FUNCTION apply_stock_move();

-- Triggers on auth.users ------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users; CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row level security ------------------------------------------------------------
alter table geg_guinee.accounts enable row level security;
alter table geg_guinee.activities enable row level security;
alter table geg_guinee.activity_logs enable row level security;
alter table geg_guinee.chat_messages enable row level security;
alter table geg_guinee.chat_read_receipts enable row level security;
alter table geg_guinee.chat_rooms enable row level security;
alter table geg_guinee.commissions enable row level security;
alter table geg_guinee.contacts enable row level security;
alter table geg_guinee.deal_costs enable row level security;
alter table geg_guinee.deals enable row level security;
alter table geg_guinee.delivery_note_lines enable row level security;
alter table geg_guinee.delivery_notes enable row level security;
alter table geg_guinee.document_categories enable row level security;
alter table geg_guinee.documents enable row level security;
alter table geg_guinee.employees enable row level security;
alter table geg_guinee.exchange_rates enable row level security;
alter table geg_guinee.invoice_lines enable row level security;
alter table geg_guinee.invoices enable row level security;
alter table geg_guinee.payments enable row level security;
alter table geg_guinee.product_categories enable row level security;
alter table geg_guinee.product_documents enable row level security;
alter table geg_guinee.products enable row level security;
alter table geg_guinee.purchase_costs enable row level security;
alter table geg_guinee.purchase_order_events enable row level security;
alter table geg_guinee.purchase_order_lines enable row level security;
alter table geg_guinee.purchase_orders enable row level security;
alter table geg_guinee.purchase_reception_lines enable row level security;
alter table geg_guinee.purchase_receptions enable row level security;
alter table geg_guinee.sales_order_lines enable row level security;
alter table geg_guinee.sales_orders enable row level security;
alter table geg_guinee.shipments enable row level security;
alter table geg_guinee.stock_levels enable row level security;
alter table geg_guinee.stock_moves enable row level security;
alter table geg_guinee.supplier_invoice_lines enable row level security;
alter table geg_guinee.supplier_invoices enable row level security;
alter table geg_guinee.supplier_payments enable row level security;
alter table geg_guinee.suppliers enable row level security;
alter table geg_guinee.treasury_accounts enable row level security;
alter table geg_guinee.treasury_transactions enable row level security;
alter table geg_guinee.units enable row level security;
alter table geg_singapore.accounts enable row level security;
alter table geg_singapore.activities enable row level security;
alter table geg_singapore.activity_logs enable row level security;
alter table geg_singapore.chat_messages enable row level security;
alter table geg_singapore.chat_read_receipts enable row level security;
alter table geg_singapore.chat_rooms enable row level security;
alter table geg_singapore.commissions enable row level security;
alter table geg_singapore.contacts enable row level security;
alter table geg_singapore.deals enable row level security;
alter table geg_singapore.delivery_note_lines enable row level security;
alter table geg_singapore.delivery_notes enable row level security;
alter table geg_singapore.document_categories enable row level security;
alter table geg_singapore.documents enable row level security;
alter table geg_singapore.employees enable row level security;
alter table geg_singapore.exchange_rates enable row level security;
alter table geg_singapore.invoice_lines enable row level security;
alter table geg_singapore.invoices enable row level security;
alter table geg_singapore.payments enable row level security;
alter table geg_singapore.product_categories enable row level security;
alter table geg_singapore.product_documents enable row level security;
alter table geg_singapore.products enable row level security;
alter table geg_singapore.purchase_costs enable row level security;
alter table geg_singapore.purchase_order_lines enable row level security;
alter table geg_singapore.purchase_orders enable row level security;
alter table geg_singapore.purchase_reception_lines enable row level security;
alter table geg_singapore.purchase_receptions enable row level security;
alter table geg_singapore.sales_order_lines enable row level security;
alter table geg_singapore.sales_orders enable row level security;
alter table geg_singapore.shipments enable row level security;
alter table geg_singapore.stock_levels enable row level security;
alter table geg_singapore.stock_moves enable row level security;
alter table geg_singapore.supplier_invoice_lines enable row level security;
alter table geg_singapore.supplier_invoices enable row level security;
alter table geg_singapore.supplier_payments enable row level security;
alter table geg_singapore.suppliers enable row level security;
alter table geg_singapore.treasury_accounts enable row level security;
alter table geg_singapore.treasury_transactions enable row level security;
alter table geg_singapore.units enable row level security;
alter table geg_singapore.warehouses enable row level security;
alter table public.accounts enable row level security;
alter table public.activities enable row level security;
alter table public.commissions enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.deals enable row level security;
alter table public.document_categories enable row level security;
alter table public.document_settings enable row level security;
alter table public.document_tokens enable row level security;
alter table public.documents enable row level security;
alter table public.employees enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoices enable row level security;
alter table public.notifications enable row level security;
alter table public.payments enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.purchase_costs enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.sales_order_lines enable row level security;
alter table public.sales_orders enable row level security;
alter table public.stock_levels enable row level security;
alter table public.stock_moves enable row level security;
alter table public.treasury_accounts enable row level security;
alter table public.treasury_transactions enable row level security;
alter table public.units enable row level security;
alter table public.warehouses enable row level security;

-- Policies ------------------------------------------------------------
create policy allow_authenticated_read on geg_guinee.accounts as PERMISSIVE for SELECT to authenticated using (true);
create policy "authenticated crud accounts" on geg_guinee.accounts as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_accounts on geg_guinee.accounts as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy company_access_activities on geg_guinee.activities as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy "Admins can read logs" on geg_guinee.activity_logs as PERMISSIVE for SELECT to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
create policy company_access_commissions on geg_guinee.commissions as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy "authenticated crud contacts" on geg_guinee.contacts as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_contacts on geg_guinee.contacts as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy "Authenticated users can manage deal_costs" on geg_guinee.deal_costs as PERMISSIVE for ALL to public using (true) with check (true);
create policy company_access_deals on geg_guinee.deals as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy auth_delivery_note_lines on geg_guinee.delivery_note_lines as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy delivery_note_lines_all on geg_guinee.delivery_note_lines as PERMISSIVE for ALL to public using (true) with check (true);
create policy auth_delivery_notes on geg_guinee.delivery_notes as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy delivery_notes_all on geg_guinee.delivery_notes as PERMISSIVE for ALL to public using (true) with check (true);
create policy company_access_document_categories on geg_guinee.document_categories as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy company_access_documents on geg_guinee.documents as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy "authenticated crud employees" on geg_guinee.employees as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_employees on geg_guinee.employees as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy company_access_exchange_rates on geg_guinee.exchange_rates as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy "authenticated crud invoice_lines" on geg_guinee.invoice_lines as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_invoice_lines on geg_guinee.invoice_lines as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy "authenticated crud invoices" on geg_guinee.invoices as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_invoices on geg_guinee.invoices as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy "authenticated crud payments" on geg_guinee.payments as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_payments on geg_guinee.payments as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy company_access_product_categories on geg_guinee.product_categories as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy product_documents_all on geg_guinee.product_documents as PERMISSIVE for ALL to public using (true) with check (true);
create policy "authenticated crud products" on geg_guinee.products as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_products on geg_guinee.products as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy company_access_purchase_costs on geg_guinee.purchase_costs as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy "authenticated crud purchase_order_lines" on geg_guinee.purchase_order_lines as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_purchase_order_lines on geg_guinee.purchase_order_lines as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy "Allow authenticated insert on purchase_orders" on geg_guinee.purchase_orders as PERMISSIVE for INSERT to authenticated with check (true);
create policy "Allow authenticated select on purchase_orders" on geg_guinee.purchase_orders as PERMISSIVE for SELECT to authenticated using (true);
create policy "Allow authenticated update on purchase_orders" on geg_guinee.purchase_orders as PERMISSIVE for UPDATE to authenticated using (true) with check (true);
create policy company_access_purchase_orders on geg_guinee.purchase_orders as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy authenticated_all on geg_guinee.purchase_reception_lines as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy authenticated_all on geg_guinee.purchase_receptions as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "authenticated crud sales_order_lines" on geg_guinee.sales_order_lines as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_sales_order_lines on geg_guinee.sales_order_lines as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy "authenticated crud sales_orders" on geg_guinee.sales_orders as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_sales_orders on geg_guinee.sales_orders as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy allow_all_authenticated on geg_guinee.stock_levels as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_stock_levels on geg_guinee.stock_levels as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy allow_all_authenticated on geg_guinee.stock_moves as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_stock_moves on geg_guinee.stock_moves as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy allow_all_supplier_invoice_lines on geg_guinee.supplier_invoice_lines as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy allow_all_supplier_invoice_lines_anon on geg_guinee.supplier_invoice_lines as PERMISSIVE for ALL to anon using (true) with check (true);
create policy "authenticated crud supplier_invoice_lines" on geg_guinee.supplier_invoice_lines as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy allow_all_supplier_invoices on geg_guinee.supplier_invoices as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy allow_all_supplier_invoices_anon on geg_guinee.supplier_invoices as PERMISSIVE for ALL to anon using (true) with check (true);
create policy "authenticated crud supplier_invoices" on geg_guinee.supplier_invoices as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy allow_all_supplier_payments on geg_guinee.supplier_payments as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy allow_all_supplier_payments_anon on geg_guinee.supplier_payments as PERMISSIVE for ALL to anon using (true) with check (true);
create policy "authenticated crud supplier_payments" on geg_guinee.supplier_payments as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy suppliers_delete on geg_guinee.suppliers as PERMISSIVE for DELETE to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
create policy suppliers_insert on geg_guinee.suppliers as PERMISSIVE for INSERT to public with check ((auth.uid() IS NOT NULL));
create policy suppliers_select on geg_guinee.suppliers as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy suppliers_update on geg_guinee.suppliers as PERMISSIVE for UPDATE to public using ((auth.uid() IS NOT NULL));
create policy "Users can insert treasury_accounts" on geg_guinee.treasury_accounts as PERMISSIVE for INSERT to authenticated with check (true);
create policy company_access_treasury_accounts on geg_guinee.treasury_accounts as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy company_access_treasury_transactions on geg_guinee.treasury_transactions as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy "authenticated crud units" on geg_guinee.units as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy company_access_units on geg_guinee.units as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy company_access_warehouses on geg_guinee.warehouses as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text))))) with check ((EXISTS ( SELECT 1
   FROM (profiles p
     JOIN companies c ON ((c.id = ANY (p.company_access))))
  WHERE ((p.id = auth.uid()) AND (c.schema_name = 'geg_guinee'::text)))));
create policy authenticated_access on geg_singapore.accounts as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy authenticated_access on geg_singapore.activities as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy authenticated_access on geg_singapore.contacts as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy authenticated_access on geg_singapore.deals as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy authenticated_access on geg_singapore.invoices as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy authenticated_access on geg_singapore.payments as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy authenticated_access on geg_singapore.products as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy authenticated_access on geg_singapore.purchase_orders as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy authenticated_access on geg_singapore.sales_orders as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy authenticated_access on geg_singapore.supplier_invoices as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy authenticated_access on geg_singapore.supplier_payments as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy suppliers_delete on geg_singapore.suppliers as PERMISSIVE for DELETE to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
create policy suppliers_insert on geg_singapore.suppliers as PERMISSIVE for INSERT to public with check ((auth.uid() IS NOT NULL));
create policy suppliers_select on geg_singapore.suppliers as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy suppliers_update on geg_singapore.suppliers as PERMISSIVE for UPDATE to public using ((auth.uid() IS NOT NULL));
create policy authenticated_access on geg_singapore.treasury_accounts as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy authenticated_access on geg_singapore.treasury_transactions as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "Admins and managers can delete accounts" on public.accounts as PERMISSIVE for DELETE to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
create policy "Authenticated users can insert accounts" on public.accounts as PERMISSIVE for INSERT to public with check ((auth.uid() IS NOT NULL));
create policy "Authenticated users can update accounts" on public.accounts as PERMISSIVE for UPDATE to public using ((auth.uid() IS NOT NULL));
create policy "Authenticated users can view accounts" on public.accounts as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "Authenticated users can view activities" on public.activities as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "Users can delete own activities" on public.activities as PERMISSIVE for DELETE to public using ((auth.uid() = user_id));
create policy "Users can insert own activities" on public.activities as PERMISSIVE for INSERT to public with check ((auth.uid() = user_id));
create policy "Users can update own activities" on public.activities as PERMISSIVE for UPDATE to public using ((auth.uid() = user_id));
create policy "auth insert commissions" on public.commissions as PERMISSIVE for INSERT to authenticated with check (true);
create policy "auth read commissions" on public.commissions as PERMISSIVE for SELECT to authenticated using (true);
create policy "auth update commissions" on public.commissions as PERMISSIVE for UPDATE to authenticated using (true);
create policy companies_admin_all on public.companies as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
create policy companies_select on public.companies as PERMISSIVE for SELECT to authenticated using (true);
create policy "Admins and managers can delete contacts" on public.contacts as PERMISSIVE for DELETE to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
create policy "Authenticated users can insert contacts" on public.contacts as PERMISSIVE for INSERT to public with check ((auth.uid() IS NOT NULL));
create policy "Authenticated users can update contacts" on public.contacts as PERMISSIVE for UPDATE to public using ((auth.uid() IS NOT NULL));
create policy "Authenticated users can view contacts" on public.contacts as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "Admins and managers can delete deals" on public.deals as PERMISSIVE for DELETE to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
create policy "Authenticated users can insert deals" on public.deals as PERMISSIVE for INSERT to public with check ((auth.uid() IS NOT NULL));
create policy "Authenticated users can update deals" on public.deals as PERMISSIVE for UPDATE to public using ((auth.uid() IS NOT NULL));
create policy "Authenticated users can view deals" on public.deals as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "Admins can manage document_categories" on public.document_categories as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
create policy "Authenticated users can view document_categories" on public.document_categories as PERMISSIVE for SELECT to authenticated using (true);
create policy doc_settings_read on public.document_settings as PERMISSIVE for SELECT to authenticated using (true);
create policy doc_settings_write on public.document_settings as PERMISSIVE for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text])))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
create policy "Authenticated users can delete documents" on public.documents as PERMISSIVE for DELETE to authenticated using (((uploaded_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text])))))));
create policy "Authenticated users can insert documents" on public.documents as PERMISSIVE for INSERT to authenticated with check (true);
create policy "Authenticated users can update documents" on public.documents as PERMISSIVE for UPDATE to authenticated using (true);
create policy "Authenticated users can view documents" on public.documents as PERMISSIVE for SELECT to authenticated using (true);
create policy "auth delete employees" on public.employees as PERMISSIVE for DELETE to authenticated using (true);
create policy "auth insert employees" on public.employees as PERMISSIVE for INSERT to authenticated with check (true);
create policy "auth read employees" on public.employees as PERMISSIVE for SELECT to authenticated using (true);
create policy "auth update employees" on public.employees as PERMISSIVE for UPDATE to authenticated using (true);
create policy "authenticated insert exchange_rates" on public.exchange_rates as PERMISSIVE for INSERT to authenticated with check (true);
create policy "authenticated read exchange_rates" on public.exchange_rates as PERMISSIVE for SELECT to authenticated using (true);
create policy "authenticated update exchange_rates" on public.exchange_rates as PERMISSIVE for UPDATE to authenticated using (true);
create policy "Auth users manage invoice lines" on public.invoice_lines as PERMISSIVE for ALL to public using ((auth.uid() IS NOT NULL));
create policy "auth insert invoice_lines" on public.invoice_lines as PERMISSIVE for INSERT to authenticated with check (true);
create policy "auth select invoice_lines" on public.invoice_lines as PERMISSIVE for SELECT to authenticated using (true);
create policy "auth update invoice_lines" on public.invoice_lines as PERMISSIVE for UPDATE to authenticated using (true);
create policy "Auth users insert invoices" on public.invoices as PERMISSIVE for INSERT to public with check ((auth.uid() = user_id));
create policy "Auth users update invoices" on public.invoices as PERMISSIVE for UPDATE to public using ((auth.uid() IS NOT NULL));
create policy "Auth users view invoices" on public.invoices as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "auth insert invoices" on public.invoices as PERMISSIVE for INSERT to authenticated with check (true);
create policy "auth select invoices_all" on public.invoices as PERMISSIVE for SELECT to authenticated using (true);
create policy "auth update invoices" on public.invoices as PERMISSIVE for UPDATE to authenticated using (true);
create policy "Service role inserts notifications" on public.notifications as PERMISSIVE for INSERT to public with check (true);
create policy "Users see own notifications" on public.notifications as PERMISSIVE for SELECT to public using ((auth.uid() = user_id));
create policy "Users update own notifications" on public.notifications as PERMISSIVE for UPDATE to public using ((auth.uid() = user_id));
create policy "Auth users insert payments" on public.payments as PERMISSIVE for INSERT to public with check ((auth.uid() = user_id));
create policy "Auth users view payments" on public.payments as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "auth insert payments" on public.payments as PERMISSIVE for INSERT to authenticated with check (true);
create policy "auth select payments" on public.payments as PERMISSIVE for SELECT to authenticated using (true);
create policy "Admins manage categories" on public.product_categories as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
create policy "Auth users view categories" on public.product_categories as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "Auth users insert products" on public.products as PERMISSIVE for INSERT to public with check ((auth.uid() IS NOT NULL));
create policy "Auth users update products" on public.products as PERMISSIVE for UPDATE to public using ((auth.uid() IS NOT NULL));
create policy "Auth users view products" on public.products as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "Users can update own profile" on public.profiles as PERMISSIVE for UPDATE to public using ((auth.uid() = id));
create policy "Users can view all profiles" on public.profiles as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "Auth users manage purchase costs" on public.purchase_costs as PERMISSIVE for ALL to public using ((auth.uid() IS NOT NULL));
create policy "auth delete purchase_costs" on public.purchase_costs as PERMISSIVE for DELETE to authenticated using (true);
create policy "auth insert purchase_costs" on public.purchase_costs as PERMISSIVE for INSERT to authenticated with check (true);
create policy "auth select purchase_costs" on public.purchase_costs as PERMISSIVE for SELECT to authenticated using (true);
create policy "auth update purchase_costs" on public.purchase_costs as PERMISSIVE for UPDATE to authenticated using (true);
create policy "Auth users manage purchase lines" on public.purchase_order_lines as PERMISSIVE for ALL to public using ((auth.uid() IS NOT NULL));
create policy "auth insert purchase_order_lines" on public.purchase_order_lines as PERMISSIVE for INSERT to authenticated with check (true);
create policy "auth select purchase_order_lines" on public.purchase_order_lines as PERMISSIVE for SELECT to authenticated using (true);
create policy "auth update purchase_order_lines" on public.purchase_order_lines as PERMISSIVE for UPDATE to authenticated using (true);
create policy "Auth users manage purchase orders" on public.purchase_orders as PERMISSIVE for ALL to public using ((auth.uid() IS NOT NULL));
create policy "auth insert purchase_orders" on public.purchase_orders as PERMISSIVE for INSERT to authenticated with check (true);
create policy "auth select purchase_orders" on public.purchase_orders as PERMISSIVE for SELECT to authenticated using (true);
create policy "auth update purchase_orders" on public.purchase_orders as PERMISSIVE for UPDATE to authenticated using (true);
create policy "Users manage own subscriptions" on public.push_subscriptions as PERMISSIVE for ALL to public using ((auth.uid() = user_id));
create policy "Auth users manage order lines" on public.sales_order_lines as PERMISSIVE for ALL to public using ((auth.uid() IS NOT NULL));
create policy "auth insert sales_order_lines" on public.sales_order_lines as PERMISSIVE for INSERT to authenticated with check (true);
create policy "auth select sales_order_lines" on public.sales_order_lines as PERMISSIVE for SELECT to authenticated using (true);
create policy "auth update sales_order_lines" on public.sales_order_lines as PERMISSIVE for UPDATE to authenticated using (true);
create policy "Auth users insert orders" on public.sales_orders as PERMISSIVE for INSERT to public with check ((auth.uid() = user_id));
create policy "Auth users update orders" on public.sales_orders as PERMISSIVE for UPDATE to public using ((auth.uid() IS NOT NULL));
create policy "Auth users view orders" on public.sales_orders as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "auth select sales_orders_all" on public.sales_orders as PERMISSIVE for SELECT to authenticated using (true);
create policy "Auth users view stock" on public.stock_levels as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "System can update stock" on public.stock_levels as PERMISSIVE for ALL to public using ((auth.uid() IS NOT NULL));
create policy "Auth users insert moves" on public.stock_moves as PERMISSIVE for INSERT to public with check ((auth.uid() = user_id));
create policy "Auth users view moves" on public.stock_moves as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "Admins manage treasury accounts" on public.treasury_accounts as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
create policy "Auth users view treasury accounts" on public.treasury_accounts as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "auth insert treasury_accounts" on public.treasury_accounts as PERMISSIVE for INSERT to authenticated with check (true);
create policy "auth select treasury_accounts" on public.treasury_accounts as PERMISSIVE for SELECT to authenticated using (true);
create policy "auth update treasury_accounts" on public.treasury_accounts as PERMISSIVE for UPDATE to authenticated using (true);
create policy "Auth users insert transactions" on public.treasury_transactions as PERMISSIVE for INSERT to public with check ((auth.uid() = user_id));
create policy "Auth users view transactions" on public.treasury_transactions as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "auth insert treasury_transactions" on public.treasury_transactions as PERMISSIVE for INSERT to authenticated with check (true);
create policy "auth select treasury_transactions" on public.treasury_transactions as PERMISSIVE for SELECT to authenticated using (true);
create policy "Admins manage units" on public.units as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
create policy "Auth users view units" on public.units as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "Admins manage warehouses" on public.warehouses as PERMISSIVE for ALL to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'manager'::text]))))));
create policy "Auth users view warehouses" on public.warehouses as PERMISSIVE for SELECT to public using ((auth.uid() IS NOT NULL));
create policy "authenticated delete warehouses" on public.warehouses as PERMISSIVE for DELETE to authenticated using (true);
create policy "authenticated insert warehouses" on public.warehouses as PERMISSIVE for INSERT to authenticated with check (true);
create policy "authenticated read warehouses" on public.warehouses as PERMISSIVE for SELECT to authenticated using (true);
create policy "authenticated update warehouses" on public.warehouses as PERMISSIVE for UPDATE to authenticated using (true);
create policy "Authenticated users can delete own documents" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
create policy "Authenticated users can read documents" on storage.objects as PERMISSIVE for SELECT to authenticated using ((bucket_id = 'documents'::text));
create policy "Authenticated users can upload documents" on storage.objects as PERMISSIVE for INSERT to authenticated with check ((bucket_id = 'documents'::text));
create policy logos_auth_delete on storage.objects as PERMISSIVE for DELETE to authenticated using ((bucket_id = 'logos'::text));
create policy logos_auth_update on storage.objects as PERMISSIVE for UPDATE to authenticated using ((bucket_id = 'logos'::text));
create policy logos_auth_upload on storage.objects as PERMISSIVE for INSERT to authenticated with check ((bucket_id = 'logos'::text));
create policy logos_public_read on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'logos'::text));
create policy product_docs_delete on storage.objects as PERMISSIVE for DELETE to public using (((bucket_id = 'product-documents'::text) AND (auth.role() = 'authenticated'::text)));
create policy product_docs_insert on storage.objects as PERMISSIVE for INSERT to public with check (((bucket_id = 'product-documents'::text) AND (auth.role() = 'authenticated'::text)));
create policy product_docs_read on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'product-documents'::text));

-- Schema grants ------------------------------------------------------------
grant USAGE on schema api to anon;
grant USAGE on schema api to authenticated;
grant CREATE on schema api to postgres;
grant USAGE on schema api to postgres;
grant USAGE on schema geg_guinee to anon;
grant USAGE on schema geg_guinee to authenticated;
grant CREATE on schema geg_guinee to postgres;
grant USAGE on schema geg_guinee to postgres;
grant USAGE on schema geg_guinee to service_role;
grant USAGE on schema geg_singapore to anon;
grant USAGE on schema geg_singapore to authenticated;
grant CREATE on schema geg_singapore to postgres;
grant USAGE on schema geg_singapore to postgres;
grant USAGE on schema geg_singapore to service_role;

-- Table grants ------------------------------------------------------------
grant DELETE on table geg_guinee.accounts to anon;
grant INSERT on table geg_guinee.accounts to anon;
grant MAINTAIN on table geg_guinee.accounts to anon;
grant REFERENCES on table geg_guinee.accounts to anon;
grant SELECT on table geg_guinee.accounts to anon;
grant TRIGGER on table geg_guinee.accounts to anon;
grant TRUNCATE on table geg_guinee.accounts to anon;
grant UPDATE on table geg_guinee.accounts to anon;
grant DELETE on table geg_guinee.accounts to authenticated;
grant INSERT on table geg_guinee.accounts to authenticated;
grant MAINTAIN on table geg_guinee.accounts to authenticated;
grant REFERENCES on table geg_guinee.accounts to authenticated;
grant SELECT on table geg_guinee.accounts to authenticated;
grant TRIGGER on table geg_guinee.accounts to authenticated;
grant TRUNCATE on table geg_guinee.accounts to authenticated;
grant UPDATE on table geg_guinee.accounts to authenticated;
grant DELETE on table geg_guinee.accounts to service_role;
grant INSERT on table geg_guinee.accounts to service_role;
grant MAINTAIN on table geg_guinee.accounts to service_role;
grant REFERENCES on table geg_guinee.accounts to service_role;
grant SELECT on table geg_guinee.accounts to service_role;
grant TRIGGER on table geg_guinee.accounts to service_role;
grant TRUNCATE on table geg_guinee.accounts to service_role;
grant UPDATE on table geg_guinee.accounts to service_role;
grant DELETE on table geg_guinee.activities to anon;
grant INSERT on table geg_guinee.activities to anon;
grant MAINTAIN on table geg_guinee.activities to anon;
grant REFERENCES on table geg_guinee.activities to anon;
grant SELECT on table geg_guinee.activities to anon;
grant TRIGGER on table geg_guinee.activities to anon;
grant TRUNCATE on table geg_guinee.activities to anon;
grant UPDATE on table geg_guinee.activities to anon;
grant DELETE on table geg_guinee.activities to authenticated;
grant INSERT on table geg_guinee.activities to authenticated;
grant MAINTAIN on table geg_guinee.activities to authenticated;
grant REFERENCES on table geg_guinee.activities to authenticated;
grant SELECT on table geg_guinee.activities to authenticated;
grant TRIGGER on table geg_guinee.activities to authenticated;
grant TRUNCATE on table geg_guinee.activities to authenticated;
grant UPDATE on table geg_guinee.activities to authenticated;
grant DELETE on table geg_guinee.activities to service_role;
grant INSERT on table geg_guinee.activities to service_role;
grant MAINTAIN on table geg_guinee.activities to service_role;
grant REFERENCES on table geg_guinee.activities to service_role;
grant SELECT on table geg_guinee.activities to service_role;
grant TRIGGER on table geg_guinee.activities to service_role;
grant TRUNCATE on table geg_guinee.activities to service_role;
grant UPDATE on table geg_guinee.activities to service_role;
grant DELETE on table geg_guinee.activity_logs to service_role;
grant INSERT on table geg_guinee.activity_logs to service_role;
grant MAINTAIN on table geg_guinee.activity_logs to service_role;
grant REFERENCES on table geg_guinee.activity_logs to service_role;
grant SELECT on table geg_guinee.activity_logs to service_role;
grant TRIGGER on table geg_guinee.activity_logs to service_role;
grant TRUNCATE on table geg_guinee.activity_logs to service_role;
grant UPDATE on table geg_guinee.activity_logs to service_role;
grant DELETE on table geg_guinee.chat_messages to service_role;
grant INSERT on table geg_guinee.chat_messages to service_role;
grant MAINTAIN on table geg_guinee.chat_messages to service_role;
grant REFERENCES on table geg_guinee.chat_messages to service_role;
grant SELECT on table geg_guinee.chat_messages to service_role;
grant TRIGGER on table geg_guinee.chat_messages to service_role;
grant TRUNCATE on table geg_guinee.chat_messages to service_role;
grant UPDATE on table geg_guinee.chat_messages to service_role;
grant DELETE on table geg_guinee.chat_read_receipts to service_role;
grant INSERT on table geg_guinee.chat_read_receipts to service_role;
grant MAINTAIN on table geg_guinee.chat_read_receipts to service_role;
grant REFERENCES on table geg_guinee.chat_read_receipts to service_role;
grant SELECT on table geg_guinee.chat_read_receipts to service_role;
grant TRIGGER on table geg_guinee.chat_read_receipts to service_role;
grant TRUNCATE on table geg_guinee.chat_read_receipts to service_role;
grant UPDATE on table geg_guinee.chat_read_receipts to service_role;
grant DELETE on table geg_guinee.chat_rooms to service_role;
grant INSERT on table geg_guinee.chat_rooms to service_role;
grant MAINTAIN on table geg_guinee.chat_rooms to service_role;
grant REFERENCES on table geg_guinee.chat_rooms to service_role;
grant SELECT on table geg_guinee.chat_rooms to service_role;
grant TRIGGER on table geg_guinee.chat_rooms to service_role;
grant TRUNCATE on table geg_guinee.chat_rooms to service_role;
grant UPDATE on table geg_guinee.chat_rooms to service_role;
grant DELETE on table geg_guinee.commissions to anon;
grant INSERT on table geg_guinee.commissions to anon;
grant MAINTAIN on table geg_guinee.commissions to anon;
grant REFERENCES on table geg_guinee.commissions to anon;
grant SELECT on table geg_guinee.commissions to anon;
grant TRIGGER on table geg_guinee.commissions to anon;
grant TRUNCATE on table geg_guinee.commissions to anon;
grant UPDATE on table geg_guinee.commissions to anon;
grant DELETE on table geg_guinee.commissions to authenticated;
grant INSERT on table geg_guinee.commissions to authenticated;
grant MAINTAIN on table geg_guinee.commissions to authenticated;
grant REFERENCES on table geg_guinee.commissions to authenticated;
grant SELECT on table geg_guinee.commissions to authenticated;
grant TRIGGER on table geg_guinee.commissions to authenticated;
grant TRUNCATE on table geg_guinee.commissions to authenticated;
grant UPDATE on table geg_guinee.commissions to authenticated;
grant DELETE on table geg_guinee.commissions to service_role;
grant INSERT on table geg_guinee.commissions to service_role;
grant MAINTAIN on table geg_guinee.commissions to service_role;
grant REFERENCES on table geg_guinee.commissions to service_role;
grant SELECT on table geg_guinee.commissions to service_role;
grant TRIGGER on table geg_guinee.commissions to service_role;
grant TRUNCATE on table geg_guinee.commissions to service_role;
grant UPDATE on table geg_guinee.commissions to service_role;
grant DELETE on table geg_guinee.contacts to anon;
grant INSERT on table geg_guinee.contacts to anon;
grant MAINTAIN on table geg_guinee.contacts to anon;
grant REFERENCES on table geg_guinee.contacts to anon;
grant SELECT on table geg_guinee.contacts to anon;
grant TRIGGER on table geg_guinee.contacts to anon;
grant TRUNCATE on table geg_guinee.contacts to anon;
grant UPDATE on table geg_guinee.contacts to anon;
grant DELETE on table geg_guinee.contacts to authenticated;
grant INSERT on table geg_guinee.contacts to authenticated;
grant MAINTAIN on table geg_guinee.contacts to authenticated;
grant REFERENCES on table geg_guinee.contacts to authenticated;
grant SELECT on table geg_guinee.contacts to authenticated;
grant TRIGGER on table geg_guinee.contacts to authenticated;
grant TRUNCATE on table geg_guinee.contacts to authenticated;
grant UPDATE on table geg_guinee.contacts to authenticated;
grant DELETE on table geg_guinee.contacts to service_role;
grant INSERT on table geg_guinee.contacts to service_role;
grant MAINTAIN on table geg_guinee.contacts to service_role;
grant REFERENCES on table geg_guinee.contacts to service_role;
grant SELECT on table geg_guinee.contacts to service_role;
grant TRIGGER on table geg_guinee.contacts to service_role;
grant TRUNCATE on table geg_guinee.contacts to service_role;
grant UPDATE on table geg_guinee.contacts to service_role;
grant DELETE on table geg_guinee.deal_costs to anon;
grant INSERT on table geg_guinee.deal_costs to anon;
grant MAINTAIN on table geg_guinee.deal_costs to anon;
grant REFERENCES on table geg_guinee.deal_costs to anon;
grant SELECT on table geg_guinee.deal_costs to anon;
grant TRIGGER on table geg_guinee.deal_costs to anon;
grant TRUNCATE on table geg_guinee.deal_costs to anon;
grant UPDATE on table geg_guinee.deal_costs to anon;
grant DELETE on table geg_guinee.deal_costs to authenticated;
grant INSERT on table geg_guinee.deal_costs to authenticated;
grant MAINTAIN on table geg_guinee.deal_costs to authenticated;
grant REFERENCES on table geg_guinee.deal_costs to authenticated;
grant SELECT on table geg_guinee.deal_costs to authenticated;
grant TRIGGER on table geg_guinee.deal_costs to authenticated;
grant TRUNCATE on table geg_guinee.deal_costs to authenticated;
grant UPDATE on table geg_guinee.deal_costs to authenticated;
grant DELETE on table geg_guinee.deal_costs to service_role;
grant INSERT on table geg_guinee.deal_costs to service_role;
grant MAINTAIN on table geg_guinee.deal_costs to service_role;
grant REFERENCES on table geg_guinee.deal_costs to service_role;
grant SELECT on table geg_guinee.deal_costs to service_role;
grant TRIGGER on table geg_guinee.deal_costs to service_role;
grant TRUNCATE on table geg_guinee.deal_costs to service_role;
grant UPDATE on table geg_guinee.deal_costs to service_role;
grant DELETE on table geg_guinee.deals to anon;
grant INSERT on table geg_guinee.deals to anon;
grant MAINTAIN on table geg_guinee.deals to anon;
grant REFERENCES on table geg_guinee.deals to anon;
grant SELECT on table geg_guinee.deals to anon;
grant TRIGGER on table geg_guinee.deals to anon;
grant TRUNCATE on table geg_guinee.deals to anon;
grant UPDATE on table geg_guinee.deals to anon;
grant DELETE on table geg_guinee.deals to authenticated;
grant INSERT on table geg_guinee.deals to authenticated;
grant MAINTAIN on table geg_guinee.deals to authenticated;
grant REFERENCES on table geg_guinee.deals to authenticated;
grant SELECT on table geg_guinee.deals to authenticated;
grant TRIGGER on table geg_guinee.deals to authenticated;
grant TRUNCATE on table geg_guinee.deals to authenticated;
grant UPDATE on table geg_guinee.deals to authenticated;
grant DELETE on table geg_guinee.deals to service_role;
grant INSERT on table geg_guinee.deals to service_role;
grant MAINTAIN on table geg_guinee.deals to service_role;
grant REFERENCES on table geg_guinee.deals to service_role;
grant SELECT on table geg_guinee.deals to service_role;
grant TRIGGER on table geg_guinee.deals to service_role;
grant TRUNCATE on table geg_guinee.deals to service_role;
grant UPDATE on table geg_guinee.deals to service_role;
grant DELETE on table geg_guinee.delivery_note_lines to authenticated;
grant INSERT on table geg_guinee.delivery_note_lines to authenticated;
grant MAINTAIN on table geg_guinee.delivery_note_lines to authenticated;
grant REFERENCES on table geg_guinee.delivery_note_lines to authenticated;
grant SELECT on table geg_guinee.delivery_note_lines to authenticated;
grant TRIGGER on table geg_guinee.delivery_note_lines to authenticated;
grant TRUNCATE on table geg_guinee.delivery_note_lines to authenticated;
grant UPDATE on table geg_guinee.delivery_note_lines to authenticated;
grant DELETE on table geg_guinee.delivery_note_lines to service_role;
grant INSERT on table geg_guinee.delivery_note_lines to service_role;
grant MAINTAIN on table geg_guinee.delivery_note_lines to service_role;
grant REFERENCES on table geg_guinee.delivery_note_lines to service_role;
grant SELECT on table geg_guinee.delivery_note_lines to service_role;
grant TRIGGER on table geg_guinee.delivery_note_lines to service_role;
grant TRUNCATE on table geg_guinee.delivery_note_lines to service_role;
grant UPDATE on table geg_guinee.delivery_note_lines to service_role;
grant DELETE on table geg_guinee.delivery_notes to authenticated;
grant INSERT on table geg_guinee.delivery_notes to authenticated;
grant MAINTAIN on table geg_guinee.delivery_notes to authenticated;
grant REFERENCES on table geg_guinee.delivery_notes to authenticated;
grant SELECT on table geg_guinee.delivery_notes to authenticated;
grant TRIGGER on table geg_guinee.delivery_notes to authenticated;
grant TRUNCATE on table geg_guinee.delivery_notes to authenticated;
grant UPDATE on table geg_guinee.delivery_notes to authenticated;
grant DELETE on table geg_guinee.delivery_notes to service_role;
grant INSERT on table geg_guinee.delivery_notes to service_role;
grant MAINTAIN on table geg_guinee.delivery_notes to service_role;
grant REFERENCES on table geg_guinee.delivery_notes to service_role;
grant SELECT on table geg_guinee.delivery_notes to service_role;
grant TRIGGER on table geg_guinee.delivery_notes to service_role;
grant TRUNCATE on table geg_guinee.delivery_notes to service_role;
grant UPDATE on table geg_guinee.delivery_notes to service_role;
grant DELETE on table geg_guinee.document_categories to anon;
grant INSERT on table geg_guinee.document_categories to anon;
grant MAINTAIN on table geg_guinee.document_categories to anon;
grant REFERENCES on table geg_guinee.document_categories to anon;
grant SELECT on table geg_guinee.document_categories to anon;
grant TRIGGER on table geg_guinee.document_categories to anon;
grant TRUNCATE on table geg_guinee.document_categories to anon;
grant UPDATE on table geg_guinee.document_categories to anon;
grant DELETE on table geg_guinee.document_categories to authenticated;
grant INSERT on table geg_guinee.document_categories to authenticated;
grant MAINTAIN on table geg_guinee.document_categories to authenticated;
grant REFERENCES on table geg_guinee.document_categories to authenticated;
grant SELECT on table geg_guinee.document_categories to authenticated;
grant TRIGGER on table geg_guinee.document_categories to authenticated;
grant TRUNCATE on table geg_guinee.document_categories to authenticated;
grant UPDATE on table geg_guinee.document_categories to authenticated;
grant DELETE on table geg_guinee.document_categories to service_role;
grant INSERT on table geg_guinee.document_categories to service_role;
grant MAINTAIN on table geg_guinee.document_categories to service_role;
grant REFERENCES on table geg_guinee.document_categories to service_role;
grant SELECT on table geg_guinee.document_categories to service_role;
grant TRIGGER on table geg_guinee.document_categories to service_role;
grant TRUNCATE on table geg_guinee.document_categories to service_role;
grant UPDATE on table geg_guinee.document_categories to service_role;
grant DELETE on table geg_guinee.documents to anon;
grant INSERT on table geg_guinee.documents to anon;
grant MAINTAIN on table geg_guinee.documents to anon;
grant REFERENCES on table geg_guinee.documents to anon;
grant SELECT on table geg_guinee.documents to anon;
grant TRIGGER on table geg_guinee.documents to anon;
grant TRUNCATE on table geg_guinee.documents to anon;
grant UPDATE on table geg_guinee.documents to anon;
grant DELETE on table geg_guinee.documents to authenticated;
grant INSERT on table geg_guinee.documents to authenticated;
grant MAINTAIN on table geg_guinee.documents to authenticated;
grant REFERENCES on table geg_guinee.documents to authenticated;
grant SELECT on table geg_guinee.documents to authenticated;
grant TRIGGER on table geg_guinee.documents to authenticated;
grant TRUNCATE on table geg_guinee.documents to authenticated;
grant UPDATE on table geg_guinee.documents to authenticated;
grant DELETE on table geg_guinee.documents to service_role;
grant INSERT on table geg_guinee.documents to service_role;
grant MAINTAIN on table geg_guinee.documents to service_role;
grant REFERENCES on table geg_guinee.documents to service_role;
grant SELECT on table geg_guinee.documents to service_role;
grant TRIGGER on table geg_guinee.documents to service_role;
grant TRUNCATE on table geg_guinee.documents to service_role;
grant UPDATE on table geg_guinee.documents to service_role;
grant DELETE on table geg_guinee.employees to anon;
grant INSERT on table geg_guinee.employees to anon;
grant MAINTAIN on table geg_guinee.employees to anon;
grant REFERENCES on table geg_guinee.employees to anon;
grant SELECT on table geg_guinee.employees to anon;
grant TRIGGER on table geg_guinee.employees to anon;
grant TRUNCATE on table geg_guinee.employees to anon;
grant UPDATE on table geg_guinee.employees to anon;
grant DELETE on table geg_guinee.employees to authenticated;
grant INSERT on table geg_guinee.employees to authenticated;
grant MAINTAIN on table geg_guinee.employees to authenticated;
grant REFERENCES on table geg_guinee.employees to authenticated;
grant SELECT on table geg_guinee.employees to authenticated;
grant TRIGGER on table geg_guinee.employees to authenticated;
grant TRUNCATE on table geg_guinee.employees to authenticated;
grant UPDATE on table geg_guinee.employees to authenticated;
grant DELETE on table geg_guinee.employees to service_role;
grant INSERT on table geg_guinee.employees to service_role;
grant MAINTAIN on table geg_guinee.employees to service_role;
grant REFERENCES on table geg_guinee.employees to service_role;
grant SELECT on table geg_guinee.employees to service_role;
grant TRIGGER on table geg_guinee.employees to service_role;
grant TRUNCATE on table geg_guinee.employees to service_role;
grant UPDATE on table geg_guinee.employees to service_role;
grant DELETE on table geg_guinee.exchange_rates to anon;
grant INSERT on table geg_guinee.exchange_rates to anon;
grant MAINTAIN on table geg_guinee.exchange_rates to anon;
grant REFERENCES on table geg_guinee.exchange_rates to anon;
grant SELECT on table geg_guinee.exchange_rates to anon;
grant TRIGGER on table geg_guinee.exchange_rates to anon;
grant TRUNCATE on table geg_guinee.exchange_rates to anon;
grant UPDATE on table geg_guinee.exchange_rates to anon;
grant DELETE on table geg_guinee.exchange_rates to authenticated;
grant INSERT on table geg_guinee.exchange_rates to authenticated;
grant MAINTAIN on table geg_guinee.exchange_rates to authenticated;
grant REFERENCES on table geg_guinee.exchange_rates to authenticated;
grant SELECT on table geg_guinee.exchange_rates to authenticated;
grant TRIGGER on table geg_guinee.exchange_rates to authenticated;
grant TRUNCATE on table geg_guinee.exchange_rates to authenticated;
grant UPDATE on table geg_guinee.exchange_rates to authenticated;
grant DELETE on table geg_guinee.exchange_rates to service_role;
grant INSERT on table geg_guinee.exchange_rates to service_role;
grant MAINTAIN on table geg_guinee.exchange_rates to service_role;
grant REFERENCES on table geg_guinee.exchange_rates to service_role;
grant SELECT on table geg_guinee.exchange_rates to service_role;
grant TRIGGER on table geg_guinee.exchange_rates to service_role;
grant TRUNCATE on table geg_guinee.exchange_rates to service_role;
grant UPDATE on table geg_guinee.exchange_rates to service_role;
grant DELETE on table geg_guinee.invoice_lines to anon;
grant INSERT on table geg_guinee.invoice_lines to anon;
grant MAINTAIN on table geg_guinee.invoice_lines to anon;
grant REFERENCES on table geg_guinee.invoice_lines to anon;
grant SELECT on table geg_guinee.invoice_lines to anon;
grant TRIGGER on table geg_guinee.invoice_lines to anon;
grant TRUNCATE on table geg_guinee.invoice_lines to anon;
grant UPDATE on table geg_guinee.invoice_lines to anon;
grant DELETE on table geg_guinee.invoice_lines to authenticated;
grant INSERT on table geg_guinee.invoice_lines to authenticated;
grant MAINTAIN on table geg_guinee.invoice_lines to authenticated;
grant REFERENCES on table geg_guinee.invoice_lines to authenticated;
grant SELECT on table geg_guinee.invoice_lines to authenticated;
grant TRIGGER on table geg_guinee.invoice_lines to authenticated;
grant TRUNCATE on table geg_guinee.invoice_lines to authenticated;
grant UPDATE on table geg_guinee.invoice_lines to authenticated;
grant DELETE on table geg_guinee.invoice_lines to service_role;
grant INSERT on table geg_guinee.invoice_lines to service_role;
grant MAINTAIN on table geg_guinee.invoice_lines to service_role;
grant REFERENCES on table geg_guinee.invoice_lines to service_role;
grant SELECT on table geg_guinee.invoice_lines to service_role;
grant TRIGGER on table geg_guinee.invoice_lines to service_role;
grant TRUNCATE on table geg_guinee.invoice_lines to service_role;
grant UPDATE on table geg_guinee.invoice_lines to service_role;
grant SELECT on table geg_guinee.invoice_totals to anon;
grant SELECT on table geg_guinee.invoice_totals to authenticated;
grant SELECT on table geg_guinee.invoice_totals to service_role;
grant DELETE on table geg_guinee.invoices to anon;
grant INSERT on table geg_guinee.invoices to anon;
grant MAINTAIN on table geg_guinee.invoices to anon;
grant REFERENCES on table geg_guinee.invoices to anon;
grant SELECT on table geg_guinee.invoices to anon;
grant TRIGGER on table geg_guinee.invoices to anon;
grant TRUNCATE on table geg_guinee.invoices to anon;
grant UPDATE on table geg_guinee.invoices to anon;
grant DELETE on table geg_guinee.invoices to authenticated;
grant INSERT on table geg_guinee.invoices to authenticated;
grant MAINTAIN on table geg_guinee.invoices to authenticated;
grant REFERENCES on table geg_guinee.invoices to authenticated;
grant SELECT on table geg_guinee.invoices to authenticated;
grant TRIGGER on table geg_guinee.invoices to authenticated;
grant TRUNCATE on table geg_guinee.invoices to authenticated;
grant UPDATE on table geg_guinee.invoices to authenticated;
grant DELETE on table geg_guinee.invoices to service_role;
grant INSERT on table geg_guinee.invoices to service_role;
grant MAINTAIN on table geg_guinee.invoices to service_role;
grant REFERENCES on table geg_guinee.invoices to service_role;
grant SELECT on table geg_guinee.invoices to service_role;
grant TRIGGER on table geg_guinee.invoices to service_role;
grant TRUNCATE on table geg_guinee.invoices to service_role;
grant UPDATE on table geg_guinee.invoices to service_role;
grant DELETE on table geg_guinee.payments to anon;
grant INSERT on table geg_guinee.payments to anon;
grant MAINTAIN on table geg_guinee.payments to anon;
grant REFERENCES on table geg_guinee.payments to anon;
grant SELECT on table geg_guinee.payments to anon;
grant TRIGGER on table geg_guinee.payments to anon;
grant TRUNCATE on table geg_guinee.payments to anon;
grant UPDATE on table geg_guinee.payments to anon;
grant DELETE on table geg_guinee.payments to authenticated;
grant INSERT on table geg_guinee.payments to authenticated;
grant MAINTAIN on table geg_guinee.payments to authenticated;
grant REFERENCES on table geg_guinee.payments to authenticated;
grant SELECT on table geg_guinee.payments to authenticated;
grant TRIGGER on table geg_guinee.payments to authenticated;
grant TRUNCATE on table geg_guinee.payments to authenticated;
grant UPDATE on table geg_guinee.payments to authenticated;
grant DELETE on table geg_guinee.payments to service_role;
grant INSERT on table geg_guinee.payments to service_role;
grant MAINTAIN on table geg_guinee.payments to service_role;
grant REFERENCES on table geg_guinee.payments to service_role;
grant SELECT on table geg_guinee.payments to service_role;
grant TRIGGER on table geg_guinee.payments to service_role;
grant TRUNCATE on table geg_guinee.payments to service_role;
grant UPDATE on table geg_guinee.payments to service_role;
grant DELETE on table geg_guinee.product_categories to anon;
grant INSERT on table geg_guinee.product_categories to anon;
grant MAINTAIN on table geg_guinee.product_categories to anon;
grant REFERENCES on table geg_guinee.product_categories to anon;
grant SELECT on table geg_guinee.product_categories to anon;
grant TRIGGER on table geg_guinee.product_categories to anon;
grant TRUNCATE on table geg_guinee.product_categories to anon;
grant UPDATE on table geg_guinee.product_categories to anon;
grant DELETE on table geg_guinee.product_categories to authenticated;
grant INSERT on table geg_guinee.product_categories to authenticated;
grant MAINTAIN on table geg_guinee.product_categories to authenticated;
grant REFERENCES on table geg_guinee.product_categories to authenticated;
grant SELECT on table geg_guinee.product_categories to authenticated;
grant TRIGGER on table geg_guinee.product_categories to authenticated;
grant TRUNCATE on table geg_guinee.product_categories to authenticated;
grant UPDATE on table geg_guinee.product_categories to authenticated;
grant DELETE on table geg_guinee.product_categories to service_role;
grant INSERT on table geg_guinee.product_categories to service_role;
grant MAINTAIN on table geg_guinee.product_categories to service_role;
grant REFERENCES on table geg_guinee.product_categories to service_role;
grant SELECT on table geg_guinee.product_categories to service_role;
grant TRIGGER on table geg_guinee.product_categories to service_role;
grant TRUNCATE on table geg_guinee.product_categories to service_role;
grant UPDATE on table geg_guinee.product_categories to service_role;
grant DELETE on table geg_guinee.product_documents to anon;
grant INSERT on table geg_guinee.product_documents to anon;
grant MAINTAIN on table geg_guinee.product_documents to anon;
grant REFERENCES on table geg_guinee.product_documents to anon;
grant SELECT on table geg_guinee.product_documents to anon;
grant TRIGGER on table geg_guinee.product_documents to anon;
grant TRUNCATE on table geg_guinee.product_documents to anon;
grant UPDATE on table geg_guinee.product_documents to anon;
grant DELETE on table geg_guinee.product_documents to authenticated;
grant INSERT on table geg_guinee.product_documents to authenticated;
grant MAINTAIN on table geg_guinee.product_documents to authenticated;
grant REFERENCES on table geg_guinee.product_documents to authenticated;
grant SELECT on table geg_guinee.product_documents to authenticated;
grant TRIGGER on table geg_guinee.product_documents to authenticated;
grant TRUNCATE on table geg_guinee.product_documents to authenticated;
grant UPDATE on table geg_guinee.product_documents to authenticated;
grant DELETE on table geg_guinee.product_documents to service_role;
grant INSERT on table geg_guinee.product_documents to service_role;
grant MAINTAIN on table geg_guinee.product_documents to service_role;
grant REFERENCES on table geg_guinee.product_documents to service_role;
grant SELECT on table geg_guinee.product_documents to service_role;
grant TRIGGER on table geg_guinee.product_documents to service_role;
grant TRUNCATE on table geg_guinee.product_documents to service_role;
grant UPDATE on table geg_guinee.product_documents to service_role;
grant DELETE on table geg_guinee.product_packaging to anon;
grant INSERT on table geg_guinee.product_packaging to anon;
grant MAINTAIN on table geg_guinee.product_packaging to anon;
grant REFERENCES on table geg_guinee.product_packaging to anon;
grant SELECT on table geg_guinee.product_packaging to anon;
grant TRIGGER on table geg_guinee.product_packaging to anon;
grant TRUNCATE on table geg_guinee.product_packaging to anon;
grant UPDATE on table geg_guinee.product_packaging to anon;
grant DELETE on table geg_guinee.product_packaging to authenticated;
grant INSERT on table geg_guinee.product_packaging to authenticated;
grant MAINTAIN on table geg_guinee.product_packaging to authenticated;
grant REFERENCES on table geg_guinee.product_packaging to authenticated;
grant SELECT on table geg_guinee.product_packaging to authenticated;
grant TRIGGER on table geg_guinee.product_packaging to authenticated;
grant TRUNCATE on table geg_guinee.product_packaging to authenticated;
grant UPDATE on table geg_guinee.product_packaging to authenticated;
grant DELETE on table geg_guinee.product_packaging to service_role;
grant INSERT on table geg_guinee.product_packaging to service_role;
grant MAINTAIN on table geg_guinee.product_packaging to service_role;
grant REFERENCES on table geg_guinee.product_packaging to service_role;
grant SELECT on table geg_guinee.product_packaging to service_role;
grant TRIGGER on table geg_guinee.product_packaging to service_role;
grant TRUNCATE on table geg_guinee.product_packaging to service_role;
grant UPDATE on table geg_guinee.product_packaging to service_role;
grant DELETE on table geg_guinee.products to anon;
grant INSERT on table geg_guinee.products to anon;
grant MAINTAIN on table geg_guinee.products to anon;
grant REFERENCES on table geg_guinee.products to anon;
grant SELECT on table geg_guinee.products to anon;
grant TRIGGER on table geg_guinee.products to anon;
grant TRUNCATE on table geg_guinee.products to anon;
grant UPDATE on table geg_guinee.products to anon;
grant DELETE on table geg_guinee.products to authenticated;
grant INSERT on table geg_guinee.products to authenticated;
grant MAINTAIN on table geg_guinee.products to authenticated;
grant REFERENCES on table geg_guinee.products to authenticated;
grant SELECT on table geg_guinee.products to authenticated;
grant TRIGGER on table geg_guinee.products to authenticated;
grant TRUNCATE on table geg_guinee.products to authenticated;
grant UPDATE on table geg_guinee.products to authenticated;
grant DELETE on table geg_guinee.products to service_role;
grant INSERT on table geg_guinee.products to service_role;
grant MAINTAIN on table geg_guinee.products to service_role;
grant REFERENCES on table geg_guinee.products to service_role;
grant SELECT on table geg_guinee.products to service_role;
grant TRIGGER on table geg_guinee.products to service_role;
grant TRUNCATE on table geg_guinee.products to service_role;
grant UPDATE on table geg_guinee.products to service_role;
grant DELETE on table geg_guinee.purchase_costs to anon;
grant INSERT on table geg_guinee.purchase_costs to anon;
grant MAINTAIN on table geg_guinee.purchase_costs to anon;
grant REFERENCES on table geg_guinee.purchase_costs to anon;
grant SELECT on table geg_guinee.purchase_costs to anon;
grant TRIGGER on table geg_guinee.purchase_costs to anon;
grant TRUNCATE on table geg_guinee.purchase_costs to anon;
grant UPDATE on table geg_guinee.purchase_costs to anon;
grant DELETE on table geg_guinee.purchase_costs to authenticated;
grant INSERT on table geg_guinee.purchase_costs to authenticated;
grant MAINTAIN on table geg_guinee.purchase_costs to authenticated;
grant REFERENCES on table geg_guinee.purchase_costs to authenticated;
grant SELECT on table geg_guinee.purchase_costs to authenticated;
grant TRIGGER on table geg_guinee.purchase_costs to authenticated;
grant TRUNCATE on table geg_guinee.purchase_costs to authenticated;
grant UPDATE on table geg_guinee.purchase_costs to authenticated;
grant DELETE on table geg_guinee.purchase_costs to service_role;
grant INSERT on table geg_guinee.purchase_costs to service_role;
grant MAINTAIN on table geg_guinee.purchase_costs to service_role;
grant REFERENCES on table geg_guinee.purchase_costs to service_role;
grant SELECT on table geg_guinee.purchase_costs to service_role;
grant TRIGGER on table geg_guinee.purchase_costs to service_role;
grant TRUNCATE on table geg_guinee.purchase_costs to service_role;
grant UPDATE on table geg_guinee.purchase_costs to service_role;
grant DELETE on table geg_guinee.purchase_landed_costs to anon;
grant INSERT on table geg_guinee.purchase_landed_costs to anon;
grant MAINTAIN on table geg_guinee.purchase_landed_costs to anon;
grant REFERENCES on table geg_guinee.purchase_landed_costs to anon;
grant SELECT on table geg_guinee.purchase_landed_costs to anon;
grant TRIGGER on table geg_guinee.purchase_landed_costs to anon;
grant TRUNCATE on table geg_guinee.purchase_landed_costs to anon;
grant UPDATE on table geg_guinee.purchase_landed_costs to anon;
grant DELETE on table geg_guinee.purchase_landed_costs to authenticated;
grant INSERT on table geg_guinee.purchase_landed_costs to authenticated;
grant MAINTAIN on table geg_guinee.purchase_landed_costs to authenticated;
grant REFERENCES on table geg_guinee.purchase_landed_costs to authenticated;
grant SELECT on table geg_guinee.purchase_landed_costs to authenticated;
grant TRIGGER on table geg_guinee.purchase_landed_costs to authenticated;
grant TRUNCATE on table geg_guinee.purchase_landed_costs to authenticated;
grant UPDATE on table geg_guinee.purchase_landed_costs to authenticated;
grant DELETE on table geg_guinee.purchase_landed_costs to service_role;
grant INSERT on table geg_guinee.purchase_landed_costs to service_role;
grant MAINTAIN on table geg_guinee.purchase_landed_costs to service_role;
grant REFERENCES on table geg_guinee.purchase_landed_costs to service_role;
grant SELECT on table geg_guinee.purchase_landed_costs to service_role;
grant TRIGGER on table geg_guinee.purchase_landed_costs to service_role;
grant TRUNCATE on table geg_guinee.purchase_landed_costs to service_role;
grant UPDATE on table geg_guinee.purchase_landed_costs to service_role;
grant DELETE on table geg_guinee.purchase_order_events to anon;
grant INSERT on table geg_guinee.purchase_order_events to anon;
grant MAINTAIN on table geg_guinee.purchase_order_events to anon;
grant REFERENCES on table geg_guinee.purchase_order_events to anon;
grant SELECT on table geg_guinee.purchase_order_events to anon;
grant TRIGGER on table geg_guinee.purchase_order_events to anon;
grant TRUNCATE on table geg_guinee.purchase_order_events to anon;
grant UPDATE on table geg_guinee.purchase_order_events to anon;
grant DELETE on table geg_guinee.purchase_order_events to authenticated;
grant INSERT on table geg_guinee.purchase_order_events to authenticated;
grant MAINTAIN on table geg_guinee.purchase_order_events to authenticated;
grant REFERENCES on table geg_guinee.purchase_order_events to authenticated;
grant SELECT on table geg_guinee.purchase_order_events to authenticated;
grant TRIGGER on table geg_guinee.purchase_order_events to authenticated;
grant TRUNCATE on table geg_guinee.purchase_order_events to authenticated;
grant UPDATE on table geg_guinee.purchase_order_events to authenticated;
grant DELETE on table geg_guinee.purchase_order_events to service_role;
grant INSERT on table geg_guinee.purchase_order_events to service_role;
grant MAINTAIN on table geg_guinee.purchase_order_events to service_role;
grant REFERENCES on table geg_guinee.purchase_order_events to service_role;
grant SELECT on table geg_guinee.purchase_order_events to service_role;
grant TRIGGER on table geg_guinee.purchase_order_events to service_role;
grant TRUNCATE on table geg_guinee.purchase_order_events to service_role;
grant UPDATE on table geg_guinee.purchase_order_events to service_role;
grant DELETE on table geg_guinee.purchase_order_lines to anon;
grant INSERT on table geg_guinee.purchase_order_lines to anon;
grant MAINTAIN on table geg_guinee.purchase_order_lines to anon;
grant REFERENCES on table geg_guinee.purchase_order_lines to anon;
grant SELECT on table geg_guinee.purchase_order_lines to anon;
grant TRIGGER on table geg_guinee.purchase_order_lines to anon;
grant TRUNCATE on table geg_guinee.purchase_order_lines to anon;
grant UPDATE on table geg_guinee.purchase_order_lines to anon;
grant DELETE on table geg_guinee.purchase_order_lines to authenticated;
grant INSERT on table geg_guinee.purchase_order_lines to authenticated;
grant MAINTAIN on table geg_guinee.purchase_order_lines to authenticated;
grant REFERENCES on table geg_guinee.purchase_order_lines to authenticated;
grant SELECT on table geg_guinee.purchase_order_lines to authenticated;
grant TRIGGER on table geg_guinee.purchase_order_lines to authenticated;
grant TRUNCATE on table geg_guinee.purchase_order_lines to authenticated;
grant UPDATE on table geg_guinee.purchase_order_lines to authenticated;
grant DELETE on table geg_guinee.purchase_order_lines to service_role;
grant INSERT on table geg_guinee.purchase_order_lines to service_role;
grant MAINTAIN on table geg_guinee.purchase_order_lines to service_role;
grant REFERENCES on table geg_guinee.purchase_order_lines to service_role;
grant SELECT on table geg_guinee.purchase_order_lines to service_role;
grant TRIGGER on table geg_guinee.purchase_order_lines to service_role;
grant TRUNCATE on table geg_guinee.purchase_order_lines to service_role;
grant UPDATE on table geg_guinee.purchase_order_lines to service_role;
grant DELETE on table geg_guinee.purchase_orders to anon;
grant INSERT on table geg_guinee.purchase_orders to anon;
grant MAINTAIN on table geg_guinee.purchase_orders to anon;
grant REFERENCES on table geg_guinee.purchase_orders to anon;
grant SELECT on table geg_guinee.purchase_orders to anon;
grant TRIGGER on table geg_guinee.purchase_orders to anon;
grant TRUNCATE on table geg_guinee.purchase_orders to anon;
grant UPDATE on table geg_guinee.purchase_orders to anon;
grant DELETE on table geg_guinee.purchase_orders to authenticated;
grant INSERT on table geg_guinee.purchase_orders to authenticated;
grant MAINTAIN on table geg_guinee.purchase_orders to authenticated;
grant REFERENCES on table geg_guinee.purchase_orders to authenticated;
grant SELECT on table geg_guinee.purchase_orders to authenticated;
grant TRIGGER on table geg_guinee.purchase_orders to authenticated;
grant TRUNCATE on table geg_guinee.purchase_orders to authenticated;
grant UPDATE on table geg_guinee.purchase_orders to authenticated;
grant DELETE on table geg_guinee.purchase_orders to service_role;
grant INSERT on table geg_guinee.purchase_orders to service_role;
grant MAINTAIN on table geg_guinee.purchase_orders to service_role;
grant REFERENCES on table geg_guinee.purchase_orders to service_role;
grant SELECT on table geg_guinee.purchase_orders to service_role;
grant TRIGGER on table geg_guinee.purchase_orders to service_role;
grant TRUNCATE on table geg_guinee.purchase_orders to service_role;
grant UPDATE on table geg_guinee.purchase_orders to service_role;
grant DELETE on table geg_guinee.purchase_reception_lines to authenticated;
grant INSERT on table geg_guinee.purchase_reception_lines to authenticated;
grant MAINTAIN on table geg_guinee.purchase_reception_lines to authenticated;
grant REFERENCES on table geg_guinee.purchase_reception_lines to authenticated;
grant SELECT on table geg_guinee.purchase_reception_lines to authenticated;
grant TRIGGER on table geg_guinee.purchase_reception_lines to authenticated;
grant TRUNCATE on table geg_guinee.purchase_reception_lines to authenticated;
grant UPDATE on table geg_guinee.purchase_reception_lines to authenticated;
grant DELETE on table geg_guinee.purchase_reception_lines to service_role;
grant INSERT on table geg_guinee.purchase_reception_lines to service_role;
grant MAINTAIN on table geg_guinee.purchase_reception_lines to service_role;
grant REFERENCES on table geg_guinee.purchase_reception_lines to service_role;
grant SELECT on table geg_guinee.purchase_reception_lines to service_role;
grant TRIGGER on table geg_guinee.purchase_reception_lines to service_role;
grant TRUNCATE on table geg_guinee.purchase_reception_lines to service_role;
grant UPDATE on table geg_guinee.purchase_reception_lines to service_role;
grant DELETE on table geg_guinee.purchase_receptions to authenticated;
grant INSERT on table geg_guinee.purchase_receptions to authenticated;
grant MAINTAIN on table geg_guinee.purchase_receptions to authenticated;
grant REFERENCES on table geg_guinee.purchase_receptions to authenticated;
grant SELECT on table geg_guinee.purchase_receptions to authenticated;
grant TRIGGER on table geg_guinee.purchase_receptions to authenticated;
grant TRUNCATE on table geg_guinee.purchase_receptions to authenticated;
grant UPDATE on table geg_guinee.purchase_receptions to authenticated;
grant DELETE on table geg_guinee.purchase_receptions to service_role;
grant INSERT on table geg_guinee.purchase_receptions to service_role;
grant MAINTAIN on table geg_guinee.purchase_receptions to service_role;
grant REFERENCES on table geg_guinee.purchase_receptions to service_role;
grant SELECT on table geg_guinee.purchase_receptions to service_role;
grant TRIGGER on table geg_guinee.purchase_receptions to service_role;
grant TRUNCATE on table geg_guinee.purchase_receptions to service_role;
grant UPDATE on table geg_guinee.purchase_receptions to service_role;
grant DELETE on table geg_guinee.sales_order_lines to anon;
grant INSERT on table geg_guinee.sales_order_lines to anon;
grant MAINTAIN on table geg_guinee.sales_order_lines to anon;
grant REFERENCES on table geg_guinee.sales_order_lines to anon;
grant SELECT on table geg_guinee.sales_order_lines to anon;
grant TRIGGER on table geg_guinee.sales_order_lines to anon;
grant TRUNCATE on table geg_guinee.sales_order_lines to anon;
grant UPDATE on table geg_guinee.sales_order_lines to anon;
grant DELETE on table geg_guinee.sales_order_lines to authenticated;
grant INSERT on table geg_guinee.sales_order_lines to authenticated;
grant MAINTAIN on table geg_guinee.sales_order_lines to authenticated;
grant REFERENCES on table geg_guinee.sales_order_lines to authenticated;
grant SELECT on table geg_guinee.sales_order_lines to authenticated;
grant TRIGGER on table geg_guinee.sales_order_lines to authenticated;
grant TRUNCATE on table geg_guinee.sales_order_lines to authenticated;
grant UPDATE on table geg_guinee.sales_order_lines to authenticated;
grant DELETE on table geg_guinee.sales_order_lines to service_role;
grant INSERT on table geg_guinee.sales_order_lines to service_role;
grant MAINTAIN on table geg_guinee.sales_order_lines to service_role;
grant REFERENCES on table geg_guinee.sales_order_lines to service_role;
grant SELECT on table geg_guinee.sales_order_lines to service_role;
grant TRIGGER on table geg_guinee.sales_order_lines to service_role;
grant TRUNCATE on table geg_guinee.sales_order_lines to service_role;
grant UPDATE on table geg_guinee.sales_order_lines to service_role;
grant DELETE on table geg_guinee.sales_order_totals to anon;
grant INSERT on table geg_guinee.sales_order_totals to anon;
grant MAINTAIN on table geg_guinee.sales_order_totals to anon;
grant REFERENCES on table geg_guinee.sales_order_totals to anon;
grant SELECT on table geg_guinee.sales_order_totals to anon;
grant TRIGGER on table geg_guinee.sales_order_totals to anon;
grant TRUNCATE on table geg_guinee.sales_order_totals to anon;
grant UPDATE on table geg_guinee.sales_order_totals to anon;
grant DELETE on table geg_guinee.sales_order_totals to authenticated;
grant INSERT on table geg_guinee.sales_order_totals to authenticated;
grant MAINTAIN on table geg_guinee.sales_order_totals to authenticated;
grant REFERENCES on table geg_guinee.sales_order_totals to authenticated;
grant SELECT on table geg_guinee.sales_order_totals to authenticated;
grant TRIGGER on table geg_guinee.sales_order_totals to authenticated;
grant TRUNCATE on table geg_guinee.sales_order_totals to authenticated;
grant UPDATE on table geg_guinee.sales_order_totals to authenticated;
grant DELETE on table geg_guinee.sales_order_totals to service_role;
grant INSERT on table geg_guinee.sales_order_totals to service_role;
grant MAINTAIN on table geg_guinee.sales_order_totals to service_role;
grant REFERENCES on table geg_guinee.sales_order_totals to service_role;
grant SELECT on table geg_guinee.sales_order_totals to service_role;
grant TRIGGER on table geg_guinee.sales_order_totals to service_role;
grant TRUNCATE on table geg_guinee.sales_order_totals to service_role;
grant UPDATE on table geg_guinee.sales_order_totals to service_role;
grant DELETE on table geg_guinee.sales_orders to anon;
grant INSERT on table geg_guinee.sales_orders to anon;
grant MAINTAIN on table geg_guinee.sales_orders to anon;
grant REFERENCES on table geg_guinee.sales_orders to anon;
grant SELECT on table geg_guinee.sales_orders to anon;
grant TRIGGER on table geg_guinee.sales_orders to anon;
grant TRUNCATE on table geg_guinee.sales_orders to anon;
grant UPDATE on table geg_guinee.sales_orders to anon;
grant DELETE on table geg_guinee.sales_orders to authenticated;
grant INSERT on table geg_guinee.sales_orders to authenticated;
grant MAINTAIN on table geg_guinee.sales_orders to authenticated;
grant REFERENCES on table geg_guinee.sales_orders to authenticated;
grant SELECT on table geg_guinee.sales_orders to authenticated;
grant TRIGGER on table geg_guinee.sales_orders to authenticated;
grant TRUNCATE on table geg_guinee.sales_orders to authenticated;
grant UPDATE on table geg_guinee.sales_orders to authenticated;
grant DELETE on table geg_guinee.sales_orders to service_role;
grant INSERT on table geg_guinee.sales_orders to service_role;
grant MAINTAIN on table geg_guinee.sales_orders to service_role;
grant REFERENCES on table geg_guinee.sales_orders to service_role;
grant SELECT on table geg_guinee.sales_orders to service_role;
grant TRIGGER on table geg_guinee.sales_orders to service_role;
grant TRUNCATE on table geg_guinee.sales_orders to service_role;
grant UPDATE on table geg_guinee.sales_orders to service_role;
grant DELETE on table geg_guinee.shipments to service_role;
grant INSERT on table geg_guinee.shipments to service_role;
grant MAINTAIN on table geg_guinee.shipments to service_role;
grant REFERENCES on table geg_guinee.shipments to service_role;
grant SELECT on table geg_guinee.shipments to service_role;
grant TRIGGER on table geg_guinee.shipments to service_role;
grant TRUNCATE on table geg_guinee.shipments to service_role;
grant UPDATE on table geg_guinee.shipments to service_role;
grant DELETE on table geg_guinee.stock_levels to anon;
grant INSERT on table geg_guinee.stock_levels to anon;
grant MAINTAIN on table geg_guinee.stock_levels to anon;
grant REFERENCES on table geg_guinee.stock_levels to anon;
grant SELECT on table geg_guinee.stock_levels to anon;
grant TRIGGER on table geg_guinee.stock_levels to anon;
grant TRUNCATE on table geg_guinee.stock_levels to anon;
grant UPDATE on table geg_guinee.stock_levels to anon;
grant DELETE on table geg_guinee.stock_levels to authenticated;
grant INSERT on table geg_guinee.stock_levels to authenticated;
grant MAINTAIN on table geg_guinee.stock_levels to authenticated;
grant REFERENCES on table geg_guinee.stock_levels to authenticated;
grant SELECT on table geg_guinee.stock_levels to authenticated;
grant TRIGGER on table geg_guinee.stock_levels to authenticated;
grant TRUNCATE on table geg_guinee.stock_levels to authenticated;
grant UPDATE on table geg_guinee.stock_levels to authenticated;
grant DELETE on table geg_guinee.stock_levels to service_role;
grant INSERT on table geg_guinee.stock_levels to service_role;
grant MAINTAIN on table geg_guinee.stock_levels to service_role;
grant REFERENCES on table geg_guinee.stock_levels to service_role;
grant SELECT on table geg_guinee.stock_levels to service_role;
grant TRIGGER on table geg_guinee.stock_levels to service_role;
grant TRUNCATE on table geg_guinee.stock_levels to service_role;
grant UPDATE on table geg_guinee.stock_levels to service_role;
grant DELETE on table geg_guinee.stock_moves to anon;
grant INSERT on table geg_guinee.stock_moves to anon;
grant MAINTAIN on table geg_guinee.stock_moves to anon;
grant REFERENCES on table geg_guinee.stock_moves to anon;
grant SELECT on table geg_guinee.stock_moves to anon;
grant TRIGGER on table geg_guinee.stock_moves to anon;
grant TRUNCATE on table geg_guinee.stock_moves to anon;
grant UPDATE on table geg_guinee.stock_moves to anon;
grant DELETE on table geg_guinee.stock_moves to authenticated;
grant INSERT on table geg_guinee.stock_moves to authenticated;
grant MAINTAIN on table geg_guinee.stock_moves to authenticated;
grant REFERENCES on table geg_guinee.stock_moves to authenticated;
grant SELECT on table geg_guinee.stock_moves to authenticated;
grant TRIGGER on table geg_guinee.stock_moves to authenticated;
grant TRUNCATE on table geg_guinee.stock_moves to authenticated;
grant UPDATE on table geg_guinee.stock_moves to authenticated;
grant DELETE on table geg_guinee.stock_moves to service_role;
grant INSERT on table geg_guinee.stock_moves to service_role;
grant MAINTAIN on table geg_guinee.stock_moves to service_role;
grant REFERENCES on table geg_guinee.stock_moves to service_role;
grant SELECT on table geg_guinee.stock_moves to service_role;
grant TRIGGER on table geg_guinee.stock_moves to service_role;
grant TRUNCATE on table geg_guinee.stock_moves to service_role;
grant UPDATE on table geg_guinee.stock_moves to service_role;
grant DELETE on table geg_guinee.supplier_invoice_lines to anon;
grant INSERT on table geg_guinee.supplier_invoice_lines to anon;
grant MAINTAIN on table geg_guinee.supplier_invoice_lines to anon;
grant REFERENCES on table geg_guinee.supplier_invoice_lines to anon;
grant SELECT on table geg_guinee.supplier_invoice_lines to anon;
grant TRIGGER on table geg_guinee.supplier_invoice_lines to anon;
grant TRUNCATE on table geg_guinee.supplier_invoice_lines to anon;
grant UPDATE on table geg_guinee.supplier_invoice_lines to anon;
grant DELETE on table geg_guinee.supplier_invoice_lines to authenticated;
grant INSERT on table geg_guinee.supplier_invoice_lines to authenticated;
grant MAINTAIN on table geg_guinee.supplier_invoice_lines to authenticated;
grant REFERENCES on table geg_guinee.supplier_invoice_lines to authenticated;
grant SELECT on table geg_guinee.supplier_invoice_lines to authenticated;
grant TRIGGER on table geg_guinee.supplier_invoice_lines to authenticated;
grant TRUNCATE on table geg_guinee.supplier_invoice_lines to authenticated;
grant UPDATE on table geg_guinee.supplier_invoice_lines to authenticated;
grant DELETE on table geg_guinee.supplier_invoice_lines to service_role;
grant INSERT on table geg_guinee.supplier_invoice_lines to service_role;
grant MAINTAIN on table geg_guinee.supplier_invoice_lines to service_role;
grant REFERENCES on table geg_guinee.supplier_invoice_lines to service_role;
grant SELECT on table geg_guinee.supplier_invoice_lines to service_role;
grant TRIGGER on table geg_guinee.supplier_invoice_lines to service_role;
grant TRUNCATE on table geg_guinee.supplier_invoice_lines to service_role;
grant UPDATE on table geg_guinee.supplier_invoice_lines to service_role;
grant SELECT on table geg_guinee.supplier_invoice_totals to anon;
grant SELECT on table geg_guinee.supplier_invoice_totals to authenticated;
grant DELETE on table geg_guinee.supplier_invoice_totals to service_role;
grant INSERT on table geg_guinee.supplier_invoice_totals to service_role;
grant MAINTAIN on table geg_guinee.supplier_invoice_totals to service_role;
grant REFERENCES on table geg_guinee.supplier_invoice_totals to service_role;
grant SELECT on table geg_guinee.supplier_invoice_totals to service_role;
grant TRIGGER on table geg_guinee.supplier_invoice_totals to service_role;
grant TRUNCATE on table geg_guinee.supplier_invoice_totals to service_role;
grant UPDATE on table geg_guinee.supplier_invoice_totals to service_role;
grant DELETE on table geg_guinee.supplier_invoices to anon;
grant INSERT on table geg_guinee.supplier_invoices to anon;
grant MAINTAIN on table geg_guinee.supplier_invoices to anon;
grant REFERENCES on table geg_guinee.supplier_invoices to anon;
grant SELECT on table geg_guinee.supplier_invoices to anon;
grant TRIGGER on table geg_guinee.supplier_invoices to anon;
grant TRUNCATE on table geg_guinee.supplier_invoices to anon;
grant UPDATE on table geg_guinee.supplier_invoices to anon;
grant DELETE on table geg_guinee.supplier_invoices to authenticated;
grant INSERT on table geg_guinee.supplier_invoices to authenticated;
grant MAINTAIN on table geg_guinee.supplier_invoices to authenticated;
grant REFERENCES on table geg_guinee.supplier_invoices to authenticated;
grant SELECT on table geg_guinee.supplier_invoices to authenticated;
grant TRIGGER on table geg_guinee.supplier_invoices to authenticated;
grant TRUNCATE on table geg_guinee.supplier_invoices to authenticated;
grant UPDATE on table geg_guinee.supplier_invoices to authenticated;
grant DELETE on table geg_guinee.supplier_invoices to service_role;
grant INSERT on table geg_guinee.supplier_invoices to service_role;
grant MAINTAIN on table geg_guinee.supplier_invoices to service_role;
grant REFERENCES on table geg_guinee.supplier_invoices to service_role;
grant SELECT on table geg_guinee.supplier_invoices to service_role;
grant TRIGGER on table geg_guinee.supplier_invoices to service_role;
grant TRUNCATE on table geg_guinee.supplier_invoices to service_role;
grant UPDATE on table geg_guinee.supplier_invoices to service_role;
grant DELETE on table geg_guinee.supplier_payments to anon;
grant INSERT on table geg_guinee.supplier_payments to anon;
grant MAINTAIN on table geg_guinee.supplier_payments to anon;
grant REFERENCES on table geg_guinee.supplier_payments to anon;
grant SELECT on table geg_guinee.supplier_payments to anon;
grant TRIGGER on table geg_guinee.supplier_payments to anon;
grant TRUNCATE on table geg_guinee.supplier_payments to anon;
grant UPDATE on table geg_guinee.supplier_payments to anon;
grant DELETE on table geg_guinee.supplier_payments to authenticated;
grant INSERT on table geg_guinee.supplier_payments to authenticated;
grant MAINTAIN on table geg_guinee.supplier_payments to authenticated;
grant REFERENCES on table geg_guinee.supplier_payments to authenticated;
grant SELECT on table geg_guinee.supplier_payments to authenticated;
grant TRIGGER on table geg_guinee.supplier_payments to authenticated;
grant TRUNCATE on table geg_guinee.supplier_payments to authenticated;
grant UPDATE on table geg_guinee.supplier_payments to authenticated;
grant DELETE on table geg_guinee.supplier_payments to service_role;
grant INSERT on table geg_guinee.supplier_payments to service_role;
grant MAINTAIN on table geg_guinee.supplier_payments to service_role;
grant REFERENCES on table geg_guinee.supplier_payments to service_role;
grant SELECT on table geg_guinee.supplier_payments to service_role;
grant TRIGGER on table geg_guinee.supplier_payments to service_role;
grant TRUNCATE on table geg_guinee.supplier_payments to service_role;
grant UPDATE on table geg_guinee.supplier_payments to service_role;
grant DELETE on table geg_guinee.suppliers to anon;
grant INSERT on table geg_guinee.suppliers to anon;
grant MAINTAIN on table geg_guinee.suppliers to anon;
grant REFERENCES on table geg_guinee.suppliers to anon;
grant SELECT on table geg_guinee.suppliers to anon;
grant TRIGGER on table geg_guinee.suppliers to anon;
grant TRUNCATE on table geg_guinee.suppliers to anon;
grant UPDATE on table geg_guinee.suppliers to anon;
grant DELETE on table geg_guinee.suppliers to authenticated;
grant INSERT on table geg_guinee.suppliers to authenticated;
grant MAINTAIN on table geg_guinee.suppliers to authenticated;
grant REFERENCES on table geg_guinee.suppliers to authenticated;
grant SELECT on table geg_guinee.suppliers to authenticated;
grant TRIGGER on table geg_guinee.suppliers to authenticated;
grant TRUNCATE on table geg_guinee.suppliers to authenticated;
grant UPDATE on table geg_guinee.suppliers to authenticated;
grant DELETE on table geg_guinee.suppliers to service_role;
grant INSERT on table geg_guinee.suppliers to service_role;
grant MAINTAIN on table geg_guinee.suppliers to service_role;
grant REFERENCES on table geg_guinee.suppliers to service_role;
grant SELECT on table geg_guinee.suppliers to service_role;
grant TRIGGER on table geg_guinee.suppliers to service_role;
grant TRUNCATE on table geg_guinee.suppliers to service_role;
grant UPDATE on table geg_guinee.suppliers to service_role;
grant DELETE on table geg_guinee.treasury_accounts to anon;
grant INSERT on table geg_guinee.treasury_accounts to anon;
grant MAINTAIN on table geg_guinee.treasury_accounts to anon;
grant REFERENCES on table geg_guinee.treasury_accounts to anon;
grant SELECT on table geg_guinee.treasury_accounts to anon;
grant TRIGGER on table geg_guinee.treasury_accounts to anon;
grant TRUNCATE on table geg_guinee.treasury_accounts to anon;
grant UPDATE on table geg_guinee.treasury_accounts to anon;
grant DELETE on table geg_guinee.treasury_accounts to authenticated;
grant INSERT on table geg_guinee.treasury_accounts to authenticated;
grant MAINTAIN on table geg_guinee.treasury_accounts to authenticated;
grant REFERENCES on table geg_guinee.treasury_accounts to authenticated;
grant SELECT on table geg_guinee.treasury_accounts to authenticated;
grant TRIGGER on table geg_guinee.treasury_accounts to authenticated;
grant TRUNCATE on table geg_guinee.treasury_accounts to authenticated;
grant UPDATE on table geg_guinee.treasury_accounts to authenticated;
grant DELETE on table geg_guinee.treasury_accounts to service_role;
grant INSERT on table geg_guinee.treasury_accounts to service_role;
grant MAINTAIN on table geg_guinee.treasury_accounts to service_role;
grant REFERENCES on table geg_guinee.treasury_accounts to service_role;
grant SELECT on table geg_guinee.treasury_accounts to service_role;
grant TRIGGER on table geg_guinee.treasury_accounts to service_role;
grant TRUNCATE on table geg_guinee.treasury_accounts to service_role;
grant UPDATE on table geg_guinee.treasury_accounts to service_role;
grant SELECT on table geg_guinee.treasury_balances to authenticated;
grant DELETE on table geg_guinee.treasury_balances to service_role;
grant INSERT on table geg_guinee.treasury_balances to service_role;
grant MAINTAIN on table geg_guinee.treasury_balances to service_role;
grant REFERENCES on table geg_guinee.treasury_balances to service_role;
grant SELECT on table geg_guinee.treasury_balances to service_role;
grant TRIGGER on table geg_guinee.treasury_balances to service_role;
grant TRUNCATE on table geg_guinee.treasury_balances to service_role;
grant UPDATE on table geg_guinee.treasury_balances to service_role;
grant DELETE on table geg_guinee.treasury_transactions to anon;
grant INSERT on table geg_guinee.treasury_transactions to anon;
grant MAINTAIN on table geg_guinee.treasury_transactions to anon;
grant REFERENCES on table geg_guinee.treasury_transactions to anon;
grant SELECT on table geg_guinee.treasury_transactions to anon;
grant TRIGGER on table geg_guinee.treasury_transactions to anon;
grant TRUNCATE on table geg_guinee.treasury_transactions to anon;
grant UPDATE on table geg_guinee.treasury_transactions to anon;
grant DELETE on table geg_guinee.treasury_transactions to authenticated;
grant INSERT on table geg_guinee.treasury_transactions to authenticated;
grant MAINTAIN on table geg_guinee.treasury_transactions to authenticated;
grant REFERENCES on table geg_guinee.treasury_transactions to authenticated;
grant SELECT on table geg_guinee.treasury_transactions to authenticated;
grant TRIGGER on table geg_guinee.treasury_transactions to authenticated;
grant TRUNCATE on table geg_guinee.treasury_transactions to authenticated;
grant UPDATE on table geg_guinee.treasury_transactions to authenticated;
grant DELETE on table geg_guinee.treasury_transactions to service_role;
grant INSERT on table geg_guinee.treasury_transactions to service_role;
grant MAINTAIN on table geg_guinee.treasury_transactions to service_role;
grant REFERENCES on table geg_guinee.treasury_transactions to service_role;
grant SELECT on table geg_guinee.treasury_transactions to service_role;
grant TRIGGER on table geg_guinee.treasury_transactions to service_role;
grant TRUNCATE on table geg_guinee.treasury_transactions to service_role;
grant UPDATE on table geg_guinee.treasury_transactions to service_role;
grant DELETE on table geg_guinee.units to anon;
grant INSERT on table geg_guinee.units to anon;
grant MAINTAIN on table geg_guinee.units to anon;
grant REFERENCES on table geg_guinee.units to anon;
grant SELECT on table geg_guinee.units to anon;
grant TRIGGER on table geg_guinee.units to anon;
grant TRUNCATE on table geg_guinee.units to anon;
grant UPDATE on table geg_guinee.units to anon;
grant DELETE on table geg_guinee.units to authenticated;
grant INSERT on table geg_guinee.units to authenticated;
grant MAINTAIN on table geg_guinee.units to authenticated;
grant REFERENCES on table geg_guinee.units to authenticated;
grant SELECT on table geg_guinee.units to authenticated;
grant TRIGGER on table geg_guinee.units to authenticated;
grant TRUNCATE on table geg_guinee.units to authenticated;
grant UPDATE on table geg_guinee.units to authenticated;
grant DELETE on table geg_guinee.units to service_role;
grant INSERT on table geg_guinee.units to service_role;
grant MAINTAIN on table geg_guinee.units to service_role;
grant REFERENCES on table geg_guinee.units to service_role;
grant SELECT on table geg_guinee.units to service_role;
grant TRIGGER on table geg_guinee.units to service_role;
grant TRUNCATE on table geg_guinee.units to service_role;
grant UPDATE on table geg_guinee.units to service_role;
grant DELETE on table geg_guinee.warehouses to anon;
grant INSERT on table geg_guinee.warehouses to anon;
grant MAINTAIN on table geg_guinee.warehouses to anon;
grant REFERENCES on table geg_guinee.warehouses to anon;
grant SELECT on table geg_guinee.warehouses to anon;
grant TRIGGER on table geg_guinee.warehouses to anon;
grant TRUNCATE on table geg_guinee.warehouses to anon;
grant UPDATE on table geg_guinee.warehouses to anon;
grant DELETE on table geg_guinee.warehouses to authenticated;
grant INSERT on table geg_guinee.warehouses to authenticated;
grant MAINTAIN on table geg_guinee.warehouses to authenticated;
grant REFERENCES on table geg_guinee.warehouses to authenticated;
grant SELECT on table geg_guinee.warehouses to authenticated;
grant TRIGGER on table geg_guinee.warehouses to authenticated;
grant TRUNCATE on table geg_guinee.warehouses to authenticated;
grant UPDATE on table geg_guinee.warehouses to authenticated;
grant DELETE on table geg_guinee.warehouses to service_role;
grant INSERT on table geg_guinee.warehouses to service_role;
grant MAINTAIN on table geg_guinee.warehouses to service_role;
grant REFERENCES on table geg_guinee.warehouses to service_role;
grant SELECT on table geg_guinee.warehouses to service_role;
grant TRIGGER on table geg_guinee.warehouses to service_role;
grant TRUNCATE on table geg_guinee.warehouses to service_role;
grant UPDATE on table geg_guinee.warehouses to service_role;
grant DELETE on table geg_singapore.accounts to anon;
grant INSERT on table geg_singapore.accounts to anon;
grant MAINTAIN on table geg_singapore.accounts to anon;
grant REFERENCES on table geg_singapore.accounts to anon;
grant SELECT on table geg_singapore.accounts to anon;
grant TRIGGER on table geg_singapore.accounts to anon;
grant TRUNCATE on table geg_singapore.accounts to anon;
grant UPDATE on table geg_singapore.accounts to anon;
grant DELETE on table geg_singapore.accounts to authenticated;
grant INSERT on table geg_singapore.accounts to authenticated;
grant MAINTAIN on table geg_singapore.accounts to authenticated;
grant REFERENCES on table geg_singapore.accounts to authenticated;
grant SELECT on table geg_singapore.accounts to authenticated;
grant TRIGGER on table geg_singapore.accounts to authenticated;
grant TRUNCATE on table geg_singapore.accounts to authenticated;
grant UPDATE on table geg_singapore.accounts to authenticated;
grant DELETE on table geg_singapore.accounts to service_role;
grant INSERT on table geg_singapore.accounts to service_role;
grant MAINTAIN on table geg_singapore.accounts to service_role;
grant REFERENCES on table geg_singapore.accounts to service_role;
grant SELECT on table geg_singapore.accounts to service_role;
grant TRIGGER on table geg_singapore.accounts to service_role;
grant TRUNCATE on table geg_singapore.accounts to service_role;
grant UPDATE on table geg_singapore.accounts to service_role;
grant DELETE on table geg_singapore.activities to anon;
grant INSERT on table geg_singapore.activities to anon;
grant MAINTAIN on table geg_singapore.activities to anon;
grant REFERENCES on table geg_singapore.activities to anon;
grant SELECT on table geg_singapore.activities to anon;
grant TRIGGER on table geg_singapore.activities to anon;
grant TRUNCATE on table geg_singapore.activities to anon;
grant UPDATE on table geg_singapore.activities to anon;
grant DELETE on table geg_singapore.activities to authenticated;
grant INSERT on table geg_singapore.activities to authenticated;
grant MAINTAIN on table geg_singapore.activities to authenticated;
grant REFERENCES on table geg_singapore.activities to authenticated;
grant SELECT on table geg_singapore.activities to authenticated;
grant TRIGGER on table geg_singapore.activities to authenticated;
grant TRUNCATE on table geg_singapore.activities to authenticated;
grant UPDATE on table geg_singapore.activities to authenticated;
grant DELETE on table geg_singapore.activities to service_role;
grant INSERT on table geg_singapore.activities to service_role;
grant MAINTAIN on table geg_singapore.activities to service_role;
grant REFERENCES on table geg_singapore.activities to service_role;
grant SELECT on table geg_singapore.activities to service_role;
grant TRIGGER on table geg_singapore.activities to service_role;
grant TRUNCATE on table geg_singapore.activities to service_role;
grant UPDATE on table geg_singapore.activities to service_role;
grant DELETE on table geg_singapore.activity_logs to anon;
grant INSERT on table geg_singapore.activity_logs to anon;
grant MAINTAIN on table geg_singapore.activity_logs to anon;
grant REFERENCES on table geg_singapore.activity_logs to anon;
grant SELECT on table geg_singapore.activity_logs to anon;
grant TRIGGER on table geg_singapore.activity_logs to anon;
grant TRUNCATE on table geg_singapore.activity_logs to anon;
grant UPDATE on table geg_singapore.activity_logs to anon;
grant DELETE on table geg_singapore.activity_logs to authenticated;
grant INSERT on table geg_singapore.activity_logs to authenticated;
grant MAINTAIN on table geg_singapore.activity_logs to authenticated;
grant REFERENCES on table geg_singapore.activity_logs to authenticated;
grant SELECT on table geg_singapore.activity_logs to authenticated;
grant TRIGGER on table geg_singapore.activity_logs to authenticated;
grant TRUNCATE on table geg_singapore.activity_logs to authenticated;
grant UPDATE on table geg_singapore.activity_logs to authenticated;
grant DELETE on table geg_singapore.activity_logs to service_role;
grant INSERT on table geg_singapore.activity_logs to service_role;
grant MAINTAIN on table geg_singapore.activity_logs to service_role;
grant REFERENCES on table geg_singapore.activity_logs to service_role;
grant SELECT on table geg_singapore.activity_logs to service_role;
grant TRIGGER on table geg_singapore.activity_logs to service_role;
grant TRUNCATE on table geg_singapore.activity_logs to service_role;
grant UPDATE on table geg_singapore.activity_logs to service_role;
grant DELETE on table geg_singapore.chat_messages to anon;
grant INSERT on table geg_singapore.chat_messages to anon;
grant MAINTAIN on table geg_singapore.chat_messages to anon;
grant REFERENCES on table geg_singapore.chat_messages to anon;
grant SELECT on table geg_singapore.chat_messages to anon;
grant TRIGGER on table geg_singapore.chat_messages to anon;
grant TRUNCATE on table geg_singapore.chat_messages to anon;
grant UPDATE on table geg_singapore.chat_messages to anon;
grant DELETE on table geg_singapore.chat_messages to authenticated;
grant INSERT on table geg_singapore.chat_messages to authenticated;
grant MAINTAIN on table geg_singapore.chat_messages to authenticated;
grant REFERENCES on table geg_singapore.chat_messages to authenticated;
grant SELECT on table geg_singapore.chat_messages to authenticated;
grant TRIGGER on table geg_singapore.chat_messages to authenticated;
grant TRUNCATE on table geg_singapore.chat_messages to authenticated;
grant UPDATE on table geg_singapore.chat_messages to authenticated;
grant DELETE on table geg_singapore.chat_messages to service_role;
grant INSERT on table geg_singapore.chat_messages to service_role;
grant MAINTAIN on table geg_singapore.chat_messages to service_role;
grant REFERENCES on table geg_singapore.chat_messages to service_role;
grant SELECT on table geg_singapore.chat_messages to service_role;
grant TRIGGER on table geg_singapore.chat_messages to service_role;
grant TRUNCATE on table geg_singapore.chat_messages to service_role;
grant UPDATE on table geg_singapore.chat_messages to service_role;
grant DELETE on table geg_singapore.chat_read_receipts to anon;
grant INSERT on table geg_singapore.chat_read_receipts to anon;
grant MAINTAIN on table geg_singapore.chat_read_receipts to anon;
grant REFERENCES on table geg_singapore.chat_read_receipts to anon;
grant SELECT on table geg_singapore.chat_read_receipts to anon;
grant TRIGGER on table geg_singapore.chat_read_receipts to anon;
grant TRUNCATE on table geg_singapore.chat_read_receipts to anon;
grant UPDATE on table geg_singapore.chat_read_receipts to anon;
grant DELETE on table geg_singapore.chat_read_receipts to authenticated;
grant INSERT on table geg_singapore.chat_read_receipts to authenticated;
grant MAINTAIN on table geg_singapore.chat_read_receipts to authenticated;
grant REFERENCES on table geg_singapore.chat_read_receipts to authenticated;
grant SELECT on table geg_singapore.chat_read_receipts to authenticated;
grant TRIGGER on table geg_singapore.chat_read_receipts to authenticated;
grant TRUNCATE on table geg_singapore.chat_read_receipts to authenticated;
grant UPDATE on table geg_singapore.chat_read_receipts to authenticated;
grant DELETE on table geg_singapore.chat_read_receipts to service_role;
grant INSERT on table geg_singapore.chat_read_receipts to service_role;
grant MAINTAIN on table geg_singapore.chat_read_receipts to service_role;
grant REFERENCES on table geg_singapore.chat_read_receipts to service_role;
grant SELECT on table geg_singapore.chat_read_receipts to service_role;
grant TRIGGER on table geg_singapore.chat_read_receipts to service_role;
grant TRUNCATE on table geg_singapore.chat_read_receipts to service_role;
grant UPDATE on table geg_singapore.chat_read_receipts to service_role;
grant DELETE on table geg_singapore.chat_rooms to anon;
grant INSERT on table geg_singapore.chat_rooms to anon;
grant MAINTAIN on table geg_singapore.chat_rooms to anon;
grant REFERENCES on table geg_singapore.chat_rooms to anon;
grant SELECT on table geg_singapore.chat_rooms to anon;
grant TRIGGER on table geg_singapore.chat_rooms to anon;
grant TRUNCATE on table geg_singapore.chat_rooms to anon;
grant UPDATE on table geg_singapore.chat_rooms to anon;
grant DELETE on table geg_singapore.chat_rooms to authenticated;
grant INSERT on table geg_singapore.chat_rooms to authenticated;
grant MAINTAIN on table geg_singapore.chat_rooms to authenticated;
grant REFERENCES on table geg_singapore.chat_rooms to authenticated;
grant SELECT on table geg_singapore.chat_rooms to authenticated;
grant TRIGGER on table geg_singapore.chat_rooms to authenticated;
grant TRUNCATE on table geg_singapore.chat_rooms to authenticated;
grant UPDATE on table geg_singapore.chat_rooms to authenticated;
grant DELETE on table geg_singapore.chat_rooms to service_role;
grant INSERT on table geg_singapore.chat_rooms to service_role;
grant MAINTAIN on table geg_singapore.chat_rooms to service_role;
grant REFERENCES on table geg_singapore.chat_rooms to service_role;
grant SELECT on table geg_singapore.chat_rooms to service_role;
grant TRIGGER on table geg_singapore.chat_rooms to service_role;
grant TRUNCATE on table geg_singapore.chat_rooms to service_role;
grant UPDATE on table geg_singapore.chat_rooms to service_role;
grant DELETE on table geg_singapore.commissions to anon;
grant INSERT on table geg_singapore.commissions to anon;
grant MAINTAIN on table geg_singapore.commissions to anon;
grant REFERENCES on table geg_singapore.commissions to anon;
grant SELECT on table geg_singapore.commissions to anon;
grant TRIGGER on table geg_singapore.commissions to anon;
grant TRUNCATE on table geg_singapore.commissions to anon;
grant UPDATE on table geg_singapore.commissions to anon;
grant DELETE on table geg_singapore.commissions to authenticated;
grant INSERT on table geg_singapore.commissions to authenticated;
grant MAINTAIN on table geg_singapore.commissions to authenticated;
grant REFERENCES on table geg_singapore.commissions to authenticated;
grant SELECT on table geg_singapore.commissions to authenticated;
grant TRIGGER on table geg_singapore.commissions to authenticated;
grant TRUNCATE on table geg_singapore.commissions to authenticated;
grant UPDATE on table geg_singapore.commissions to authenticated;
grant DELETE on table geg_singapore.commissions to service_role;
grant INSERT on table geg_singapore.commissions to service_role;
grant MAINTAIN on table geg_singapore.commissions to service_role;
grant REFERENCES on table geg_singapore.commissions to service_role;
grant SELECT on table geg_singapore.commissions to service_role;
grant TRIGGER on table geg_singapore.commissions to service_role;
grant TRUNCATE on table geg_singapore.commissions to service_role;
grant UPDATE on table geg_singapore.commissions to service_role;
grant DELETE on table geg_singapore.contacts to anon;
grant INSERT on table geg_singapore.contacts to anon;
grant MAINTAIN on table geg_singapore.contacts to anon;
grant REFERENCES on table geg_singapore.contacts to anon;
grant SELECT on table geg_singapore.contacts to anon;
grant TRIGGER on table geg_singapore.contacts to anon;
grant TRUNCATE on table geg_singapore.contacts to anon;
grant UPDATE on table geg_singapore.contacts to anon;
grant DELETE on table geg_singapore.contacts to authenticated;
grant INSERT on table geg_singapore.contacts to authenticated;
grant MAINTAIN on table geg_singapore.contacts to authenticated;
grant REFERENCES on table geg_singapore.contacts to authenticated;
grant SELECT on table geg_singapore.contacts to authenticated;
grant TRIGGER on table geg_singapore.contacts to authenticated;
grant TRUNCATE on table geg_singapore.contacts to authenticated;
grant UPDATE on table geg_singapore.contacts to authenticated;
grant DELETE on table geg_singapore.contacts to service_role;
grant INSERT on table geg_singapore.contacts to service_role;
grant MAINTAIN on table geg_singapore.contacts to service_role;
grant REFERENCES on table geg_singapore.contacts to service_role;
grant SELECT on table geg_singapore.contacts to service_role;
grant TRIGGER on table geg_singapore.contacts to service_role;
grant TRUNCATE on table geg_singapore.contacts to service_role;
grant UPDATE on table geg_singapore.contacts to service_role;
grant DELETE on table geg_singapore.deals to anon;
grant INSERT on table geg_singapore.deals to anon;
grant MAINTAIN on table geg_singapore.deals to anon;
grant REFERENCES on table geg_singapore.deals to anon;
grant SELECT on table geg_singapore.deals to anon;
grant TRIGGER on table geg_singapore.deals to anon;
grant TRUNCATE on table geg_singapore.deals to anon;
grant UPDATE on table geg_singapore.deals to anon;
grant DELETE on table geg_singapore.deals to authenticated;
grant INSERT on table geg_singapore.deals to authenticated;
grant MAINTAIN on table geg_singapore.deals to authenticated;
grant REFERENCES on table geg_singapore.deals to authenticated;
grant SELECT on table geg_singapore.deals to authenticated;
grant TRIGGER on table geg_singapore.deals to authenticated;
grant TRUNCATE on table geg_singapore.deals to authenticated;
grant UPDATE on table geg_singapore.deals to authenticated;
grant DELETE on table geg_singapore.deals to service_role;
grant INSERT on table geg_singapore.deals to service_role;
grant MAINTAIN on table geg_singapore.deals to service_role;
grant REFERENCES on table geg_singapore.deals to service_role;
grant SELECT on table geg_singapore.deals to service_role;
grant TRIGGER on table geg_singapore.deals to service_role;
grant TRUNCATE on table geg_singapore.deals to service_role;
grant UPDATE on table geg_singapore.deals to service_role;
grant DELETE on table geg_singapore.delivery_note_lines to anon;
grant INSERT on table geg_singapore.delivery_note_lines to anon;
grant MAINTAIN on table geg_singapore.delivery_note_lines to anon;
grant REFERENCES on table geg_singapore.delivery_note_lines to anon;
grant SELECT on table geg_singapore.delivery_note_lines to anon;
grant TRIGGER on table geg_singapore.delivery_note_lines to anon;
grant TRUNCATE on table geg_singapore.delivery_note_lines to anon;
grant UPDATE on table geg_singapore.delivery_note_lines to anon;
grant DELETE on table geg_singapore.delivery_note_lines to authenticated;
grant INSERT on table geg_singapore.delivery_note_lines to authenticated;
grant MAINTAIN on table geg_singapore.delivery_note_lines to authenticated;
grant REFERENCES on table geg_singapore.delivery_note_lines to authenticated;
grant SELECT on table geg_singapore.delivery_note_lines to authenticated;
grant TRIGGER on table geg_singapore.delivery_note_lines to authenticated;
grant TRUNCATE on table geg_singapore.delivery_note_lines to authenticated;
grant UPDATE on table geg_singapore.delivery_note_lines to authenticated;
grant DELETE on table geg_singapore.delivery_note_lines to service_role;
grant INSERT on table geg_singapore.delivery_note_lines to service_role;
grant MAINTAIN on table geg_singapore.delivery_note_lines to service_role;
grant REFERENCES on table geg_singapore.delivery_note_lines to service_role;
grant SELECT on table geg_singapore.delivery_note_lines to service_role;
grant TRIGGER on table geg_singapore.delivery_note_lines to service_role;
grant TRUNCATE on table geg_singapore.delivery_note_lines to service_role;
grant UPDATE on table geg_singapore.delivery_note_lines to service_role;
grant DELETE on table geg_singapore.delivery_notes to anon;
grant INSERT on table geg_singapore.delivery_notes to anon;
grant MAINTAIN on table geg_singapore.delivery_notes to anon;
grant REFERENCES on table geg_singapore.delivery_notes to anon;
grant SELECT on table geg_singapore.delivery_notes to anon;
grant TRIGGER on table geg_singapore.delivery_notes to anon;
grant TRUNCATE on table geg_singapore.delivery_notes to anon;
grant UPDATE on table geg_singapore.delivery_notes to anon;
grant DELETE on table geg_singapore.delivery_notes to authenticated;
grant INSERT on table geg_singapore.delivery_notes to authenticated;
grant MAINTAIN on table geg_singapore.delivery_notes to authenticated;
grant REFERENCES on table geg_singapore.delivery_notes to authenticated;
grant SELECT on table geg_singapore.delivery_notes to authenticated;
grant TRIGGER on table geg_singapore.delivery_notes to authenticated;
grant TRUNCATE on table geg_singapore.delivery_notes to authenticated;
grant UPDATE on table geg_singapore.delivery_notes to authenticated;
grant DELETE on table geg_singapore.delivery_notes to service_role;
grant INSERT on table geg_singapore.delivery_notes to service_role;
grant MAINTAIN on table geg_singapore.delivery_notes to service_role;
grant REFERENCES on table geg_singapore.delivery_notes to service_role;
grant SELECT on table geg_singapore.delivery_notes to service_role;
grant TRIGGER on table geg_singapore.delivery_notes to service_role;
grant TRUNCATE on table geg_singapore.delivery_notes to service_role;
grant UPDATE on table geg_singapore.delivery_notes to service_role;
grant DELETE on table geg_singapore.document_categories to anon;
grant INSERT on table geg_singapore.document_categories to anon;
grant MAINTAIN on table geg_singapore.document_categories to anon;
grant REFERENCES on table geg_singapore.document_categories to anon;
grant SELECT on table geg_singapore.document_categories to anon;
grant TRIGGER on table geg_singapore.document_categories to anon;
grant TRUNCATE on table geg_singapore.document_categories to anon;
grant UPDATE on table geg_singapore.document_categories to anon;
grant DELETE on table geg_singapore.document_categories to authenticated;
grant INSERT on table geg_singapore.document_categories to authenticated;
grant MAINTAIN on table geg_singapore.document_categories to authenticated;
grant REFERENCES on table geg_singapore.document_categories to authenticated;
grant SELECT on table geg_singapore.document_categories to authenticated;
grant TRIGGER on table geg_singapore.document_categories to authenticated;
grant TRUNCATE on table geg_singapore.document_categories to authenticated;
grant UPDATE on table geg_singapore.document_categories to authenticated;
grant DELETE on table geg_singapore.document_categories to service_role;
grant INSERT on table geg_singapore.document_categories to service_role;
grant MAINTAIN on table geg_singapore.document_categories to service_role;
grant REFERENCES on table geg_singapore.document_categories to service_role;
grant SELECT on table geg_singapore.document_categories to service_role;
grant TRIGGER on table geg_singapore.document_categories to service_role;
grant TRUNCATE on table geg_singapore.document_categories to service_role;
grant UPDATE on table geg_singapore.document_categories to service_role;
grant DELETE on table geg_singapore.documents to anon;
grant INSERT on table geg_singapore.documents to anon;
grant MAINTAIN on table geg_singapore.documents to anon;
grant REFERENCES on table geg_singapore.documents to anon;
grant SELECT on table geg_singapore.documents to anon;
grant TRIGGER on table geg_singapore.documents to anon;
grant TRUNCATE on table geg_singapore.documents to anon;
grant UPDATE on table geg_singapore.documents to anon;
grant DELETE on table geg_singapore.documents to authenticated;
grant INSERT on table geg_singapore.documents to authenticated;
grant MAINTAIN on table geg_singapore.documents to authenticated;
grant REFERENCES on table geg_singapore.documents to authenticated;
grant SELECT on table geg_singapore.documents to authenticated;
grant TRIGGER on table geg_singapore.documents to authenticated;
grant TRUNCATE on table geg_singapore.documents to authenticated;
grant UPDATE on table geg_singapore.documents to authenticated;
grant DELETE on table geg_singapore.documents to service_role;
grant INSERT on table geg_singapore.documents to service_role;
grant MAINTAIN on table geg_singapore.documents to service_role;
grant REFERENCES on table geg_singapore.documents to service_role;
grant SELECT on table geg_singapore.documents to service_role;
grant TRIGGER on table geg_singapore.documents to service_role;
grant TRUNCATE on table geg_singapore.documents to service_role;
grant UPDATE on table geg_singapore.documents to service_role;
grant DELETE on table geg_singapore.employees to anon;
grant INSERT on table geg_singapore.employees to anon;
grant MAINTAIN on table geg_singapore.employees to anon;
grant REFERENCES on table geg_singapore.employees to anon;
grant SELECT on table geg_singapore.employees to anon;
grant TRIGGER on table geg_singapore.employees to anon;
grant TRUNCATE on table geg_singapore.employees to anon;
grant UPDATE on table geg_singapore.employees to anon;
grant DELETE on table geg_singapore.employees to authenticated;
grant INSERT on table geg_singapore.employees to authenticated;
grant MAINTAIN on table geg_singapore.employees to authenticated;
grant REFERENCES on table geg_singapore.employees to authenticated;
grant SELECT on table geg_singapore.employees to authenticated;
grant TRIGGER on table geg_singapore.employees to authenticated;
grant TRUNCATE on table geg_singapore.employees to authenticated;
grant UPDATE on table geg_singapore.employees to authenticated;
grant DELETE on table geg_singapore.employees to service_role;
grant INSERT on table geg_singapore.employees to service_role;
grant MAINTAIN on table geg_singapore.employees to service_role;
grant REFERENCES on table geg_singapore.employees to service_role;
grant SELECT on table geg_singapore.employees to service_role;
grant TRIGGER on table geg_singapore.employees to service_role;
grant TRUNCATE on table geg_singapore.employees to service_role;
grant UPDATE on table geg_singapore.employees to service_role;
grant DELETE on table geg_singapore.exchange_rates to anon;
grant INSERT on table geg_singapore.exchange_rates to anon;
grant MAINTAIN on table geg_singapore.exchange_rates to anon;
grant REFERENCES on table geg_singapore.exchange_rates to anon;
grant SELECT on table geg_singapore.exchange_rates to anon;
grant TRIGGER on table geg_singapore.exchange_rates to anon;
grant TRUNCATE on table geg_singapore.exchange_rates to anon;
grant UPDATE on table geg_singapore.exchange_rates to anon;
grant DELETE on table geg_singapore.exchange_rates to authenticated;
grant INSERT on table geg_singapore.exchange_rates to authenticated;
grant MAINTAIN on table geg_singapore.exchange_rates to authenticated;
grant REFERENCES on table geg_singapore.exchange_rates to authenticated;
grant SELECT on table geg_singapore.exchange_rates to authenticated;
grant TRIGGER on table geg_singapore.exchange_rates to authenticated;
grant TRUNCATE on table geg_singapore.exchange_rates to authenticated;
grant UPDATE on table geg_singapore.exchange_rates to authenticated;
grant DELETE on table geg_singapore.exchange_rates to service_role;
grant INSERT on table geg_singapore.exchange_rates to service_role;
grant MAINTAIN on table geg_singapore.exchange_rates to service_role;
grant REFERENCES on table geg_singapore.exchange_rates to service_role;
grant SELECT on table geg_singapore.exchange_rates to service_role;
grant TRIGGER on table geg_singapore.exchange_rates to service_role;
grant TRUNCATE on table geg_singapore.exchange_rates to service_role;
grant UPDATE on table geg_singapore.exchange_rates to service_role;
grant DELETE on table geg_singapore.invoice_lines to anon;
grant INSERT on table geg_singapore.invoice_lines to anon;
grant MAINTAIN on table geg_singapore.invoice_lines to anon;
grant REFERENCES on table geg_singapore.invoice_lines to anon;
grant SELECT on table geg_singapore.invoice_lines to anon;
grant TRIGGER on table geg_singapore.invoice_lines to anon;
grant TRUNCATE on table geg_singapore.invoice_lines to anon;
grant UPDATE on table geg_singapore.invoice_lines to anon;
grant DELETE on table geg_singapore.invoice_lines to authenticated;
grant INSERT on table geg_singapore.invoice_lines to authenticated;
grant MAINTAIN on table geg_singapore.invoice_lines to authenticated;
grant REFERENCES on table geg_singapore.invoice_lines to authenticated;
grant SELECT on table geg_singapore.invoice_lines to authenticated;
grant TRIGGER on table geg_singapore.invoice_lines to authenticated;
grant TRUNCATE on table geg_singapore.invoice_lines to authenticated;
grant UPDATE on table geg_singapore.invoice_lines to authenticated;
grant DELETE on table geg_singapore.invoice_lines to service_role;
grant INSERT on table geg_singapore.invoice_lines to service_role;
grant MAINTAIN on table geg_singapore.invoice_lines to service_role;
grant REFERENCES on table geg_singapore.invoice_lines to service_role;
grant SELECT on table geg_singapore.invoice_lines to service_role;
grant TRIGGER on table geg_singapore.invoice_lines to service_role;
grant TRUNCATE on table geg_singapore.invoice_lines to service_role;
grant UPDATE on table geg_singapore.invoice_lines to service_role;
grant DELETE on table geg_singapore.invoices to anon;
grant INSERT on table geg_singapore.invoices to anon;
grant MAINTAIN on table geg_singapore.invoices to anon;
grant REFERENCES on table geg_singapore.invoices to anon;
grant SELECT on table geg_singapore.invoices to anon;
grant TRIGGER on table geg_singapore.invoices to anon;
grant TRUNCATE on table geg_singapore.invoices to anon;
grant UPDATE on table geg_singapore.invoices to anon;
grant DELETE on table geg_singapore.invoices to authenticated;
grant INSERT on table geg_singapore.invoices to authenticated;
grant MAINTAIN on table geg_singapore.invoices to authenticated;
grant REFERENCES on table geg_singapore.invoices to authenticated;
grant SELECT on table geg_singapore.invoices to authenticated;
grant TRIGGER on table geg_singapore.invoices to authenticated;
grant TRUNCATE on table geg_singapore.invoices to authenticated;
grant UPDATE on table geg_singapore.invoices to authenticated;
grant DELETE on table geg_singapore.invoices to service_role;
grant INSERT on table geg_singapore.invoices to service_role;
grant MAINTAIN on table geg_singapore.invoices to service_role;
grant REFERENCES on table geg_singapore.invoices to service_role;
grant SELECT on table geg_singapore.invoices to service_role;
grant TRIGGER on table geg_singapore.invoices to service_role;
grant TRUNCATE on table geg_singapore.invoices to service_role;
grant UPDATE on table geg_singapore.invoices to service_role;
grant DELETE on table geg_singapore.payments to anon;
grant INSERT on table geg_singapore.payments to anon;
grant MAINTAIN on table geg_singapore.payments to anon;
grant REFERENCES on table geg_singapore.payments to anon;
grant SELECT on table geg_singapore.payments to anon;
grant TRIGGER on table geg_singapore.payments to anon;
grant TRUNCATE on table geg_singapore.payments to anon;
grant UPDATE on table geg_singapore.payments to anon;
grant DELETE on table geg_singapore.payments to authenticated;
grant INSERT on table geg_singapore.payments to authenticated;
grant MAINTAIN on table geg_singapore.payments to authenticated;
grant REFERENCES on table geg_singapore.payments to authenticated;
grant SELECT on table geg_singapore.payments to authenticated;
grant TRIGGER on table geg_singapore.payments to authenticated;
grant TRUNCATE on table geg_singapore.payments to authenticated;
grant UPDATE on table geg_singapore.payments to authenticated;
grant DELETE on table geg_singapore.payments to service_role;
grant INSERT on table geg_singapore.payments to service_role;
grant MAINTAIN on table geg_singapore.payments to service_role;
grant REFERENCES on table geg_singapore.payments to service_role;
grant SELECT on table geg_singapore.payments to service_role;
grant TRIGGER on table geg_singapore.payments to service_role;
grant TRUNCATE on table geg_singapore.payments to service_role;
grant UPDATE on table geg_singapore.payments to service_role;
grant DELETE on table geg_singapore.product_categories to anon;
grant INSERT on table geg_singapore.product_categories to anon;
grant MAINTAIN on table geg_singapore.product_categories to anon;
grant REFERENCES on table geg_singapore.product_categories to anon;
grant SELECT on table geg_singapore.product_categories to anon;
grant TRIGGER on table geg_singapore.product_categories to anon;
grant TRUNCATE on table geg_singapore.product_categories to anon;
grant UPDATE on table geg_singapore.product_categories to anon;
grant DELETE on table geg_singapore.product_categories to authenticated;
grant INSERT on table geg_singapore.product_categories to authenticated;
grant MAINTAIN on table geg_singapore.product_categories to authenticated;
grant REFERENCES on table geg_singapore.product_categories to authenticated;
grant SELECT on table geg_singapore.product_categories to authenticated;
grant TRIGGER on table geg_singapore.product_categories to authenticated;
grant TRUNCATE on table geg_singapore.product_categories to authenticated;
grant UPDATE on table geg_singapore.product_categories to authenticated;
grant DELETE on table geg_singapore.product_categories to service_role;
grant INSERT on table geg_singapore.product_categories to service_role;
grant MAINTAIN on table geg_singapore.product_categories to service_role;
grant REFERENCES on table geg_singapore.product_categories to service_role;
grant SELECT on table geg_singapore.product_categories to service_role;
grant TRIGGER on table geg_singapore.product_categories to service_role;
grant TRUNCATE on table geg_singapore.product_categories to service_role;
grant UPDATE on table geg_singapore.product_categories to service_role;
grant DELETE on table geg_singapore.product_documents to anon;
grant INSERT on table geg_singapore.product_documents to anon;
grant MAINTAIN on table geg_singapore.product_documents to anon;
grant REFERENCES on table geg_singapore.product_documents to anon;
grant SELECT on table geg_singapore.product_documents to anon;
grant TRIGGER on table geg_singapore.product_documents to anon;
grant TRUNCATE on table geg_singapore.product_documents to anon;
grant UPDATE on table geg_singapore.product_documents to anon;
grant DELETE on table geg_singapore.product_documents to authenticated;
grant INSERT on table geg_singapore.product_documents to authenticated;
grant MAINTAIN on table geg_singapore.product_documents to authenticated;
grant REFERENCES on table geg_singapore.product_documents to authenticated;
grant SELECT on table geg_singapore.product_documents to authenticated;
grant TRIGGER on table geg_singapore.product_documents to authenticated;
grant TRUNCATE on table geg_singapore.product_documents to authenticated;
grant UPDATE on table geg_singapore.product_documents to authenticated;
grant DELETE on table geg_singapore.product_documents to service_role;
grant INSERT on table geg_singapore.product_documents to service_role;
grant MAINTAIN on table geg_singapore.product_documents to service_role;
grant REFERENCES on table geg_singapore.product_documents to service_role;
grant SELECT on table geg_singapore.product_documents to service_role;
grant TRIGGER on table geg_singapore.product_documents to service_role;
grant TRUNCATE on table geg_singapore.product_documents to service_role;
grant UPDATE on table geg_singapore.product_documents to service_role;
grant DELETE on table geg_singapore.products to anon;
grant INSERT on table geg_singapore.products to anon;
grant MAINTAIN on table geg_singapore.products to anon;
grant REFERENCES on table geg_singapore.products to anon;
grant SELECT on table geg_singapore.products to anon;
grant TRIGGER on table geg_singapore.products to anon;
grant TRUNCATE on table geg_singapore.products to anon;
grant UPDATE on table geg_singapore.products to anon;
grant DELETE on table geg_singapore.products to authenticated;
grant INSERT on table geg_singapore.products to authenticated;
grant MAINTAIN on table geg_singapore.products to authenticated;
grant REFERENCES on table geg_singapore.products to authenticated;
grant SELECT on table geg_singapore.products to authenticated;
grant TRIGGER on table geg_singapore.products to authenticated;
grant TRUNCATE on table geg_singapore.products to authenticated;
grant UPDATE on table geg_singapore.products to authenticated;
grant DELETE on table geg_singapore.products to service_role;
grant INSERT on table geg_singapore.products to service_role;
grant MAINTAIN on table geg_singapore.products to service_role;
grant REFERENCES on table geg_singapore.products to service_role;
grant SELECT on table geg_singapore.products to service_role;
grant TRIGGER on table geg_singapore.products to service_role;
grant TRUNCATE on table geg_singapore.products to service_role;
grant UPDATE on table geg_singapore.products to service_role;
grant DELETE on table geg_singapore.purchase_costs to anon;
grant INSERT on table geg_singapore.purchase_costs to anon;
grant MAINTAIN on table geg_singapore.purchase_costs to anon;
grant REFERENCES on table geg_singapore.purchase_costs to anon;
grant SELECT on table geg_singapore.purchase_costs to anon;
grant TRIGGER on table geg_singapore.purchase_costs to anon;
grant TRUNCATE on table geg_singapore.purchase_costs to anon;
grant UPDATE on table geg_singapore.purchase_costs to anon;
grant DELETE on table geg_singapore.purchase_costs to authenticated;
grant INSERT on table geg_singapore.purchase_costs to authenticated;
grant MAINTAIN on table geg_singapore.purchase_costs to authenticated;
grant REFERENCES on table geg_singapore.purchase_costs to authenticated;
grant SELECT on table geg_singapore.purchase_costs to authenticated;
grant TRIGGER on table geg_singapore.purchase_costs to authenticated;
grant TRUNCATE on table geg_singapore.purchase_costs to authenticated;
grant UPDATE on table geg_singapore.purchase_costs to authenticated;
grant DELETE on table geg_singapore.purchase_costs to service_role;
grant INSERT on table geg_singapore.purchase_costs to service_role;
grant MAINTAIN on table geg_singapore.purchase_costs to service_role;
grant REFERENCES on table geg_singapore.purchase_costs to service_role;
grant SELECT on table geg_singapore.purchase_costs to service_role;
grant TRIGGER on table geg_singapore.purchase_costs to service_role;
grant TRUNCATE on table geg_singapore.purchase_costs to service_role;
grant UPDATE on table geg_singapore.purchase_costs to service_role;
grant DELETE on table geg_singapore.purchase_order_lines to anon;
grant INSERT on table geg_singapore.purchase_order_lines to anon;
grant MAINTAIN on table geg_singapore.purchase_order_lines to anon;
grant REFERENCES on table geg_singapore.purchase_order_lines to anon;
grant SELECT on table geg_singapore.purchase_order_lines to anon;
grant TRIGGER on table geg_singapore.purchase_order_lines to anon;
grant TRUNCATE on table geg_singapore.purchase_order_lines to anon;
grant UPDATE on table geg_singapore.purchase_order_lines to anon;
grant DELETE on table geg_singapore.purchase_order_lines to authenticated;
grant INSERT on table geg_singapore.purchase_order_lines to authenticated;
grant MAINTAIN on table geg_singapore.purchase_order_lines to authenticated;
grant REFERENCES on table geg_singapore.purchase_order_lines to authenticated;
grant SELECT on table geg_singapore.purchase_order_lines to authenticated;
grant TRIGGER on table geg_singapore.purchase_order_lines to authenticated;
grant TRUNCATE on table geg_singapore.purchase_order_lines to authenticated;
grant UPDATE on table geg_singapore.purchase_order_lines to authenticated;
grant DELETE on table geg_singapore.purchase_order_lines to service_role;
grant INSERT on table geg_singapore.purchase_order_lines to service_role;
grant MAINTAIN on table geg_singapore.purchase_order_lines to service_role;
grant REFERENCES on table geg_singapore.purchase_order_lines to service_role;
grant SELECT on table geg_singapore.purchase_order_lines to service_role;
grant TRIGGER on table geg_singapore.purchase_order_lines to service_role;
grant TRUNCATE on table geg_singapore.purchase_order_lines to service_role;
grant UPDATE on table geg_singapore.purchase_order_lines to service_role;
grant DELETE on table geg_singapore.purchase_orders to anon;
grant INSERT on table geg_singapore.purchase_orders to anon;
grant MAINTAIN on table geg_singapore.purchase_orders to anon;
grant REFERENCES on table geg_singapore.purchase_orders to anon;
grant SELECT on table geg_singapore.purchase_orders to anon;
grant TRIGGER on table geg_singapore.purchase_orders to anon;
grant TRUNCATE on table geg_singapore.purchase_orders to anon;
grant UPDATE on table geg_singapore.purchase_orders to anon;
grant DELETE on table geg_singapore.purchase_orders to authenticated;
grant INSERT on table geg_singapore.purchase_orders to authenticated;
grant MAINTAIN on table geg_singapore.purchase_orders to authenticated;
grant REFERENCES on table geg_singapore.purchase_orders to authenticated;
grant SELECT on table geg_singapore.purchase_orders to authenticated;
grant TRIGGER on table geg_singapore.purchase_orders to authenticated;
grant TRUNCATE on table geg_singapore.purchase_orders to authenticated;
grant UPDATE on table geg_singapore.purchase_orders to authenticated;
grant DELETE on table geg_singapore.purchase_orders to service_role;
grant INSERT on table geg_singapore.purchase_orders to service_role;
grant MAINTAIN on table geg_singapore.purchase_orders to service_role;
grant REFERENCES on table geg_singapore.purchase_orders to service_role;
grant SELECT on table geg_singapore.purchase_orders to service_role;
grant TRIGGER on table geg_singapore.purchase_orders to service_role;
grant TRUNCATE on table geg_singapore.purchase_orders to service_role;
grant UPDATE on table geg_singapore.purchase_orders to service_role;
grant DELETE on table geg_singapore.purchase_reception_lines to anon;
grant INSERT on table geg_singapore.purchase_reception_lines to anon;
grant MAINTAIN on table geg_singapore.purchase_reception_lines to anon;
grant REFERENCES on table geg_singapore.purchase_reception_lines to anon;
grant SELECT on table geg_singapore.purchase_reception_lines to anon;
grant TRIGGER on table geg_singapore.purchase_reception_lines to anon;
grant TRUNCATE on table geg_singapore.purchase_reception_lines to anon;
grant UPDATE on table geg_singapore.purchase_reception_lines to anon;
grant DELETE on table geg_singapore.purchase_reception_lines to authenticated;
grant INSERT on table geg_singapore.purchase_reception_lines to authenticated;
grant MAINTAIN on table geg_singapore.purchase_reception_lines to authenticated;
grant REFERENCES on table geg_singapore.purchase_reception_lines to authenticated;
grant SELECT on table geg_singapore.purchase_reception_lines to authenticated;
grant TRIGGER on table geg_singapore.purchase_reception_lines to authenticated;
grant TRUNCATE on table geg_singapore.purchase_reception_lines to authenticated;
grant UPDATE on table geg_singapore.purchase_reception_lines to authenticated;
grant DELETE on table geg_singapore.purchase_reception_lines to service_role;
grant INSERT on table geg_singapore.purchase_reception_lines to service_role;
grant MAINTAIN on table geg_singapore.purchase_reception_lines to service_role;
grant REFERENCES on table geg_singapore.purchase_reception_lines to service_role;
grant SELECT on table geg_singapore.purchase_reception_lines to service_role;
grant TRIGGER on table geg_singapore.purchase_reception_lines to service_role;
grant TRUNCATE on table geg_singapore.purchase_reception_lines to service_role;
grant UPDATE on table geg_singapore.purchase_reception_lines to service_role;
grant DELETE on table geg_singapore.purchase_receptions to anon;
grant INSERT on table geg_singapore.purchase_receptions to anon;
grant MAINTAIN on table geg_singapore.purchase_receptions to anon;
grant REFERENCES on table geg_singapore.purchase_receptions to anon;
grant SELECT on table geg_singapore.purchase_receptions to anon;
grant TRIGGER on table geg_singapore.purchase_receptions to anon;
grant TRUNCATE on table geg_singapore.purchase_receptions to anon;
grant UPDATE on table geg_singapore.purchase_receptions to anon;
grant DELETE on table geg_singapore.purchase_receptions to authenticated;
grant INSERT on table geg_singapore.purchase_receptions to authenticated;
grant MAINTAIN on table geg_singapore.purchase_receptions to authenticated;
grant REFERENCES on table geg_singapore.purchase_receptions to authenticated;
grant SELECT on table geg_singapore.purchase_receptions to authenticated;
grant TRIGGER on table geg_singapore.purchase_receptions to authenticated;
grant TRUNCATE on table geg_singapore.purchase_receptions to authenticated;
grant UPDATE on table geg_singapore.purchase_receptions to authenticated;
grant DELETE on table geg_singapore.purchase_receptions to service_role;
grant INSERT on table geg_singapore.purchase_receptions to service_role;
grant MAINTAIN on table geg_singapore.purchase_receptions to service_role;
grant REFERENCES on table geg_singapore.purchase_receptions to service_role;
grant SELECT on table geg_singapore.purchase_receptions to service_role;
grant TRIGGER on table geg_singapore.purchase_receptions to service_role;
grant TRUNCATE on table geg_singapore.purchase_receptions to service_role;
grant UPDATE on table geg_singapore.purchase_receptions to service_role;
grant DELETE on table geg_singapore.sales_order_lines to anon;
grant INSERT on table geg_singapore.sales_order_lines to anon;
grant MAINTAIN on table geg_singapore.sales_order_lines to anon;
grant REFERENCES on table geg_singapore.sales_order_lines to anon;
grant SELECT on table geg_singapore.sales_order_lines to anon;
grant TRIGGER on table geg_singapore.sales_order_lines to anon;
grant TRUNCATE on table geg_singapore.sales_order_lines to anon;
grant UPDATE on table geg_singapore.sales_order_lines to anon;
grant DELETE on table geg_singapore.sales_order_lines to authenticated;
grant INSERT on table geg_singapore.sales_order_lines to authenticated;
grant MAINTAIN on table geg_singapore.sales_order_lines to authenticated;
grant REFERENCES on table geg_singapore.sales_order_lines to authenticated;
grant SELECT on table geg_singapore.sales_order_lines to authenticated;
grant TRIGGER on table geg_singapore.sales_order_lines to authenticated;
grant TRUNCATE on table geg_singapore.sales_order_lines to authenticated;
grant UPDATE on table geg_singapore.sales_order_lines to authenticated;
grant DELETE on table geg_singapore.sales_order_lines to service_role;
grant INSERT on table geg_singapore.sales_order_lines to service_role;
grant MAINTAIN on table geg_singapore.sales_order_lines to service_role;
grant REFERENCES on table geg_singapore.sales_order_lines to service_role;
grant SELECT on table geg_singapore.sales_order_lines to service_role;
grant TRIGGER on table geg_singapore.sales_order_lines to service_role;
grant TRUNCATE on table geg_singapore.sales_order_lines to service_role;
grant UPDATE on table geg_singapore.sales_order_lines to service_role;
grant DELETE on table geg_singapore.sales_orders to anon;
grant INSERT on table geg_singapore.sales_orders to anon;
grant MAINTAIN on table geg_singapore.sales_orders to anon;
grant REFERENCES on table geg_singapore.sales_orders to anon;
grant SELECT on table geg_singapore.sales_orders to anon;
grant TRIGGER on table geg_singapore.sales_orders to anon;
grant TRUNCATE on table geg_singapore.sales_orders to anon;
grant UPDATE on table geg_singapore.sales_orders to anon;
grant DELETE on table geg_singapore.sales_orders to authenticated;
grant INSERT on table geg_singapore.sales_orders to authenticated;
grant MAINTAIN on table geg_singapore.sales_orders to authenticated;
grant REFERENCES on table geg_singapore.sales_orders to authenticated;
grant SELECT on table geg_singapore.sales_orders to authenticated;
grant TRIGGER on table geg_singapore.sales_orders to authenticated;
grant TRUNCATE on table geg_singapore.sales_orders to authenticated;
grant UPDATE on table geg_singapore.sales_orders to authenticated;
grant DELETE on table geg_singapore.sales_orders to service_role;
grant INSERT on table geg_singapore.sales_orders to service_role;
grant MAINTAIN on table geg_singapore.sales_orders to service_role;
grant REFERENCES on table geg_singapore.sales_orders to service_role;
grant SELECT on table geg_singapore.sales_orders to service_role;
grant TRIGGER on table geg_singapore.sales_orders to service_role;
grant TRUNCATE on table geg_singapore.sales_orders to service_role;
grant UPDATE on table geg_singapore.sales_orders to service_role;
grant DELETE on table geg_singapore.shipments to anon;
grant INSERT on table geg_singapore.shipments to anon;
grant MAINTAIN on table geg_singapore.shipments to anon;
grant REFERENCES on table geg_singapore.shipments to anon;
grant SELECT on table geg_singapore.shipments to anon;
grant TRIGGER on table geg_singapore.shipments to anon;
grant TRUNCATE on table geg_singapore.shipments to anon;
grant UPDATE on table geg_singapore.shipments to anon;
grant DELETE on table geg_singapore.shipments to authenticated;
grant INSERT on table geg_singapore.shipments to authenticated;
grant MAINTAIN on table geg_singapore.shipments to authenticated;
grant REFERENCES on table geg_singapore.shipments to authenticated;
grant SELECT on table geg_singapore.shipments to authenticated;
grant TRIGGER on table geg_singapore.shipments to authenticated;
grant TRUNCATE on table geg_singapore.shipments to authenticated;
grant UPDATE on table geg_singapore.shipments to authenticated;
grant DELETE on table geg_singapore.shipments to service_role;
grant INSERT on table geg_singapore.shipments to service_role;
grant MAINTAIN on table geg_singapore.shipments to service_role;
grant REFERENCES on table geg_singapore.shipments to service_role;
grant SELECT on table geg_singapore.shipments to service_role;
grant TRIGGER on table geg_singapore.shipments to service_role;
grant TRUNCATE on table geg_singapore.shipments to service_role;
grant UPDATE on table geg_singapore.shipments to service_role;
grant DELETE on table geg_singapore.stock_levels to anon;
grant INSERT on table geg_singapore.stock_levels to anon;
grant MAINTAIN on table geg_singapore.stock_levels to anon;
grant REFERENCES on table geg_singapore.stock_levels to anon;
grant SELECT on table geg_singapore.stock_levels to anon;
grant TRIGGER on table geg_singapore.stock_levels to anon;
grant TRUNCATE on table geg_singapore.stock_levels to anon;
grant UPDATE on table geg_singapore.stock_levels to anon;
grant DELETE on table geg_singapore.stock_levels to authenticated;
grant INSERT on table geg_singapore.stock_levels to authenticated;
grant MAINTAIN on table geg_singapore.stock_levels to authenticated;
grant REFERENCES on table geg_singapore.stock_levels to authenticated;
grant SELECT on table geg_singapore.stock_levels to authenticated;
grant TRIGGER on table geg_singapore.stock_levels to authenticated;
grant TRUNCATE on table geg_singapore.stock_levels to authenticated;
grant UPDATE on table geg_singapore.stock_levels to authenticated;
grant DELETE on table geg_singapore.stock_levels to service_role;
grant INSERT on table geg_singapore.stock_levels to service_role;
grant MAINTAIN on table geg_singapore.stock_levels to service_role;
grant REFERENCES on table geg_singapore.stock_levels to service_role;
grant SELECT on table geg_singapore.stock_levels to service_role;
grant TRIGGER on table geg_singapore.stock_levels to service_role;
grant TRUNCATE on table geg_singapore.stock_levels to service_role;
grant UPDATE on table geg_singapore.stock_levels to service_role;
grant DELETE on table geg_singapore.stock_moves to anon;
grant INSERT on table geg_singapore.stock_moves to anon;
grant MAINTAIN on table geg_singapore.stock_moves to anon;
grant REFERENCES on table geg_singapore.stock_moves to anon;
grant SELECT on table geg_singapore.stock_moves to anon;
grant TRIGGER on table geg_singapore.stock_moves to anon;
grant TRUNCATE on table geg_singapore.stock_moves to anon;
grant UPDATE on table geg_singapore.stock_moves to anon;
grant DELETE on table geg_singapore.stock_moves to authenticated;
grant INSERT on table geg_singapore.stock_moves to authenticated;
grant MAINTAIN on table geg_singapore.stock_moves to authenticated;
grant REFERENCES on table geg_singapore.stock_moves to authenticated;
grant SELECT on table geg_singapore.stock_moves to authenticated;
grant TRIGGER on table geg_singapore.stock_moves to authenticated;
grant TRUNCATE on table geg_singapore.stock_moves to authenticated;
grant UPDATE on table geg_singapore.stock_moves to authenticated;
grant DELETE on table geg_singapore.stock_moves to service_role;
grant INSERT on table geg_singapore.stock_moves to service_role;
grant MAINTAIN on table geg_singapore.stock_moves to service_role;
grant REFERENCES on table geg_singapore.stock_moves to service_role;
grant SELECT on table geg_singapore.stock_moves to service_role;
grant TRIGGER on table geg_singapore.stock_moves to service_role;
grant TRUNCATE on table geg_singapore.stock_moves to service_role;
grant UPDATE on table geg_singapore.stock_moves to service_role;
grant DELETE on table geg_singapore.supplier_invoice_lines to anon;
grant INSERT on table geg_singapore.supplier_invoice_lines to anon;
grant MAINTAIN on table geg_singapore.supplier_invoice_lines to anon;
grant REFERENCES on table geg_singapore.supplier_invoice_lines to anon;
grant SELECT on table geg_singapore.supplier_invoice_lines to anon;
grant TRIGGER on table geg_singapore.supplier_invoice_lines to anon;
grant TRUNCATE on table geg_singapore.supplier_invoice_lines to anon;
grant UPDATE on table geg_singapore.supplier_invoice_lines to anon;
grant DELETE on table geg_singapore.supplier_invoice_lines to authenticated;
grant INSERT on table geg_singapore.supplier_invoice_lines to authenticated;
grant MAINTAIN on table geg_singapore.supplier_invoice_lines to authenticated;
grant REFERENCES on table geg_singapore.supplier_invoice_lines to authenticated;
grant SELECT on table geg_singapore.supplier_invoice_lines to authenticated;
grant TRIGGER on table geg_singapore.supplier_invoice_lines to authenticated;
grant TRUNCATE on table geg_singapore.supplier_invoice_lines to authenticated;
grant UPDATE on table geg_singapore.supplier_invoice_lines to authenticated;
grant DELETE on table geg_singapore.supplier_invoice_lines to service_role;
grant INSERT on table geg_singapore.supplier_invoice_lines to service_role;
grant MAINTAIN on table geg_singapore.supplier_invoice_lines to service_role;
grant REFERENCES on table geg_singapore.supplier_invoice_lines to service_role;
grant SELECT on table geg_singapore.supplier_invoice_lines to service_role;
grant TRIGGER on table geg_singapore.supplier_invoice_lines to service_role;
grant TRUNCATE on table geg_singapore.supplier_invoice_lines to service_role;
grant UPDATE on table geg_singapore.supplier_invoice_lines to service_role;
grant DELETE on table geg_singapore.supplier_invoices to anon;
grant INSERT on table geg_singapore.supplier_invoices to anon;
grant MAINTAIN on table geg_singapore.supplier_invoices to anon;
grant REFERENCES on table geg_singapore.supplier_invoices to anon;
grant SELECT on table geg_singapore.supplier_invoices to anon;
grant TRIGGER on table geg_singapore.supplier_invoices to anon;
grant TRUNCATE on table geg_singapore.supplier_invoices to anon;
grant UPDATE on table geg_singapore.supplier_invoices to anon;
grant DELETE on table geg_singapore.supplier_invoices to authenticated;
grant INSERT on table geg_singapore.supplier_invoices to authenticated;
grant MAINTAIN on table geg_singapore.supplier_invoices to authenticated;
grant REFERENCES on table geg_singapore.supplier_invoices to authenticated;
grant SELECT on table geg_singapore.supplier_invoices to authenticated;
grant TRIGGER on table geg_singapore.supplier_invoices to authenticated;
grant TRUNCATE on table geg_singapore.supplier_invoices to authenticated;
grant UPDATE on table geg_singapore.supplier_invoices to authenticated;
grant DELETE on table geg_singapore.supplier_invoices to service_role;
grant INSERT on table geg_singapore.supplier_invoices to service_role;
grant MAINTAIN on table geg_singapore.supplier_invoices to service_role;
grant REFERENCES on table geg_singapore.supplier_invoices to service_role;
grant SELECT on table geg_singapore.supplier_invoices to service_role;
grant TRIGGER on table geg_singapore.supplier_invoices to service_role;
grant TRUNCATE on table geg_singapore.supplier_invoices to service_role;
grant UPDATE on table geg_singapore.supplier_invoices to service_role;
grant DELETE on table geg_singapore.supplier_payments to anon;
grant INSERT on table geg_singapore.supplier_payments to anon;
grant MAINTAIN on table geg_singapore.supplier_payments to anon;
grant REFERENCES on table geg_singapore.supplier_payments to anon;
grant SELECT on table geg_singapore.supplier_payments to anon;
grant TRIGGER on table geg_singapore.supplier_payments to anon;
grant TRUNCATE on table geg_singapore.supplier_payments to anon;
grant UPDATE on table geg_singapore.supplier_payments to anon;
grant DELETE on table geg_singapore.supplier_payments to authenticated;
grant INSERT on table geg_singapore.supplier_payments to authenticated;
grant MAINTAIN on table geg_singapore.supplier_payments to authenticated;
grant REFERENCES on table geg_singapore.supplier_payments to authenticated;
grant SELECT on table geg_singapore.supplier_payments to authenticated;
grant TRIGGER on table geg_singapore.supplier_payments to authenticated;
grant TRUNCATE on table geg_singapore.supplier_payments to authenticated;
grant UPDATE on table geg_singapore.supplier_payments to authenticated;
grant DELETE on table geg_singapore.supplier_payments to service_role;
grant INSERT on table geg_singapore.supplier_payments to service_role;
grant MAINTAIN on table geg_singapore.supplier_payments to service_role;
grant REFERENCES on table geg_singapore.supplier_payments to service_role;
grant SELECT on table geg_singapore.supplier_payments to service_role;
grant TRIGGER on table geg_singapore.supplier_payments to service_role;
grant TRUNCATE on table geg_singapore.supplier_payments to service_role;
grant UPDATE on table geg_singapore.supplier_payments to service_role;
grant DELETE on table geg_singapore.suppliers to anon;
grant INSERT on table geg_singapore.suppliers to anon;
grant MAINTAIN on table geg_singapore.suppliers to anon;
grant REFERENCES on table geg_singapore.suppliers to anon;
grant SELECT on table geg_singapore.suppliers to anon;
grant TRIGGER on table geg_singapore.suppliers to anon;
grant TRUNCATE on table geg_singapore.suppliers to anon;
grant UPDATE on table geg_singapore.suppliers to anon;
grant DELETE on table geg_singapore.suppliers to authenticated;
grant INSERT on table geg_singapore.suppliers to authenticated;
grant MAINTAIN on table geg_singapore.suppliers to authenticated;
grant REFERENCES on table geg_singapore.suppliers to authenticated;
grant SELECT on table geg_singapore.suppliers to authenticated;
grant TRIGGER on table geg_singapore.suppliers to authenticated;
grant TRUNCATE on table geg_singapore.suppliers to authenticated;
grant UPDATE on table geg_singapore.suppliers to authenticated;
grant DELETE on table geg_singapore.suppliers to service_role;
grant INSERT on table geg_singapore.suppliers to service_role;
grant MAINTAIN on table geg_singapore.suppliers to service_role;
grant REFERENCES on table geg_singapore.suppliers to service_role;
grant SELECT on table geg_singapore.suppliers to service_role;
grant TRIGGER on table geg_singapore.suppliers to service_role;
grant TRUNCATE on table geg_singapore.suppliers to service_role;
grant UPDATE on table geg_singapore.suppliers to service_role;
grant DELETE on table geg_singapore.treasury_accounts to anon;
grant INSERT on table geg_singapore.treasury_accounts to anon;
grant MAINTAIN on table geg_singapore.treasury_accounts to anon;
grant REFERENCES on table geg_singapore.treasury_accounts to anon;
grant SELECT on table geg_singapore.treasury_accounts to anon;
grant TRIGGER on table geg_singapore.treasury_accounts to anon;
grant TRUNCATE on table geg_singapore.treasury_accounts to anon;
grant UPDATE on table geg_singapore.treasury_accounts to anon;
grant DELETE on table geg_singapore.treasury_accounts to authenticated;
grant INSERT on table geg_singapore.treasury_accounts to authenticated;
grant MAINTAIN on table geg_singapore.treasury_accounts to authenticated;
grant REFERENCES on table geg_singapore.treasury_accounts to authenticated;
grant SELECT on table geg_singapore.treasury_accounts to authenticated;
grant TRIGGER on table geg_singapore.treasury_accounts to authenticated;
grant TRUNCATE on table geg_singapore.treasury_accounts to authenticated;
grant UPDATE on table geg_singapore.treasury_accounts to authenticated;
grant DELETE on table geg_singapore.treasury_accounts to service_role;
grant INSERT on table geg_singapore.treasury_accounts to service_role;
grant MAINTAIN on table geg_singapore.treasury_accounts to service_role;
grant REFERENCES on table geg_singapore.treasury_accounts to service_role;
grant SELECT on table geg_singapore.treasury_accounts to service_role;
grant TRIGGER on table geg_singapore.treasury_accounts to service_role;
grant TRUNCATE on table geg_singapore.treasury_accounts to service_role;
grant UPDATE on table geg_singapore.treasury_accounts to service_role;
grant DELETE on table geg_singapore.treasury_transactions to anon;
grant INSERT on table geg_singapore.treasury_transactions to anon;
grant MAINTAIN on table geg_singapore.treasury_transactions to anon;
grant REFERENCES on table geg_singapore.treasury_transactions to anon;
grant SELECT on table geg_singapore.treasury_transactions to anon;
grant TRIGGER on table geg_singapore.treasury_transactions to anon;
grant TRUNCATE on table geg_singapore.treasury_transactions to anon;
grant UPDATE on table geg_singapore.treasury_transactions to anon;
grant DELETE on table geg_singapore.treasury_transactions to authenticated;
grant INSERT on table geg_singapore.treasury_transactions to authenticated;
grant MAINTAIN on table geg_singapore.treasury_transactions to authenticated;
grant REFERENCES on table geg_singapore.treasury_transactions to authenticated;
grant SELECT on table geg_singapore.treasury_transactions to authenticated;
grant TRIGGER on table geg_singapore.treasury_transactions to authenticated;
grant TRUNCATE on table geg_singapore.treasury_transactions to authenticated;
grant UPDATE on table geg_singapore.treasury_transactions to authenticated;
grant DELETE on table geg_singapore.treasury_transactions to service_role;
grant INSERT on table geg_singapore.treasury_transactions to service_role;
grant MAINTAIN on table geg_singapore.treasury_transactions to service_role;
grant REFERENCES on table geg_singapore.treasury_transactions to service_role;
grant SELECT on table geg_singapore.treasury_transactions to service_role;
grant TRIGGER on table geg_singapore.treasury_transactions to service_role;
grant TRUNCATE on table geg_singapore.treasury_transactions to service_role;
grant UPDATE on table geg_singapore.treasury_transactions to service_role;
grant DELETE on table geg_singapore.units to anon;
grant INSERT on table geg_singapore.units to anon;
grant MAINTAIN on table geg_singapore.units to anon;
grant REFERENCES on table geg_singapore.units to anon;
grant SELECT on table geg_singapore.units to anon;
grant TRIGGER on table geg_singapore.units to anon;
grant TRUNCATE on table geg_singapore.units to anon;
grant UPDATE on table geg_singapore.units to anon;
grant DELETE on table geg_singapore.units to authenticated;
grant INSERT on table geg_singapore.units to authenticated;
grant MAINTAIN on table geg_singapore.units to authenticated;
grant REFERENCES on table geg_singapore.units to authenticated;
grant SELECT on table geg_singapore.units to authenticated;
grant TRIGGER on table geg_singapore.units to authenticated;
grant TRUNCATE on table geg_singapore.units to authenticated;
grant UPDATE on table geg_singapore.units to authenticated;
grant DELETE on table geg_singapore.units to service_role;
grant INSERT on table geg_singapore.units to service_role;
grant MAINTAIN on table geg_singapore.units to service_role;
grant REFERENCES on table geg_singapore.units to service_role;
grant SELECT on table geg_singapore.units to service_role;
grant TRIGGER on table geg_singapore.units to service_role;
grant TRUNCATE on table geg_singapore.units to service_role;
grant UPDATE on table geg_singapore.units to service_role;
grant DELETE on table geg_singapore.warehouses to anon;
grant INSERT on table geg_singapore.warehouses to anon;
grant MAINTAIN on table geg_singapore.warehouses to anon;
grant REFERENCES on table geg_singapore.warehouses to anon;
grant SELECT on table geg_singapore.warehouses to anon;
grant TRIGGER on table geg_singapore.warehouses to anon;
grant TRUNCATE on table geg_singapore.warehouses to anon;
grant UPDATE on table geg_singapore.warehouses to anon;
grant DELETE on table geg_singapore.warehouses to authenticated;
grant INSERT on table geg_singapore.warehouses to authenticated;
grant MAINTAIN on table geg_singapore.warehouses to authenticated;
grant REFERENCES on table geg_singapore.warehouses to authenticated;
grant SELECT on table geg_singapore.warehouses to authenticated;
grant TRIGGER on table geg_singapore.warehouses to authenticated;
grant TRUNCATE on table geg_singapore.warehouses to authenticated;
grant UPDATE on table geg_singapore.warehouses to authenticated;
grant DELETE on table geg_singapore.warehouses to service_role;
grant INSERT on table geg_singapore.warehouses to service_role;
grant MAINTAIN on table geg_singapore.warehouses to service_role;
grant REFERENCES on table geg_singapore.warehouses to service_role;
grant SELECT on table geg_singapore.warehouses to service_role;
grant TRIGGER on table geg_singapore.warehouses to service_role;
grant TRUNCATE on table geg_singapore.warehouses to service_role;
grant UPDATE on table geg_singapore.warehouses to service_role;
grant DELETE on table public.accounts to anon;
grant INSERT on table public.accounts to anon;
grant MAINTAIN on table public.accounts to anon;
grant REFERENCES on table public.accounts to anon;
grant SELECT on table public.accounts to anon;
grant TRIGGER on table public.accounts to anon;
grant TRUNCATE on table public.accounts to anon;
grant UPDATE on table public.accounts to anon;
grant DELETE on table public.accounts to authenticated;
grant INSERT on table public.accounts to authenticated;
grant MAINTAIN on table public.accounts to authenticated;
grant REFERENCES on table public.accounts to authenticated;
grant SELECT on table public.accounts to authenticated;
grant TRIGGER on table public.accounts to authenticated;
grant TRUNCATE on table public.accounts to authenticated;
grant UPDATE on table public.accounts to authenticated;
grant DELETE on table public.accounts to service_role;
grant INSERT on table public.accounts to service_role;
grant MAINTAIN on table public.accounts to service_role;
grant REFERENCES on table public.accounts to service_role;
grant SELECT on table public.accounts to service_role;
grant TRIGGER on table public.accounts to service_role;
grant TRUNCATE on table public.accounts to service_role;
grant UPDATE on table public.accounts to service_role;
grant DELETE on table public.activities to anon;
grant INSERT on table public.activities to anon;
grant MAINTAIN on table public.activities to anon;
grant REFERENCES on table public.activities to anon;
grant SELECT on table public.activities to anon;
grant TRIGGER on table public.activities to anon;
grant TRUNCATE on table public.activities to anon;
grant UPDATE on table public.activities to anon;
grant DELETE on table public.activities to authenticated;
grant INSERT on table public.activities to authenticated;
grant MAINTAIN on table public.activities to authenticated;
grant REFERENCES on table public.activities to authenticated;
grant SELECT on table public.activities to authenticated;
grant TRIGGER on table public.activities to authenticated;
grant TRUNCATE on table public.activities to authenticated;
grant UPDATE on table public.activities to authenticated;
grant DELETE on table public.activities to service_role;
grant INSERT on table public.activities to service_role;
grant MAINTAIN on table public.activities to service_role;
grant REFERENCES on table public.activities to service_role;
grant SELECT on table public.activities to service_role;
grant TRIGGER on table public.activities to service_role;
grant TRUNCATE on table public.activities to service_role;
grant UPDATE on table public.activities to service_role;
grant DELETE on table public.commissions to anon;
grant INSERT on table public.commissions to anon;
grant MAINTAIN on table public.commissions to anon;
grant REFERENCES on table public.commissions to anon;
grant SELECT on table public.commissions to anon;
grant TRIGGER on table public.commissions to anon;
grant TRUNCATE on table public.commissions to anon;
grant UPDATE on table public.commissions to anon;
grant DELETE on table public.commissions to authenticated;
grant INSERT on table public.commissions to authenticated;
grant MAINTAIN on table public.commissions to authenticated;
grant REFERENCES on table public.commissions to authenticated;
grant SELECT on table public.commissions to authenticated;
grant TRIGGER on table public.commissions to authenticated;
grant TRUNCATE on table public.commissions to authenticated;
grant UPDATE on table public.commissions to authenticated;
grant DELETE on table public.commissions to service_role;
grant INSERT on table public.commissions to service_role;
grant MAINTAIN on table public.commissions to service_role;
grant REFERENCES on table public.commissions to service_role;
grant SELECT on table public.commissions to service_role;
grant TRIGGER on table public.commissions to service_role;
grant TRUNCATE on table public.commissions to service_role;
grant UPDATE on table public.commissions to service_role;
grant DELETE on table public.companies to anon;
grant INSERT on table public.companies to anon;
grant MAINTAIN on table public.companies to anon;
grant REFERENCES on table public.companies to anon;
grant SELECT on table public.companies to anon;
grant TRIGGER on table public.companies to anon;
grant TRUNCATE on table public.companies to anon;
grant UPDATE on table public.companies to anon;
grant DELETE on table public.companies to authenticated;
grant INSERT on table public.companies to authenticated;
grant MAINTAIN on table public.companies to authenticated;
grant REFERENCES on table public.companies to authenticated;
grant SELECT on table public.companies to authenticated;
grant TRIGGER on table public.companies to authenticated;
grant TRUNCATE on table public.companies to authenticated;
grant UPDATE on table public.companies to authenticated;
grant DELETE on table public.companies to service_role;
grant INSERT on table public.companies to service_role;
grant MAINTAIN on table public.companies to service_role;
grant REFERENCES on table public.companies to service_role;
grant SELECT on table public.companies to service_role;
grant TRIGGER on table public.companies to service_role;
grant TRUNCATE on table public.companies to service_role;
grant UPDATE on table public.companies to service_role;
grant DELETE on table public.contacts to anon;
grant INSERT on table public.contacts to anon;
grant MAINTAIN on table public.contacts to anon;
grant REFERENCES on table public.contacts to anon;
grant SELECT on table public.contacts to anon;
grant TRIGGER on table public.contacts to anon;
grant TRUNCATE on table public.contacts to anon;
grant UPDATE on table public.contacts to anon;
grant DELETE on table public.contacts to authenticated;
grant INSERT on table public.contacts to authenticated;
grant MAINTAIN on table public.contacts to authenticated;
grant REFERENCES on table public.contacts to authenticated;
grant SELECT on table public.contacts to authenticated;
grant TRIGGER on table public.contacts to authenticated;
grant TRUNCATE on table public.contacts to authenticated;
grant UPDATE on table public.contacts to authenticated;
grant DELETE on table public.contacts to service_role;
grant INSERT on table public.contacts to service_role;
grant MAINTAIN on table public.contacts to service_role;
grant REFERENCES on table public.contacts to service_role;
grant SELECT on table public.contacts to service_role;
grant TRIGGER on table public.contacts to service_role;
grant TRUNCATE on table public.contacts to service_role;
grant UPDATE on table public.contacts to service_role;
grant DELETE on table public.deals to anon;
grant INSERT on table public.deals to anon;
grant MAINTAIN on table public.deals to anon;
grant REFERENCES on table public.deals to anon;
grant SELECT on table public.deals to anon;
grant TRIGGER on table public.deals to anon;
grant TRUNCATE on table public.deals to anon;
grant UPDATE on table public.deals to anon;
grant DELETE on table public.deals to authenticated;
grant INSERT on table public.deals to authenticated;
grant MAINTAIN on table public.deals to authenticated;
grant REFERENCES on table public.deals to authenticated;
grant SELECT on table public.deals to authenticated;
grant TRIGGER on table public.deals to authenticated;
grant TRUNCATE on table public.deals to authenticated;
grant UPDATE on table public.deals to authenticated;
grant DELETE on table public.deals to service_role;
grant INSERT on table public.deals to service_role;
grant MAINTAIN on table public.deals to service_role;
grant REFERENCES on table public.deals to service_role;
grant SELECT on table public.deals to service_role;
grant TRIGGER on table public.deals to service_role;
grant TRUNCATE on table public.deals to service_role;
grant UPDATE on table public.deals to service_role;
grant DELETE on table public.document_categories to anon;
grant INSERT on table public.document_categories to anon;
grant MAINTAIN on table public.document_categories to anon;
grant REFERENCES on table public.document_categories to anon;
grant SELECT on table public.document_categories to anon;
grant TRIGGER on table public.document_categories to anon;
grant TRUNCATE on table public.document_categories to anon;
grant UPDATE on table public.document_categories to anon;
grant DELETE on table public.document_categories to authenticated;
grant INSERT on table public.document_categories to authenticated;
grant MAINTAIN on table public.document_categories to authenticated;
grant REFERENCES on table public.document_categories to authenticated;
grant SELECT on table public.document_categories to authenticated;
grant TRIGGER on table public.document_categories to authenticated;
grant TRUNCATE on table public.document_categories to authenticated;
grant UPDATE on table public.document_categories to authenticated;
grant DELETE on table public.document_categories to service_role;
grant INSERT on table public.document_categories to service_role;
grant MAINTAIN on table public.document_categories to service_role;
grant REFERENCES on table public.document_categories to service_role;
grant SELECT on table public.document_categories to service_role;
grant TRIGGER on table public.document_categories to service_role;
grant TRUNCATE on table public.document_categories to service_role;
grant UPDATE on table public.document_categories to service_role;
grant DELETE on table public.document_settings to anon;
grant INSERT on table public.document_settings to anon;
grant MAINTAIN on table public.document_settings to anon;
grant REFERENCES on table public.document_settings to anon;
grant SELECT on table public.document_settings to anon;
grant TRIGGER on table public.document_settings to anon;
grant TRUNCATE on table public.document_settings to anon;
grant UPDATE on table public.document_settings to anon;
grant DELETE on table public.document_settings to authenticated;
grant INSERT on table public.document_settings to authenticated;
grant MAINTAIN on table public.document_settings to authenticated;
grant REFERENCES on table public.document_settings to authenticated;
grant SELECT on table public.document_settings to authenticated;
grant TRIGGER on table public.document_settings to authenticated;
grant TRUNCATE on table public.document_settings to authenticated;
grant UPDATE on table public.document_settings to authenticated;
grant DELETE on table public.document_settings to service_role;
grant INSERT on table public.document_settings to service_role;
grant MAINTAIN on table public.document_settings to service_role;
grant REFERENCES on table public.document_settings to service_role;
grant SELECT on table public.document_settings to service_role;
grant TRIGGER on table public.document_settings to service_role;
grant TRUNCATE on table public.document_settings to service_role;
grant UPDATE on table public.document_settings to service_role;
grant DELETE on table public.document_tokens to anon;
grant INSERT on table public.document_tokens to anon;
grant MAINTAIN on table public.document_tokens to anon;
grant REFERENCES on table public.document_tokens to anon;
grant SELECT on table public.document_tokens to anon;
grant TRIGGER on table public.document_tokens to anon;
grant TRUNCATE on table public.document_tokens to anon;
grant UPDATE on table public.document_tokens to anon;
grant DELETE on table public.document_tokens to authenticated;
grant INSERT on table public.document_tokens to authenticated;
grant MAINTAIN on table public.document_tokens to authenticated;
grant REFERENCES on table public.document_tokens to authenticated;
grant SELECT on table public.document_tokens to authenticated;
grant TRIGGER on table public.document_tokens to authenticated;
grant TRUNCATE on table public.document_tokens to authenticated;
grant UPDATE on table public.document_tokens to authenticated;
grant DELETE on table public.document_tokens to service_role;
grant INSERT on table public.document_tokens to service_role;
grant MAINTAIN on table public.document_tokens to service_role;
grant REFERENCES on table public.document_tokens to service_role;
grant SELECT on table public.document_tokens to service_role;
grant TRIGGER on table public.document_tokens to service_role;
grant TRUNCATE on table public.document_tokens to service_role;
grant UPDATE on table public.document_tokens to service_role;
grant DELETE on table public.documents to anon;
grant INSERT on table public.documents to anon;
grant MAINTAIN on table public.documents to anon;
grant REFERENCES on table public.documents to anon;
grant SELECT on table public.documents to anon;
grant TRIGGER on table public.documents to anon;
grant TRUNCATE on table public.documents to anon;
grant UPDATE on table public.documents to anon;
grant DELETE on table public.documents to authenticated;
grant INSERT on table public.documents to authenticated;
grant MAINTAIN on table public.documents to authenticated;
grant REFERENCES on table public.documents to authenticated;
grant SELECT on table public.documents to authenticated;
grant TRIGGER on table public.documents to authenticated;
grant TRUNCATE on table public.documents to authenticated;
grant UPDATE on table public.documents to authenticated;
grant DELETE on table public.documents to service_role;
grant INSERT on table public.documents to service_role;
grant MAINTAIN on table public.documents to service_role;
grant REFERENCES on table public.documents to service_role;
grant SELECT on table public.documents to service_role;
grant TRIGGER on table public.documents to service_role;
grant TRUNCATE on table public.documents to service_role;
grant UPDATE on table public.documents to service_role;
grant DELETE on table public.employees to anon;
grant INSERT on table public.employees to anon;
grant MAINTAIN on table public.employees to anon;
grant REFERENCES on table public.employees to anon;
grant SELECT on table public.employees to anon;
grant TRIGGER on table public.employees to anon;
grant TRUNCATE on table public.employees to anon;
grant UPDATE on table public.employees to anon;
grant DELETE on table public.employees to authenticated;
grant INSERT on table public.employees to authenticated;
grant MAINTAIN on table public.employees to authenticated;
grant REFERENCES on table public.employees to authenticated;
grant SELECT on table public.employees to authenticated;
grant TRIGGER on table public.employees to authenticated;
grant TRUNCATE on table public.employees to authenticated;
grant UPDATE on table public.employees to authenticated;
grant DELETE on table public.employees to service_role;
grant INSERT on table public.employees to service_role;
grant MAINTAIN on table public.employees to service_role;
grant REFERENCES on table public.employees to service_role;
grant SELECT on table public.employees to service_role;
grant TRIGGER on table public.employees to service_role;
grant TRUNCATE on table public.employees to service_role;
grant UPDATE on table public.employees to service_role;
grant DELETE on table public.exchange_rates to anon;
grant INSERT on table public.exchange_rates to anon;
grant MAINTAIN on table public.exchange_rates to anon;
grant REFERENCES on table public.exchange_rates to anon;
grant SELECT on table public.exchange_rates to anon;
grant TRIGGER on table public.exchange_rates to anon;
grant TRUNCATE on table public.exchange_rates to anon;
grant UPDATE on table public.exchange_rates to anon;
grant DELETE on table public.exchange_rates to authenticated;
grant INSERT on table public.exchange_rates to authenticated;
grant MAINTAIN on table public.exchange_rates to authenticated;
grant REFERENCES on table public.exchange_rates to authenticated;
grant SELECT on table public.exchange_rates to authenticated;
grant TRIGGER on table public.exchange_rates to authenticated;
grant TRUNCATE on table public.exchange_rates to authenticated;
grant UPDATE on table public.exchange_rates to authenticated;
grant DELETE on table public.exchange_rates to service_role;
grant INSERT on table public.exchange_rates to service_role;
grant MAINTAIN on table public.exchange_rates to service_role;
grant REFERENCES on table public.exchange_rates to service_role;
grant SELECT on table public.exchange_rates to service_role;
grant TRIGGER on table public.exchange_rates to service_role;
grant TRUNCATE on table public.exchange_rates to service_role;
grant UPDATE on table public.exchange_rates to service_role;
grant DELETE on table public.invoice_lines to anon;
grant INSERT on table public.invoice_lines to anon;
grant MAINTAIN on table public.invoice_lines to anon;
grant REFERENCES on table public.invoice_lines to anon;
grant SELECT on table public.invoice_lines to anon;
grant TRIGGER on table public.invoice_lines to anon;
grant TRUNCATE on table public.invoice_lines to anon;
grant UPDATE on table public.invoice_lines to anon;
grant DELETE on table public.invoice_lines to authenticated;
grant INSERT on table public.invoice_lines to authenticated;
grant MAINTAIN on table public.invoice_lines to authenticated;
grant REFERENCES on table public.invoice_lines to authenticated;
grant SELECT on table public.invoice_lines to authenticated;
grant TRIGGER on table public.invoice_lines to authenticated;
grant TRUNCATE on table public.invoice_lines to authenticated;
grant UPDATE on table public.invoice_lines to authenticated;
grant DELETE on table public.invoice_lines to service_role;
grant INSERT on table public.invoice_lines to service_role;
grant MAINTAIN on table public.invoice_lines to service_role;
grant REFERENCES on table public.invoice_lines to service_role;
grant SELECT on table public.invoice_lines to service_role;
grant TRIGGER on table public.invoice_lines to service_role;
grant TRUNCATE on table public.invoice_lines to service_role;
grant UPDATE on table public.invoice_lines to service_role;
grant SELECT on sequence public.invoice_seq to anon;
grant UPDATE on sequence public.invoice_seq to anon;
grant USAGE on sequence public.invoice_seq to anon;
grant SELECT on sequence public.invoice_seq to authenticated;
grant UPDATE on sequence public.invoice_seq to authenticated;
grant USAGE on sequence public.invoice_seq to authenticated;
grant SELECT on sequence public.invoice_seq to service_role;
grant UPDATE on sequence public.invoice_seq to service_role;
grant USAGE on sequence public.invoice_seq to service_role;
grant DELETE on table public.invoice_totals to anon;
grant INSERT on table public.invoice_totals to anon;
grant MAINTAIN on table public.invoice_totals to anon;
grant REFERENCES on table public.invoice_totals to anon;
grant SELECT on table public.invoice_totals to anon;
grant TRIGGER on table public.invoice_totals to anon;
grant TRUNCATE on table public.invoice_totals to anon;
grant UPDATE on table public.invoice_totals to anon;
grant DELETE on table public.invoice_totals to authenticated;
grant INSERT on table public.invoice_totals to authenticated;
grant MAINTAIN on table public.invoice_totals to authenticated;
grant REFERENCES on table public.invoice_totals to authenticated;
grant SELECT on table public.invoice_totals to authenticated;
grant TRIGGER on table public.invoice_totals to authenticated;
grant TRUNCATE on table public.invoice_totals to authenticated;
grant UPDATE on table public.invoice_totals to authenticated;
grant DELETE on table public.invoice_totals to service_role;
grant INSERT on table public.invoice_totals to service_role;
grant MAINTAIN on table public.invoice_totals to service_role;
grant REFERENCES on table public.invoice_totals to service_role;
grant SELECT on table public.invoice_totals to service_role;
grant TRIGGER on table public.invoice_totals to service_role;
grant TRUNCATE on table public.invoice_totals to service_role;
grant UPDATE on table public.invoice_totals to service_role;
grant DELETE on table public.invoices to anon;
grant INSERT on table public.invoices to anon;
grant MAINTAIN on table public.invoices to anon;
grant REFERENCES on table public.invoices to anon;
grant SELECT on table public.invoices to anon;
grant TRIGGER on table public.invoices to anon;
grant TRUNCATE on table public.invoices to anon;
grant UPDATE on table public.invoices to anon;
grant DELETE on table public.invoices to authenticated;
grant INSERT on table public.invoices to authenticated;
grant MAINTAIN on table public.invoices to authenticated;
grant REFERENCES on table public.invoices to authenticated;
grant SELECT on table public.invoices to authenticated;
grant TRIGGER on table public.invoices to authenticated;
grant TRUNCATE on table public.invoices to authenticated;
grant UPDATE on table public.invoices to authenticated;
grant DELETE on table public.invoices to service_role;
grant INSERT on table public.invoices to service_role;
grant MAINTAIN on table public.invoices to service_role;
grant REFERENCES on table public.invoices to service_role;
grant SELECT on table public.invoices to service_role;
grant TRIGGER on table public.invoices to service_role;
grant TRUNCATE on table public.invoices to service_role;
grant UPDATE on table public.invoices to service_role;
grant DELETE on table public.notifications to anon;
grant INSERT on table public.notifications to anon;
grant MAINTAIN on table public.notifications to anon;
grant REFERENCES on table public.notifications to anon;
grant SELECT on table public.notifications to anon;
grant TRIGGER on table public.notifications to anon;
grant TRUNCATE on table public.notifications to anon;
grant UPDATE on table public.notifications to anon;
grant DELETE on table public.notifications to authenticated;
grant INSERT on table public.notifications to authenticated;
grant MAINTAIN on table public.notifications to authenticated;
grant REFERENCES on table public.notifications to authenticated;
grant SELECT on table public.notifications to authenticated;
grant TRIGGER on table public.notifications to authenticated;
grant TRUNCATE on table public.notifications to authenticated;
grant UPDATE on table public.notifications to authenticated;
grant DELETE on table public.notifications to service_role;
grant INSERT on table public.notifications to service_role;
grant MAINTAIN on table public.notifications to service_role;
grant REFERENCES on table public.notifications to service_role;
grant SELECT on table public.notifications to service_role;
grant TRIGGER on table public.notifications to service_role;
grant TRUNCATE on table public.notifications to service_role;
grant UPDATE on table public.notifications to service_role;
grant DELETE on table public.payments to anon;
grant INSERT on table public.payments to anon;
grant MAINTAIN on table public.payments to anon;
grant REFERENCES on table public.payments to anon;
grant SELECT on table public.payments to anon;
grant TRIGGER on table public.payments to anon;
grant TRUNCATE on table public.payments to anon;
grant UPDATE on table public.payments to anon;
grant DELETE on table public.payments to authenticated;
grant INSERT on table public.payments to authenticated;
grant MAINTAIN on table public.payments to authenticated;
grant REFERENCES on table public.payments to authenticated;
grant SELECT on table public.payments to authenticated;
grant TRIGGER on table public.payments to authenticated;
grant TRUNCATE on table public.payments to authenticated;
grant UPDATE on table public.payments to authenticated;
grant DELETE on table public.payments to service_role;
grant INSERT on table public.payments to service_role;
grant MAINTAIN on table public.payments to service_role;
grant REFERENCES on table public.payments to service_role;
grant SELECT on table public.payments to service_role;
grant TRIGGER on table public.payments to service_role;
grant TRUNCATE on table public.payments to service_role;
grant UPDATE on table public.payments to service_role;
grant DELETE on table public.product_categories to anon;
grant INSERT on table public.product_categories to anon;
grant MAINTAIN on table public.product_categories to anon;
grant REFERENCES on table public.product_categories to anon;
grant SELECT on table public.product_categories to anon;
grant TRIGGER on table public.product_categories to anon;
grant TRUNCATE on table public.product_categories to anon;
grant UPDATE on table public.product_categories to anon;
grant DELETE on table public.product_categories to authenticated;
grant INSERT on table public.product_categories to authenticated;
grant MAINTAIN on table public.product_categories to authenticated;
grant REFERENCES on table public.product_categories to authenticated;
grant SELECT on table public.product_categories to authenticated;
grant TRIGGER on table public.product_categories to authenticated;
grant TRUNCATE on table public.product_categories to authenticated;
grant UPDATE on table public.product_categories to authenticated;
grant DELETE on table public.product_categories to service_role;
grant INSERT on table public.product_categories to service_role;
grant MAINTAIN on table public.product_categories to service_role;
grant REFERENCES on table public.product_categories to service_role;
grant SELECT on table public.product_categories to service_role;
grant TRIGGER on table public.product_categories to service_role;
grant TRUNCATE on table public.product_categories to service_role;
grant UPDATE on table public.product_categories to service_role;
grant DELETE on table public.products to anon;
grant INSERT on table public.products to anon;
grant MAINTAIN on table public.products to anon;
grant REFERENCES on table public.products to anon;
grant SELECT on table public.products to anon;
grant TRIGGER on table public.products to anon;
grant TRUNCATE on table public.products to anon;
grant UPDATE on table public.products to anon;
grant DELETE on table public.products to authenticated;
grant INSERT on table public.products to authenticated;
grant MAINTAIN on table public.products to authenticated;
grant REFERENCES on table public.products to authenticated;
grant SELECT on table public.products to authenticated;
grant TRIGGER on table public.products to authenticated;
grant TRUNCATE on table public.products to authenticated;
grant UPDATE on table public.products to authenticated;
grant DELETE on table public.products to service_role;
grant INSERT on table public.products to service_role;
grant MAINTAIN on table public.products to service_role;
grant REFERENCES on table public.products to service_role;
grant SELECT on table public.products to service_role;
grant TRIGGER on table public.products to service_role;
grant TRUNCATE on table public.products to service_role;
grant UPDATE on table public.products to service_role;
grant DELETE on table public.profiles to anon;
grant INSERT on table public.profiles to anon;
grant MAINTAIN on table public.profiles to anon;
grant REFERENCES on table public.profiles to anon;
grant SELECT on table public.profiles to anon;
grant TRIGGER on table public.profiles to anon;
grant TRUNCATE on table public.profiles to anon;
grant UPDATE on table public.profiles to anon;
grant DELETE on table public.profiles to authenticated;
grant INSERT on table public.profiles to authenticated;
grant MAINTAIN on table public.profiles to authenticated;
grant REFERENCES on table public.profiles to authenticated;
grant SELECT on table public.profiles to authenticated;
grant TRIGGER on table public.profiles to authenticated;
grant TRUNCATE on table public.profiles to authenticated;
grant UPDATE on table public.profiles to authenticated;
grant DELETE on table public.profiles to service_role;
grant INSERT on table public.profiles to service_role;
grant MAINTAIN on table public.profiles to service_role;
grant REFERENCES on table public.profiles to service_role;
grant SELECT on table public.profiles to service_role;
grant TRIGGER on table public.profiles to service_role;
grant TRUNCATE on table public.profiles to service_role;
grant UPDATE on table public.profiles to service_role;
grant DELETE on table public.purchase_costs to anon;
grant INSERT on table public.purchase_costs to anon;
grant MAINTAIN on table public.purchase_costs to anon;
grant REFERENCES on table public.purchase_costs to anon;
grant SELECT on table public.purchase_costs to anon;
grant TRIGGER on table public.purchase_costs to anon;
grant TRUNCATE on table public.purchase_costs to anon;
grant UPDATE on table public.purchase_costs to anon;
grant DELETE on table public.purchase_costs to authenticated;
grant INSERT on table public.purchase_costs to authenticated;
grant MAINTAIN on table public.purchase_costs to authenticated;
grant REFERENCES on table public.purchase_costs to authenticated;
grant SELECT on table public.purchase_costs to authenticated;
grant TRIGGER on table public.purchase_costs to authenticated;
grant TRUNCATE on table public.purchase_costs to authenticated;
grant UPDATE on table public.purchase_costs to authenticated;
grant DELETE on table public.purchase_costs to service_role;
grant INSERT on table public.purchase_costs to service_role;
grant MAINTAIN on table public.purchase_costs to service_role;
grant REFERENCES on table public.purchase_costs to service_role;
grant SELECT on table public.purchase_costs to service_role;
grant TRIGGER on table public.purchase_costs to service_role;
grant TRUNCATE on table public.purchase_costs to service_role;
grant UPDATE on table public.purchase_costs to service_role;
grant DELETE on table public.purchase_landed_costs to anon;
grant INSERT on table public.purchase_landed_costs to anon;
grant MAINTAIN on table public.purchase_landed_costs to anon;
grant REFERENCES on table public.purchase_landed_costs to anon;
grant SELECT on table public.purchase_landed_costs to anon;
grant TRIGGER on table public.purchase_landed_costs to anon;
grant TRUNCATE on table public.purchase_landed_costs to anon;
grant UPDATE on table public.purchase_landed_costs to anon;
grant DELETE on table public.purchase_landed_costs to authenticated;
grant INSERT on table public.purchase_landed_costs to authenticated;
grant MAINTAIN on table public.purchase_landed_costs to authenticated;
grant REFERENCES on table public.purchase_landed_costs to authenticated;
grant SELECT on table public.purchase_landed_costs to authenticated;
grant TRIGGER on table public.purchase_landed_costs to authenticated;
grant TRUNCATE on table public.purchase_landed_costs to authenticated;
grant UPDATE on table public.purchase_landed_costs to authenticated;
grant DELETE on table public.purchase_landed_costs to service_role;
grant INSERT on table public.purchase_landed_costs to service_role;
grant MAINTAIN on table public.purchase_landed_costs to service_role;
grant REFERENCES on table public.purchase_landed_costs to service_role;
grant SELECT on table public.purchase_landed_costs to service_role;
grant TRIGGER on table public.purchase_landed_costs to service_role;
grant TRUNCATE on table public.purchase_landed_costs to service_role;
grant UPDATE on table public.purchase_landed_costs to service_role;
grant DELETE on table public.purchase_order_lines to anon;
grant INSERT on table public.purchase_order_lines to anon;
grant MAINTAIN on table public.purchase_order_lines to anon;
grant REFERENCES on table public.purchase_order_lines to anon;
grant SELECT on table public.purchase_order_lines to anon;
grant TRIGGER on table public.purchase_order_lines to anon;
grant TRUNCATE on table public.purchase_order_lines to anon;
grant UPDATE on table public.purchase_order_lines to anon;
grant DELETE on table public.purchase_order_lines to authenticated;
grant INSERT on table public.purchase_order_lines to authenticated;
grant MAINTAIN on table public.purchase_order_lines to authenticated;
grant REFERENCES on table public.purchase_order_lines to authenticated;
grant SELECT on table public.purchase_order_lines to authenticated;
grant TRIGGER on table public.purchase_order_lines to authenticated;
grant TRUNCATE on table public.purchase_order_lines to authenticated;
grant UPDATE on table public.purchase_order_lines to authenticated;
grant DELETE on table public.purchase_order_lines to service_role;
grant INSERT on table public.purchase_order_lines to service_role;
grant MAINTAIN on table public.purchase_order_lines to service_role;
grant REFERENCES on table public.purchase_order_lines to service_role;
grant SELECT on table public.purchase_order_lines to service_role;
grant TRIGGER on table public.purchase_order_lines to service_role;
grant TRUNCATE on table public.purchase_order_lines to service_role;
grant UPDATE on table public.purchase_order_lines to service_role;
grant SELECT on sequence public.purchase_order_seq to anon;
grant UPDATE on sequence public.purchase_order_seq to anon;
grant USAGE on sequence public.purchase_order_seq to anon;
grant SELECT on sequence public.purchase_order_seq to authenticated;
grant UPDATE on sequence public.purchase_order_seq to authenticated;
grant USAGE on sequence public.purchase_order_seq to authenticated;
grant SELECT on sequence public.purchase_order_seq to service_role;
grant UPDATE on sequence public.purchase_order_seq to service_role;
grant USAGE on sequence public.purchase_order_seq to service_role;
grant DELETE on table public.purchase_orders to anon;
grant INSERT on table public.purchase_orders to anon;
grant MAINTAIN on table public.purchase_orders to anon;
grant REFERENCES on table public.purchase_orders to anon;
grant SELECT on table public.purchase_orders to anon;
grant TRIGGER on table public.purchase_orders to anon;
grant TRUNCATE on table public.purchase_orders to anon;
grant UPDATE on table public.purchase_orders to anon;
grant DELETE on table public.purchase_orders to authenticated;
grant INSERT on table public.purchase_orders to authenticated;
grant MAINTAIN on table public.purchase_orders to authenticated;
grant REFERENCES on table public.purchase_orders to authenticated;
grant SELECT on table public.purchase_orders to authenticated;
grant TRIGGER on table public.purchase_orders to authenticated;
grant TRUNCATE on table public.purchase_orders to authenticated;
grant UPDATE on table public.purchase_orders to authenticated;
grant DELETE on table public.purchase_orders to service_role;
grant INSERT on table public.purchase_orders to service_role;
grant MAINTAIN on table public.purchase_orders to service_role;
grant REFERENCES on table public.purchase_orders to service_role;
grant SELECT on table public.purchase_orders to service_role;
grant TRIGGER on table public.purchase_orders to service_role;
grant TRUNCATE on table public.purchase_orders to service_role;
grant UPDATE on table public.purchase_orders to service_role;
grant DELETE on table public.push_subscriptions to anon;
grant INSERT on table public.push_subscriptions to anon;
grant MAINTAIN on table public.push_subscriptions to anon;
grant REFERENCES on table public.push_subscriptions to anon;
grant SELECT on table public.push_subscriptions to anon;
grant TRIGGER on table public.push_subscriptions to anon;
grant TRUNCATE on table public.push_subscriptions to anon;
grant UPDATE on table public.push_subscriptions to anon;
grant DELETE on table public.push_subscriptions to authenticated;
grant INSERT on table public.push_subscriptions to authenticated;
grant MAINTAIN on table public.push_subscriptions to authenticated;
grant REFERENCES on table public.push_subscriptions to authenticated;
grant SELECT on table public.push_subscriptions to authenticated;
grant TRIGGER on table public.push_subscriptions to authenticated;
grant TRUNCATE on table public.push_subscriptions to authenticated;
grant UPDATE on table public.push_subscriptions to authenticated;
grant DELETE on table public.push_subscriptions to service_role;
grant INSERT on table public.push_subscriptions to service_role;
grant MAINTAIN on table public.push_subscriptions to service_role;
grant REFERENCES on table public.push_subscriptions to service_role;
grant SELECT on table public.push_subscriptions to service_role;
grant TRIGGER on table public.push_subscriptions to service_role;
grant TRUNCATE on table public.push_subscriptions to service_role;
grant UPDATE on table public.push_subscriptions to service_role;
grant DELETE on table public.sales_order_lines to anon;
grant INSERT on table public.sales_order_lines to anon;
grant MAINTAIN on table public.sales_order_lines to anon;
grant REFERENCES on table public.sales_order_lines to anon;
grant SELECT on table public.sales_order_lines to anon;
grant TRIGGER on table public.sales_order_lines to anon;
grant TRUNCATE on table public.sales_order_lines to anon;
grant UPDATE on table public.sales_order_lines to anon;
grant DELETE on table public.sales_order_lines to authenticated;
grant INSERT on table public.sales_order_lines to authenticated;
grant MAINTAIN on table public.sales_order_lines to authenticated;
grant REFERENCES on table public.sales_order_lines to authenticated;
grant SELECT on table public.sales_order_lines to authenticated;
grant TRIGGER on table public.sales_order_lines to authenticated;
grant TRUNCATE on table public.sales_order_lines to authenticated;
grant UPDATE on table public.sales_order_lines to authenticated;
grant DELETE on table public.sales_order_lines to service_role;
grant INSERT on table public.sales_order_lines to service_role;
grant MAINTAIN on table public.sales_order_lines to service_role;
grant REFERENCES on table public.sales_order_lines to service_role;
grant SELECT on table public.sales_order_lines to service_role;
grant TRIGGER on table public.sales_order_lines to service_role;
grant TRUNCATE on table public.sales_order_lines to service_role;
grant UPDATE on table public.sales_order_lines to service_role;
grant SELECT on sequence public.sales_order_seq to anon;
grant UPDATE on sequence public.sales_order_seq to anon;
grant USAGE on sequence public.sales_order_seq to anon;
grant SELECT on sequence public.sales_order_seq to authenticated;
grant UPDATE on sequence public.sales_order_seq to authenticated;
grant USAGE on sequence public.sales_order_seq to authenticated;
grant SELECT on sequence public.sales_order_seq to service_role;
grant UPDATE on sequence public.sales_order_seq to service_role;
grant USAGE on sequence public.sales_order_seq to service_role;
grant DELETE on table public.sales_order_totals to anon;
grant INSERT on table public.sales_order_totals to anon;
grant MAINTAIN on table public.sales_order_totals to anon;
grant REFERENCES on table public.sales_order_totals to anon;
grant SELECT on table public.sales_order_totals to anon;
grant TRIGGER on table public.sales_order_totals to anon;
grant TRUNCATE on table public.sales_order_totals to anon;
grant UPDATE on table public.sales_order_totals to anon;
grant DELETE on table public.sales_order_totals to authenticated;
grant INSERT on table public.sales_order_totals to authenticated;
grant MAINTAIN on table public.sales_order_totals to authenticated;
grant REFERENCES on table public.sales_order_totals to authenticated;
grant SELECT on table public.sales_order_totals to authenticated;
grant TRIGGER on table public.sales_order_totals to authenticated;
grant TRUNCATE on table public.sales_order_totals to authenticated;
grant UPDATE on table public.sales_order_totals to authenticated;
grant DELETE on table public.sales_order_totals to service_role;
grant INSERT on table public.sales_order_totals to service_role;
grant MAINTAIN on table public.sales_order_totals to service_role;
grant REFERENCES on table public.sales_order_totals to service_role;
grant SELECT on table public.sales_order_totals to service_role;
grant TRIGGER on table public.sales_order_totals to service_role;
grant TRUNCATE on table public.sales_order_totals to service_role;
grant UPDATE on table public.sales_order_totals to service_role;
grant DELETE on table public.sales_orders to anon;
grant INSERT on table public.sales_orders to anon;
grant MAINTAIN on table public.sales_orders to anon;
grant REFERENCES on table public.sales_orders to anon;
grant SELECT on table public.sales_orders to anon;
grant TRIGGER on table public.sales_orders to anon;
grant TRUNCATE on table public.sales_orders to anon;
grant UPDATE on table public.sales_orders to anon;
grant DELETE on table public.sales_orders to authenticated;
grant INSERT on table public.sales_orders to authenticated;
grant MAINTAIN on table public.sales_orders to authenticated;
grant REFERENCES on table public.sales_orders to authenticated;
grant SELECT on table public.sales_orders to authenticated;
grant TRIGGER on table public.sales_orders to authenticated;
grant TRUNCATE on table public.sales_orders to authenticated;
grant UPDATE on table public.sales_orders to authenticated;
grant DELETE on table public.sales_orders to service_role;
grant INSERT on table public.sales_orders to service_role;
grant MAINTAIN on table public.sales_orders to service_role;
grant REFERENCES on table public.sales_orders to service_role;
grant SELECT on table public.sales_orders to service_role;
grant TRIGGER on table public.sales_orders to service_role;
grant TRUNCATE on table public.sales_orders to service_role;
grant UPDATE on table public.sales_orders to service_role;
grant DELETE on table public.stock_levels to anon;
grant INSERT on table public.stock_levels to anon;
grant MAINTAIN on table public.stock_levels to anon;
grant REFERENCES on table public.stock_levels to anon;
grant SELECT on table public.stock_levels to anon;
grant TRIGGER on table public.stock_levels to anon;
grant TRUNCATE on table public.stock_levels to anon;
grant UPDATE on table public.stock_levels to anon;
grant DELETE on table public.stock_levels to authenticated;
grant INSERT on table public.stock_levels to authenticated;
grant MAINTAIN on table public.stock_levels to authenticated;
grant REFERENCES on table public.stock_levels to authenticated;
grant SELECT on table public.stock_levels to authenticated;
grant TRIGGER on table public.stock_levels to authenticated;
grant TRUNCATE on table public.stock_levels to authenticated;
grant UPDATE on table public.stock_levels to authenticated;
grant DELETE on table public.stock_levels to service_role;
grant INSERT on table public.stock_levels to service_role;
grant MAINTAIN on table public.stock_levels to service_role;
grant REFERENCES on table public.stock_levels to service_role;
grant SELECT on table public.stock_levels to service_role;
grant TRIGGER on table public.stock_levels to service_role;
grant TRUNCATE on table public.stock_levels to service_role;
grant UPDATE on table public.stock_levels to service_role;
grant DELETE on table public.stock_moves to anon;
grant INSERT on table public.stock_moves to anon;
grant MAINTAIN on table public.stock_moves to anon;
grant REFERENCES on table public.stock_moves to anon;
grant SELECT on table public.stock_moves to anon;
grant TRIGGER on table public.stock_moves to anon;
grant TRUNCATE on table public.stock_moves to anon;
grant UPDATE on table public.stock_moves to anon;
grant DELETE on table public.stock_moves to authenticated;
grant INSERT on table public.stock_moves to authenticated;
grant MAINTAIN on table public.stock_moves to authenticated;
grant REFERENCES on table public.stock_moves to authenticated;
grant SELECT on table public.stock_moves to authenticated;
grant TRIGGER on table public.stock_moves to authenticated;
grant TRUNCATE on table public.stock_moves to authenticated;
grant UPDATE on table public.stock_moves to authenticated;
grant DELETE on table public.stock_moves to service_role;
grant INSERT on table public.stock_moves to service_role;
grant MAINTAIN on table public.stock_moves to service_role;
grant REFERENCES on table public.stock_moves to service_role;
grant SELECT on table public.stock_moves to service_role;
grant TRIGGER on table public.stock_moves to service_role;
grant TRUNCATE on table public.stock_moves to service_role;
grant UPDATE on table public.stock_moves to service_role;
grant DELETE on table public.treasury_accounts to anon;
grant INSERT on table public.treasury_accounts to anon;
grant MAINTAIN on table public.treasury_accounts to anon;
grant REFERENCES on table public.treasury_accounts to anon;
grant SELECT on table public.treasury_accounts to anon;
grant TRIGGER on table public.treasury_accounts to anon;
grant TRUNCATE on table public.treasury_accounts to anon;
grant UPDATE on table public.treasury_accounts to anon;
grant DELETE on table public.treasury_accounts to authenticated;
grant INSERT on table public.treasury_accounts to authenticated;
grant MAINTAIN on table public.treasury_accounts to authenticated;
grant REFERENCES on table public.treasury_accounts to authenticated;
grant SELECT on table public.treasury_accounts to authenticated;
grant TRIGGER on table public.treasury_accounts to authenticated;
grant TRUNCATE on table public.treasury_accounts to authenticated;
grant UPDATE on table public.treasury_accounts to authenticated;
grant DELETE on table public.treasury_accounts to service_role;
grant INSERT on table public.treasury_accounts to service_role;
grant MAINTAIN on table public.treasury_accounts to service_role;
grant REFERENCES on table public.treasury_accounts to service_role;
grant SELECT on table public.treasury_accounts to service_role;
grant TRIGGER on table public.treasury_accounts to service_role;
grant TRUNCATE on table public.treasury_accounts to service_role;
grant UPDATE on table public.treasury_accounts to service_role;
grant DELETE on table public.treasury_balances to anon;
grant INSERT on table public.treasury_balances to anon;
grant MAINTAIN on table public.treasury_balances to anon;
grant REFERENCES on table public.treasury_balances to anon;
grant SELECT on table public.treasury_balances to anon;
grant TRIGGER on table public.treasury_balances to anon;
grant TRUNCATE on table public.treasury_balances to anon;
grant UPDATE on table public.treasury_balances to anon;
grant DELETE on table public.treasury_balances to authenticated;
grant INSERT on table public.treasury_balances to authenticated;
grant MAINTAIN on table public.treasury_balances to authenticated;
grant REFERENCES on table public.treasury_balances to authenticated;
grant SELECT on table public.treasury_balances to authenticated;
grant TRIGGER on table public.treasury_balances to authenticated;
grant TRUNCATE on table public.treasury_balances to authenticated;
grant UPDATE on table public.treasury_balances to authenticated;
grant DELETE on table public.treasury_balances to service_role;
grant INSERT on table public.treasury_balances to service_role;
grant MAINTAIN on table public.treasury_balances to service_role;
grant REFERENCES on table public.treasury_balances to service_role;
grant SELECT on table public.treasury_balances to service_role;
grant TRIGGER on table public.treasury_balances to service_role;
grant TRUNCATE on table public.treasury_balances to service_role;
grant UPDATE on table public.treasury_balances to service_role;
grant DELETE on table public.treasury_transactions to anon;
grant INSERT on table public.treasury_transactions to anon;
grant MAINTAIN on table public.treasury_transactions to anon;
grant REFERENCES on table public.treasury_transactions to anon;
grant SELECT on table public.treasury_transactions to anon;
grant TRIGGER on table public.treasury_transactions to anon;
grant TRUNCATE on table public.treasury_transactions to anon;
grant UPDATE on table public.treasury_transactions to anon;
grant DELETE on table public.treasury_transactions to authenticated;
grant INSERT on table public.treasury_transactions to authenticated;
grant MAINTAIN on table public.treasury_transactions to authenticated;
grant REFERENCES on table public.treasury_transactions to authenticated;
grant SELECT on table public.treasury_transactions to authenticated;
grant TRIGGER on table public.treasury_transactions to authenticated;
grant TRUNCATE on table public.treasury_transactions to authenticated;
grant UPDATE on table public.treasury_transactions to authenticated;
grant DELETE on table public.treasury_transactions to service_role;
grant INSERT on table public.treasury_transactions to service_role;
grant MAINTAIN on table public.treasury_transactions to service_role;
grant REFERENCES on table public.treasury_transactions to service_role;
grant SELECT on table public.treasury_transactions to service_role;
grant TRIGGER on table public.treasury_transactions to service_role;
grant TRUNCATE on table public.treasury_transactions to service_role;
grant UPDATE on table public.treasury_transactions to service_role;
grant DELETE on table public.units to anon;
grant INSERT on table public.units to anon;
grant MAINTAIN on table public.units to anon;
grant REFERENCES on table public.units to anon;
grant SELECT on table public.units to anon;
grant TRIGGER on table public.units to anon;
grant TRUNCATE on table public.units to anon;
grant UPDATE on table public.units to anon;
grant DELETE on table public.units to authenticated;
grant INSERT on table public.units to authenticated;
grant MAINTAIN on table public.units to authenticated;
grant REFERENCES on table public.units to authenticated;
grant SELECT on table public.units to authenticated;
grant TRIGGER on table public.units to authenticated;
grant TRUNCATE on table public.units to authenticated;
grant UPDATE on table public.units to authenticated;
grant DELETE on table public.units to service_role;
grant INSERT on table public.units to service_role;
grant MAINTAIN on table public.units to service_role;
grant REFERENCES on table public.units to service_role;
grant SELECT on table public.units to service_role;
grant TRIGGER on table public.units to service_role;
grant TRUNCATE on table public.units to service_role;
grant UPDATE on table public.units to service_role;
grant DELETE on table public.warehouses to anon;
grant INSERT on table public.warehouses to anon;
grant MAINTAIN on table public.warehouses to anon;
grant REFERENCES on table public.warehouses to anon;
grant SELECT on table public.warehouses to anon;
grant TRIGGER on table public.warehouses to anon;
grant TRUNCATE on table public.warehouses to anon;
grant UPDATE on table public.warehouses to anon;
grant DELETE on table public.warehouses to authenticated;
grant INSERT on table public.warehouses to authenticated;
grant MAINTAIN on table public.warehouses to authenticated;
grant REFERENCES on table public.warehouses to authenticated;
grant SELECT on table public.warehouses to authenticated;
grant TRIGGER on table public.warehouses to authenticated;
grant TRUNCATE on table public.warehouses to authenticated;
grant UPDATE on table public.warehouses to authenticated;
grant DELETE on table public.warehouses to service_role;
grant INSERT on table public.warehouses to service_role;
grant MAINTAIN on table public.warehouses to service_role;
grant REFERENCES on table public.warehouses to service_role;
grant SELECT on table public.warehouses to service_role;
grant TRIGGER on table public.warehouses to service_role;
grant TRUNCATE on table public.warehouses to service_role;
grant UPDATE on table public.warehouses to service_role;

-- Function grants ------------------------------------------------------------
grant execute on function public.apply_stock_move() to anon;
grant execute on function public.apply_stock_move() to authenticated;
grant execute on function public.apply_stock_move() to service_role;
grant execute on function public.delete_singapore_deal(p_id uuid) to anon;
grant execute on function public.delete_singapore_deal(p_id uuid) to authenticated;
grant execute on function public.delete_singapore_deal(p_id uuid) to service_role;
grant execute on function public.delete_singapore_supplier(p_id uuid) to anon;
grant execute on function public.delete_singapore_supplier(p_id uuid) to authenticated;
grant execute on function public.delete_singapore_supplier(p_id uuid) to service_role;
grant execute on function public.generate_invoice_number() to anon;
grant execute on function public.generate_invoice_number() to authenticated;
grant execute on function public.generate_invoice_number() to service_role;
grant execute on function public.generate_order_number() to anon;
grant execute on function public.generate_order_number() to authenticated;
grant execute on function public.generate_order_number() to service_role;
grant execute on function public.generate_purchase_number() to anon;
grant execute on function public.generate_purchase_number() to authenticated;
grant execute on function public.generate_purchase_number() to service_role;
grant execute on function public.get_singapore_deal(p_id uuid) to anon;
grant execute on function public.get_singapore_deal(p_id uuid) to authenticated;
grant execute on function public.get_singapore_deal(p_id uuid) to service_role;
grant execute on function public.get_singapore_deals() to anon;
grant execute on function public.get_singapore_deals() to authenticated;
grant execute on function public.get_singapore_deals() to service_role;
grant execute on function public.get_singapore_suppliers() to anon;
grant execute on function public.get_singapore_suppliers() to authenticated;
grant execute on function public.get_singapore_suppliers() to service_role;
grant execute on function public.handle_new_user() to anon;
grant execute on function public.handle_new_user() to authenticated;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.insert_singapore_account(p_name text, p_type text, p_industry text, p_country text, p_city text, p_phone text, p_email text, p_website text, p_notes text) to anon;
grant execute on function public.insert_singapore_account(p_name text, p_type text, p_industry text, p_country text, p_city text, p_phone text, p_email text, p_website text, p_notes text) to authenticated;
grant execute on function public.insert_singapore_account(p_name text, p_type text, p_industry text, p_country text, p_city text, p_phone text, p_email text, p_website text, p_notes text) to service_role;
grant execute on function public.insert_singapore_lead(p_name text, p_email text, p_phone text, p_country text, p_city text, p_deal_title text, p_notes text, p_source_url text) to anon;
grant execute on function public.insert_singapore_lead(p_name text, p_email text, p_phone text, p_country text, p_city text, p_deal_title text, p_notes text, p_source_url text) to authenticated;
grant execute on function public.insert_singapore_lead(p_name text, p_email text, p_phone text, p_country text, p_city text, p_deal_title text, p_notes text, p_source_url text) to service_role;
grant execute on function public.insert_singapore_supplier(p_name text, p_email text, p_phone text, p_country text, p_city text, p_address text, p_payment_terms text, p_currency text, p_iban text, p_swift text, p_bank_name text, p_notes text) to anon;
grant execute on function public.insert_singapore_supplier(p_name text, p_email text, p_phone text, p_country text, p_city text, p_address text, p_payment_terms text, p_currency text, p_iban text, p_swift text, p_bank_name text, p_notes text) to authenticated;
grant execute on function public.insert_singapore_supplier(p_name text, p_email text, p_phone text, p_country text, p_city text, p_address text, p_payment_terms text, p_currency text, p_iban text, p_swift text, p_bank_name text, p_notes text) to service_role;
grant execute on function public.payment_to_treasury() to anon;
grant execute on function public.payment_to_treasury() to authenticated;
grant execute on function public.payment_to_treasury() to service_role;
grant execute on function public.set_updated_at() to anon;
grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.set_updated_at() to service_role;
grant execute on function public.transfer_singapore_to_guinee(p_deal_id uuid) to anon;
grant execute on function public.transfer_singapore_to_guinee(p_deal_id uuid) to authenticated;
grant execute on function public.transfer_singapore_to_guinee(p_deal_id uuid) to service_role;
grant execute on function public.update_invoice_status() to anon;
grant execute on function public.update_invoice_status() to authenticated;
grant execute on function public.update_invoice_status() to service_role;
grant execute on function public.update_singapore_supplier(p_id uuid, p_name text, p_email text, p_phone text, p_country text, p_city text, p_address text, p_payment_terms text, p_currency text, p_iban text, p_swift text, p_bank_name text, p_notes text) to anon;
grant execute on function public.update_singapore_supplier(p_id uuid, p_name text, p_email text, p_phone text, p_country text, p_city text, p_address text, p_payment_terms text, p_currency text, p_iban text, p_swift text, p_bank_name text, p_notes text) to authenticated;
grant execute on function public.update_singapore_supplier(p_id uuid, p_name text, p_email text, p_phone text, p_country text, p_city text, p_address text, p_payment_terms text, p_currency text, p_iban text, p_swift text, p_bank_name text, p_notes text) to service_role;
grant execute on function public.update_updated_at() to anon;
grant execute on function public.update_updated_at() to authenticated;
grant execute on function public.update_updated_at() to service_role;

-- Storage buckets ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('Avatar', 'Avatar', true, null, null) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('documents', 'documents', true, 52428800, '{application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv}'::text[]) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('logos', 'logos', true, 2097152, '{image/jpeg,image/png,image/webp,image/svg+xml}'::text[]) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('product-documents', 'product-documents', true, null, null) on conflict (id) do nothing;

-- Default privileges ------------------------------------------------------------
alter default privileges for role postgres in schema geg_singapore grant SELECT on sequences to anon;
alter default privileges for role postgres in schema geg_singapore grant UPDATE on sequences to anon;
alter default privileges for role postgres in schema geg_singapore grant USAGE on sequences to anon;
alter default privileges for role postgres in schema geg_singapore grant SELECT on sequences to authenticated;
alter default privileges for role postgres in schema geg_singapore grant UPDATE on sequences to authenticated;
alter default privileges for role postgres in schema geg_singapore grant USAGE on sequences to authenticated;
alter default privileges for role postgres in schema geg_singapore grant SELECT on sequences to service_role;
alter default privileges for role postgres in schema geg_singapore grant UPDATE on sequences to service_role;
alter default privileges for role postgres in schema geg_singapore grant USAGE on sequences to service_role;
alter default privileges for role postgres in schema geg_singapore grant DELETE on tables to anon;
alter default privileges for role postgres in schema geg_singapore grant INSERT on tables to anon;
alter default privileges for role postgres in schema geg_singapore grant MAINTAIN on tables to anon;
alter default privileges for role postgres in schema geg_singapore grant REFERENCES on tables to anon;
alter default privileges for role postgres in schema geg_singapore grant SELECT on tables to anon;
alter default privileges for role postgres in schema geg_singapore grant TRIGGER on tables to anon;
alter default privileges for role postgres in schema geg_singapore grant TRUNCATE on tables to anon;
alter default privileges for role postgres in schema geg_singapore grant UPDATE on tables to anon;
alter default privileges for role postgres in schema geg_singapore grant DELETE on tables to authenticated;
alter default privileges for role postgres in schema geg_singapore grant INSERT on tables to authenticated;
alter default privileges for role postgres in schema geg_singapore grant MAINTAIN on tables to authenticated;
alter default privileges for role postgres in schema geg_singapore grant REFERENCES on tables to authenticated;
alter default privileges for role postgres in schema geg_singapore grant SELECT on tables to authenticated;
alter default privileges for role postgres in schema geg_singapore grant TRIGGER on tables to authenticated;
alter default privileges for role postgres in schema geg_singapore grant TRUNCATE on tables to authenticated;
alter default privileges for role postgres in schema geg_singapore grant UPDATE on tables to authenticated;
alter default privileges for role postgres in schema geg_singapore grant DELETE on tables to service_role;
alter default privileges for role postgres in schema geg_singapore grant INSERT on tables to service_role;
alter default privileges for role postgres in schema geg_singapore grant MAINTAIN on tables to service_role;
alter default privileges for role postgres in schema geg_singapore grant REFERENCES on tables to service_role;
alter default privileges for role postgres in schema geg_singapore grant SELECT on tables to service_role;
alter default privileges for role postgres in schema geg_singapore grant TRIGGER on tables to service_role;
alter default privileges for role postgres in schema geg_singapore grant TRUNCATE on tables to service_role;
alter default privileges for role postgres in schema geg_singapore grant UPDATE on tables to service_role;
