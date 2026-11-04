-- Fixed rights per role, account blocking and locking of emitted invoices
-- (decisions D1 to D8 of 04/11/2026, see RAPPORT_ROLES_UTILISATEURS_TEST.md).
-- Requires 20261027120000_p0_security.sql and 20261104120000_super_admin.sql.
-- Rollback: supabase/rollback/20261105120000_roles_permissions_rollback.sql
-- No business data, table or history is deleted: columns, functions, policies and triggers are added.
-- The application server uses the service role (not subject to RLS): these rules protect direct
-- database access; the triggers apply to everyone, server included.

begin;

-- 1. Blocking an account keeps the account and its history -----------------------------------------

alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles add column if not exists blocked_at timestamptz;
alter table public.profiles add column if not exists blocked_by uuid references public.profiles (id);

-- A blocked account loses every company at once, even with a session still open
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
      and not p.is_blocked
      and c.schema_name = p_schema
      and c.is_active
  )
$$;

-- 2. Rights of each role: mirror of src/lib/permissions.ts (keep both in sync) ---------------------

create or replace function public.has_capability(p_cap text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and not p.is_blocked
      and case p.role
        when 'super_admin' then true
        when 'admin' then p_cap <> 'companies.manage'
        when 'manager' then p_cap not in ('users.manage', 'duplicates.merge', 'companies.manage')
        when 'sales_rep' then p_cap in ('crm.write', 'sales.write', 'purchases.view')
        else false
      end
  )
$$;

revoke all on function public.has_capability(text) from public, anon;
grant execute on function public.has_capability(text) to authenticated, service_role;

-- 3. Restrictive policies: on top of the company check, the role must have the right ----------------

do $$
declare
  -- table → right needed to create or modify rows
  write_caps constant jsonb := '{
    "accounts": "crm.write", "contacts": "crm.write", "deals": "crm.write", "activities": "crm.write",
    "documents": "crm.write", "document_categories": "crm.write", "shipments": "crm.write",
    "sales_orders": "sales.write", "sales_order_lines": "sales.write", "invoices": "sales.write",
    "invoice_lines": "sales.write", "delivery_notes": "sales.write", "delivery_note_lines": "sales.write",
    "document_tokens": "sales.write",
    "payments": "payments.write",
    "purchase_orders": "purchases.write", "purchase_order_lines": "purchases.write",
    "purchase_order_events": "purchases.write", "purchase_costs": "purchases.write",
    "purchase_receptions": "purchases.write", "purchase_reception_lines": "purchases.write",
    "supplier_invoices": "purchases.write", "supplier_invoice_lines": "purchases.write",
    "supplier_payments": "purchases.write", "suppliers": "purchases.write", "deal_costs": "purchases.write",
    "treasury_accounts": "treasury.write", "treasury_transactions": "treasury.write",
    "stock_moves": "stock.write", "stock_levels": "stock.write", "warehouses": "stock.write",
    "products": "products.write", "product_categories": "products.write",
    "product_documents": "products.write", "product_packaging": "products.write",
    "employees": "employees.write", "commissions": "employees.write",
    "units": "settings.write", "exchange_rates": "settings.write"
  }';
  -- table → right needed to delete rows (default: "delete", never given to commercials)
  delete_caps constant jsonb := '{
    "sales_order_lines": "sales.write", "invoice_lines": "sales.write", "delivery_note_lines": "sales.write",
    "chat_messages": "sales.write", "chat_read_receipts": "sales.write", "chat_rooms": "sales.write",
    "activity_logs": "companies.manage"
  }';
  -- tables nobody may read without the right (treasury, D3)
  read_caps constant jsonb := '{ "treasury_accounts": "treasury.view", "treasury_transactions": "treasury.view" }';
  t record;
  cap text;
begin
  for t in
    select n.nspname as s, c.relname as r
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and (n.nspname in ('geg_guinee', 'geg_singapore')
           or (n.nspname = 'public' and (write_caps ? c.relname)))
  loop
    execute format('drop policy if exists role_delete on %I.%I', t.s, t.r);
    execute format('drop policy if exists role_insert on %I.%I', t.s, t.r);
    execute format('drop policy if exists role_update on %I.%I', t.s, t.r);
    execute format('drop policy if exists role_select on %I.%I', t.s, t.r);

    cap := coalesce(delete_caps ->> t.r, 'delete');
    execute format(
      'create policy role_delete on %I.%I as restrictive for delete to authenticated using (public.has_capability(%L))',
      t.s, t.r, cap);

    cap := write_caps ->> t.r;
    if cap is not null then
      execute format(
        'create policy role_insert on %I.%I as restrictive for insert to authenticated with check (public.has_capability(%L))',
        t.s, t.r, cap);
      execute format(
        'create policy role_update on %I.%I as restrictive for update to authenticated using (public.has_capability(%L)) with check (public.has_capability(%L))',
        t.s, t.r, cap, cap);
    end if;

    cap := read_caps ->> t.r;
    if cap is not null then
      execute format(
        'create policy role_select on %I.%I as restrictive for select to authenticated using (public.has_capability(%L))',
        t.s, t.r, cap);
    end if;
  end loop;
end $$;

-- The older supplier rule is covered by role_delete
drop policy if exists suppliers_delete_role on geg_guinee.suppliers;
drop policy if exists suppliers_delete_role on geg_singapore.suppliers;

-- 4. Emitted invoices are locked, for every role (D1) ----------------------------------------------

create or replace function public.invoice_lock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  if tg_table_name = 'invoices' then
    if old.status is distinct from 'draft' then
      if new.status = 'draft' then
        raise exception 'Facture émise : elle ne peut pas revenir en brouillon (passer par un avoir)';
      end if;
      if old.status = 'cancelled' and new.status <> 'cancelled' then
        raise exception 'Facture annulée : son statut ne peut plus changer';
      end if;
      if old.status = 'paid' and new.status = 'cancelled' then
        raise exception 'Facture payée : elle ne peut pas être annulée (passer par un avoir)';
      end if;
      if (new.account_id, new.issue_date, new.due_date, new.currency, new.number, new.order_id)
         is distinct from (old.account_id, old.issue_date, old.due_date, old.currency, old.number, old.order_id) then
        raise exception 'Facture émise : client, dates, devise et numéro ne sont plus modifiables (passer par un avoir)';
      end if;
    end if;
    return new;
  end if;

  -- invoice_lines: only while the invoice is a draft
  execute format('select status from %I.invoices where id = $1', tg_table_schema)
    into v_status
    using case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  if v_status is not null and v_status <> 'draft' then
    raise exception 'Facture émise : ses lignes ne sont plus modifiables (passer par un avoir)';
  end if;
  if tg_op = 'UPDATE' and new.invoice_id is distinct from old.invoice_id then
    execute format('select status from %I.invoices where id = $1', tg_table_schema) into v_status using old.invoice_id;
    if v_status is not null and v_status <> 'draft' then
      raise exception 'Facture émise : ses lignes ne sont plus modifiables (passer par un avoir)';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('drop trigger if exists invoice_lock on %I.invoices', s);
    execute format('create trigger invoice_lock before update on %I.invoices for each row execute function public.invoice_lock()', s);
    execute format('drop trigger if exists invoice_lines_lock on %I.invoice_lines', s);
    execute format('create trigger invoice_lines_lock before insert or update or delete on %I.invoice_lines for each row execute function public.invoice_lock()', s);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
