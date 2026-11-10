-- Catalogue, sales lines and stock (REGLES_PRODUITS_STOCK_FACTURATION.md, decisions R1-R6 / H1-H4 of 10/11/2026).
-- Requires 20261107120000_permissions_f1_f3.sql.
-- Rollback: supabase/rollback/20261110120000_catalogue_stock_rollback.sql
-- No business row is modified: historical documents, free lines and stock levels stay as they are.

begin;

-- H3 / R4: exceptional delivery beyond the available stock (Super admin, Admin, Manager; exception per company)
insert into public.permission_catalog (key, module, label, sort, sensitive, customizable, grantable_to_sales_rep)
values ('stock.livraison_hors_stock', 'Stock', 'Stock : autoriser une livraison au-delà du stock disponible', 515, false, true, true)
on conflict (key) do update set label = excluded.label, module = excluded.module, sort = excluded.sort;
insert into public.role_permissions (role, permission_key)
values ('super_admin', 'stock.livraison_hors_stock'), ('admin', 'stock.livraison_hors_stock'), ('manager', 'stock.livraison_hors_stock')
on conflict do nothing;

-- R1 / R2: every NEW sales line (quote, invoice) is an ACTIVE product or service of the catalogue.
-- Fires on insert and when product_id is changed; historical lines are never touched.
-- Credit notes (invoice number AVR-…) copy the lines of the original invoice as they were.
create or replace function public.catalog_line_rules()
returns trigger language plpgsql set search_path = public as $$
declare v_active boolean; v_number text;
begin
  if tg_op = 'UPDATE' and new.product_id is not distinct from old.product_id then
    return new;
  end if;
  if tg_table_name = 'invoice_lines' then
    execute format('select number from %I.invoices where id = $1', tg_table_schema) into v_number using new.invoice_id;
    if coalesce(v_number, '') like 'AVR-%' then return new; end if;
  end if;
  if new.product_id is null then
    raise exception 'Ligne refusée : chaque ligne doit être un produit ou un service du catalogue GEG (aucune ligne libre)';
  end if;
  execute format('select is_active from %I.products where id = $1', tg_table_schema) into v_active using new.product_id;
  if v_active is null then raise exception 'Ligne refusée : produit introuvable dans le catalogue'; end if;
  if not v_active then raise exception 'Ligne refusée : ce produit est désactivé et ne peut plus être vendu'; end if;
  return new;
end $$;

do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    foreach t in array array['sales_order_lines', 'invoice_lines'] loop
      execute format('drop trigger if exists catalog_line_rules on %I.%I', s, t);
      execute format('create trigger catalog_line_rules before insert or update of product_id on %I.%I for each row execute function public.catalog_line_rules()', s, t);
    end loop;
  end loop;
end $$;

-- R1: emission of an invoice / confirmation of a quote need every line to be a catalogue product
create or replace function public.document_rules()
returns trigger language plpgsql set search_path = public as $$
declare v_status text; n int; k text;
begin
  if tg_table_name = 'invoices' then
    -- R1: an invoice is emitted only when every line is a catalogue product (credit notes copy old lines)
    if old.status = 'draft' and new.status = 'sent' and coalesce(new.number, '') not like 'AVR-%' then
      execute format('select count(*) from %I.invoice_lines where invoice_id = $1 and product_id is null', tg_table_schema) into n using old.id;
      if n > 0 then raise exception 'Facture : % ligne(s) sans produit du catalogue. Associez chaque ligne à un produit ou service avant d''émettre', n; end if;
    end if;
    if old.status is distinct from 'draft' then
      if new.status = 'draft' then raise exception 'Facture émise : elle ne peut pas revenir en brouillon (corriger par un avoir)'; end if;
      if new.status = 'cancelled' and old.status <> 'cancelled' then raise exception 'Facture émise : elle ne peut pas être annulée (corriger par un avoir)'; end if;
      if old.status = 'cancelled' and new.status <> 'cancelled' then raise exception 'Facture annulée : son statut ne peut plus changer'; end if;
      if (new.account_id, new.issue_date, new.due_date, new.currency, new.number, new.order_id, new.notes)
         is distinct from (old.account_id, old.issue_date, old.due_date, old.currency, old.number, old.order_id, old.notes) then
        raise exception 'Facture émise : client, dates, devise, numéro et mentions imprimées ne sont plus modifiables (corriger par un avoir)';
      end if;
    end if;
    return new;

  elsif tg_table_name = 'invoice_lines' then
    execute format('select status from %I.invoices where id = $1', tg_table_schema) into v_status
      using case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
    if v_status is not null and v_status <> 'draft' then raise exception 'Facture émise : ses lignes ne sont plus modifiables (corriger par un avoir)'; end if;
    if tg_op = 'UPDATE' and new.invoice_id is distinct from old.invoice_id then
      execute format('select status from %I.invoices where id = $1', tg_table_schema) into v_status using old.invoice_id;
      if v_status is not null and v_status <> 'draft' then raise exception 'Facture émise : ses lignes ne sont plus modifiables'; end if;
    end if;
    return case when tg_op = 'DELETE' then old else new end;

  elsif tg_table_name = 'sales_orders' then
    -- F3: cancelled quote, nothing changes any more (status, project, fields)
    if old.status = 'cancelled' then
      for k in select jsonb_object_keys(to_jsonb(new)) loop
        if k <> 'updated_at' and (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
          raise exception 'Devis annulé : il n''est plus modifiable (champ refusé : %)', k;
        end if;
      end loop;
      return new;
    end if;
    -- R1: a quote is confirmed only when every line is a catalogue product
    if old.status = 'draft' and new.status = 'confirmed' then
      execute format('select count(*) from %I.sales_order_lines where order_id = $1 and product_id is null', tg_table_schema) into n using old.id;
      if n > 0 then raise exception 'Devis : % ligne(s) sans produit du catalogue. Associez chaque ligne à un produit ou service avant de confirmer', n; end if;
    end if;
    if new.status is distinct from old.status then
      execute format('select count(*) from %I.invoices where order_id = $1 and status <> ''cancelled''', tg_table_schema) into n using old.id;
      if old.status = 'invoiced' and n > 0 then raise exception 'Devis facturé : son statut ne peut plus changer'; end if;
      if new.status = 'cancelled' and n > 0 then raise exception 'Ce devis a une facture : il ne peut pas être annulé'; end if;
    end if;
    -- E1: invoiced quote frozen except its project
    if old.status = 'invoiced' then
      for k in select jsonb_object_keys(to_jsonb(new)) loop
        if k not in ('project_code', 'updated_at') and (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
          raise exception 'Devis facturé : seul le projet reste modifiable (champ refusé : %)', k;
        end if;
      end loop;
    end if;
    return new;

  elsif tg_table_name = 'sales_order_lines' then
    execute format('select status from %I.sales_orders where id = $1', tg_table_schema) into v_status
      using case when tg_op = 'DELETE' then old.order_id else new.order_id end;
    if v_status = 'cancelled' then
      raise exception 'Devis annulé : ses lignes ne sont plus modifiables';
    end if;
    if v_status = 'invoiced' then
      if tg_op <> 'UPDATE' then raise exception 'Devis facturé : ses lignes ne sont plus modifiables'; end if;
      for k in select jsonb_object_keys(to_jsonb(new)) loop
        if k <> 'qty_delivered' and (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
          raise exception 'Devis facturé : ses lignes ne sont plus modifiables (champ refusé : %)', k;
        end if;
      end loop;
    end if;
    return case when tg_op = 'DELETE' then old else new end;

  elsif tg_table_name = 'delivery_notes' then
    if old.status = 'delivered' and new.status is distinct from 'delivered' then
      raise exception 'Bon de livraison livré : il ne peut plus être annulé ni modifié (retour de stock : second chantier)';
    end if;
    if old.status = 'cancelled' and new.status <> 'cancelled' then raise exception 'Bon de livraison annulé : son statut ne peut plus changer'; end if;
    return new;

  elsif tg_table_name = 'purchase_orders' then
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      execute format('select count(*) from %I.purchase_receptions where order_id = $1', tg_table_schema) into n using old.id;
      if n > 0 or old.status in ('partial', 'received') then
        raise exception 'Commande d''achat déjà réceptionnée : elle ne peut pas être annulée';
      end if;
    end if;
    return new;

  elsif tg_table_name = 'supplier_invoices' then
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      execute format('select count(*) from %I.supplier_payments where supplier_invoice_id = $1', tg_table_schema) into n using old.id;
      if n > 0 or old.status <> 'pending' then
        raise exception 'Seule une facture fournisseur « En attente » et sans paiement peut être annulée (sinon : avoir)';
      end if;
    end if;
    return new;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';

commit;
