-- P0 security fixes (see AUDIT_1A_MULTISOCIETES.md and RAPPORT_CORRECTIONS_SECURITE_P0.md)
-- Rollback: supabase/rollback/20261027120000_p0_security_rollback.sql
-- No business data, table or history is deleted: only policies, grants and view options change.

begin;

-- 1. Company access check shared by the RLS policies --------------------------------------------

create or replace function public.has_company_access(p_schema text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.companies c on c.id = any (p.company_access)
    where p.id = auth.uid()
      and c.schema_name = p_schema
      and c.is_active
  )
$$;

revoke all on function public.has_company_access(text) from public, anon;
grant execute on function public.has_company_access(text) to authenticated, service_role;

-- 2. Profiles: users may edit their own name and avatar, never their role, rights or companies ---

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  as permissive for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, updated_at) on public.profiles to authenticated;

-- 3. Singapore functions: callable by the server (service_role) only -----------------------------
-- The API routes check the user's access to GEG Singapore before calling them.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like '%singapore%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- 4. Visitors without a session get nothing from the company schemas -------------------------------

revoke all on all tables in schema geg_guinee, geg_singapore from anon;
revoke all on all sequences in schema geg_guinee, geg_singapore from anon;
revoke all on all functions in schema geg_guinee, geg_singapore from anon;
revoke usage on schema geg_guinee, geg_singapore from anon;
alter default privileges for role postgres in schema geg_guinee revoke all on tables from anon;
alter default privileges for role postgres in schema geg_guinee revoke all on sequences from anon;
alter default privileges for role postgres in schema geg_guinee revoke all on functions from anon;
alter default privileges for role postgres in schema geg_singapore revoke all on tables from anon;
alter default privileges for role postgres in schema geg_singapore revoke all on sequences from anon;
alter default privileges for role postgres in schema geg_singapore revoke all on functions from anon;

-- 5. GEG Guinée: remove the "allow everyone" policies so the company check applies ----------------

drop policy if exists "authenticated crud accounts" on geg_guinee.accounts;
drop policy if exists allow_authenticated_read on geg_guinee.accounts;
drop policy if exists "authenticated crud contacts" on geg_guinee.contacts;
drop policy if exists "Authenticated users can manage deal_costs" on geg_guinee.deal_costs;
drop policy if exists delivery_note_lines_all on geg_guinee.delivery_note_lines;
drop policy if exists auth_delivery_note_lines on geg_guinee.delivery_note_lines;
drop policy if exists delivery_notes_all on geg_guinee.delivery_notes;
drop policy if exists auth_delivery_notes on geg_guinee.delivery_notes;
drop policy if exists "authenticated crud employees" on geg_guinee.employees;
drop policy if exists "authenticated crud invoice_lines" on geg_guinee.invoice_lines;
drop policy if exists "authenticated crud invoices" on geg_guinee.invoices;
drop policy if exists "authenticated crud payments" on geg_guinee.payments;
drop policy if exists product_documents_all on geg_guinee.product_documents;
drop policy if exists "authenticated crud products" on geg_guinee.products;
drop policy if exists "authenticated crud purchase_order_lines" on geg_guinee.purchase_order_lines;
drop policy if exists "Allow authenticated update on purchase_orders" on geg_guinee.purchase_orders;
drop policy if exists "Allow authenticated select on purchase_orders" on geg_guinee.purchase_orders;
drop policy if exists "Allow authenticated insert on purchase_orders" on geg_guinee.purchase_orders;
drop policy if exists authenticated_all on geg_guinee.purchase_reception_lines;
drop policy if exists authenticated_all on geg_guinee.purchase_receptions;
drop policy if exists "authenticated crud sales_order_lines" on geg_guinee.sales_order_lines;
drop policy if exists "authenticated crud sales_orders" on geg_guinee.sales_orders;
drop policy if exists allow_all_authenticated on geg_guinee.stock_levels;
drop policy if exists allow_all_authenticated on geg_guinee.stock_moves;
drop policy if exists "authenticated crud supplier_invoice_lines" on geg_guinee.supplier_invoice_lines;
drop policy if exists allow_all_supplier_invoice_lines_anon on geg_guinee.supplier_invoice_lines;
drop policy if exists allow_all_supplier_invoice_lines on geg_guinee.supplier_invoice_lines;
drop policy if exists "authenticated crud supplier_invoices" on geg_guinee.supplier_invoices;
drop policy if exists allow_all_supplier_invoices_anon on geg_guinee.supplier_invoices;
drop policy if exists allow_all_supplier_invoices on geg_guinee.supplier_invoices;
drop policy if exists "authenticated crud supplier_payments" on geg_guinee.supplier_payments;
drop policy if exists allow_all_supplier_payments_anon on geg_guinee.supplier_payments;
drop policy if exists allow_all_supplier_payments on geg_guinee.supplier_payments;
drop policy if exists suppliers_select on geg_guinee.suppliers;
drop policy if exists suppliers_insert on geg_guinee.suppliers;
drop policy if exists suppliers_update on geg_guinee.suppliers;
drop policy if exists "Users can insert treasury_accounts" on geg_guinee.treasury_accounts;
drop policy if exists "authenticated crud units" on geg_guinee.units;

-- Tables whose only policies were "allow everyone": give them the company check
do $$
declare t text;
begin
  foreach t in array array[
    'deal_costs', 'delivery_note_lines', 'delivery_notes', 'product_documents', 'product_packaging',
    'purchase_reception_lines', 'purchase_receptions', 'supplier_invoice_lines', 'supplier_invoices',
    'supplier_payments', 'suppliers'
  ]
  loop
    execute format('drop policy if exists %I on geg_guinee.%I', 'company_access_' || t, t);
    execute format(
      'create policy %I on geg_guinee.%I as permissive for all to authenticated '
      'using (public.has_company_access(''geg_guinee'')) with check (public.has_company_access(''geg_guinee''))',
      'company_access_' || t, t);
  end loop;
end $$;

-- These two tables had row level security switched off
alter table geg_guinee.product_packaging enable row level security;
alter table geg_guinee.warehouses enable row level security;

-- Summary views must apply the caller's rights instead of their owner's
alter view geg_guinee.invoice_totals set (security_invoker = true);
alter view geg_guinee.sales_order_totals set (security_invoker = true);
alter view geg_guinee.supplier_invoice_totals set (security_invoker = true);
alter view geg_guinee.purchase_landed_costs set (security_invoker = true);
alter view geg_guinee.treasury_balances set (security_invoker = true);

-- 6. GEG Singapore: only users with GEG Singapore in profiles.company_access -----------------------

do $$
declare p record; t text;
begin
  for p in select policyname, tablename from pg_policies where schemaname = 'geg_singapore'
  loop
    execute format('drop policy %I on geg_singapore.%I', p.policyname, p.tablename);
  end loop;

  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'geg_singapore' and c.relkind in ('r', 'p')
  loop
    execute format('alter table geg_singapore.%I enable row level security', t);
    execute format(
      'create policy %I on geg_singapore.%I as permissive for all to authenticated '
      'using (public.has_company_access(''geg_singapore'')) with check (public.has_company_access(''geg_singapore''))',
      'company_access_' || t, t);
  end loop;
end $$;

-- Keep the existing rule: only admins and managers delete suppliers (both companies)
drop policy if exists suppliers_delete on geg_guinee.suppliers;
drop policy if exists suppliers_delete_role on geg_guinee.suppliers;
create policy suppliers_delete_role on geg_guinee.suppliers
  as restrictive for delete to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'manager')));
create policy suppliers_delete_role on geg_singapore.suppliers
  as restrictive for delete to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin', 'manager')));

notify pgrst, 'reload schema';

commit;
