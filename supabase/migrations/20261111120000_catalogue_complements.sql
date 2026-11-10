-- Catalogue complements (decisions of 10/11/2026 following RAPPORT_CATALOGUE_STOCK_TEST.md):
--   1. real comment lines on quotes and invoices (no product, quantity, price nor amount; printing chosen per line)
--   2. negative amounts (flat discounts) only on SERVICE lines, e.g. "Remise commerciale"
--   3-5. products "to complete" (marker + missing information) and brand
--   6. historical correspondence table: free lines of old documents -> catalogue product, without touching the documents
-- Requires 20261110120000_catalogue_stock.sql. Rollback: supabase/rollback/20261111120000_catalogue_complements_rollback.sql
-- No business row is modified: documents, amounts, VAT, stock and accounting stay as they are.

begin;

-- 1. Comment lines -------------------------------------------------------------------------------
do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    foreach t in array array['sales_order_lines', 'invoice_lines'] loop
      execute format('alter table %I.%I add column if not exists line_type text not null default %L', s, t, 'product');
      execute format('alter table %I.%I add column if not exists print_on_pdf boolean not null default true', s, t);
      execute format('alter table %I.%I drop constraint if exists %I', s, t, t || '_line_type_check');
      execute format('alter table %I.%I add constraint %I check (line_type in (%L, %L))', s, t, t || '_line_type_check', 'product', 'comment');
    end loop;
  end loop;
end $$;

-- 3-5. Products to complete, brand (new catalogue rule: different brands = distinct products)
do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('alter table %I.products add column if not exists to_complete boolean not null default false', s);
    execute format('alter table %I.products add column if not exists missing_info text', s);
    execute format('alter table %I.products add column if not exists brand text', s);
  end loop;
end $$;

-- R1 / R2 + comment lines + negative amounts
create or replace function public.catalog_line_rules()
returns trigger language plpgsql set search_path = public as $$
declare v_active boolean; v_type text; v_number text; v_amount_changed boolean;
begin
  if tg_table_name = 'invoice_lines' then
    execute format('select number from %I.invoices where id = $1', tg_table_schema) into v_number using new.invoice_id;
    if coalesce(v_number, '') like 'AVR-%' then return new; end if;   -- credit notes copy the original lines
  end if;

  -- Comment line: text only, never a product, a quantity, a price nor an amount
  if new.line_type = 'comment' then
    if new.product_id is not null or new.quantity <> 0 or new.unit_price <> 0 or new.discount <> 0 then
      raise exception 'Ligne de commentaire : elle ne peut avoir ni produit, ni quantité, ni prix, ni remise';
    end if;
    if tg_table_name = 'sales_order_lines' then   -- qty_delivered only exists on quote lines (no short-circuit in PL/pgSQL)
      if (to_jsonb(new) ->> 'qty_delivered')::numeric <> 0 then
        raise exception 'Ligne de commentaire : elle ne peut pas être livrée';
      end if;
    end if;
    if btrim(coalesce(new.description, '')) = '' then raise exception 'Ligne de commentaire vide'; end if;
    return new;
  end if;

  v_amount_changed := tg_op = 'INSERT' or new.unit_price is distinct from old.unit_price;
  -- Historical lines are left as they are while their product does not change (R1 applies to new lines)
  if tg_op = 'UPDATE' and old.line_type = 'product' and new.product_id is not distinct from old.product_id then
    if v_amount_changed and new.unit_price < 0 then
      if new.product_id is not null then
        execute format('select product_type from %I.products where id = $1', tg_table_schema) into v_type using new.product_id;
      end if;
      if v_type is distinct from 'service' then
        raise exception 'Montant négatif refusé : seule une ligne de service (ex. Remise commerciale) peut être négative';
      end if;
    end if;
    return new;
  end if;

  if new.product_id is null then
    raise exception 'Ligne refusée : chaque ligne doit être un produit ou un service du catalogue GEG (aucune ligne libre)';
  end if;
  execute format('select is_active, product_type from %I.products where id = $1', tg_table_schema) into v_active, v_type using new.product_id;
  if v_active is null then raise exception 'Ligne refusée : produit introuvable dans le catalogue'; end if;
  if not v_active then raise exception 'Ligne refusée : ce produit est désactivé et ne peut plus être vendu'; end if;
  if new.unit_price < 0 and v_type is distinct from 'service' then
    raise exception 'Montant négatif refusé : seule une ligne de service (ex. Remise commerciale) peut être négative';
  end if;
  return new;
end $$;

do $$
declare s text; t text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    foreach t in array array['sales_order_lines', 'invoice_lines'] loop
      execute format('drop trigger if exists catalog_line_rules on %I.%I', s, t);
      execute format('create trigger catalog_line_rules before insert or update of product_id, line_type, quantity, unit_price, discount on %I.%I for each row execute function public.catalog_line_rules()', s, t);
    end loop;
  end loop;
end $$;

-- 6. Historical correspondence: old free line -> catalogue product (documents never modified) -----
do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format($f$
      create table if not exists %1$I.historical_line_links (
        id uuid primary key default gen_random_uuid(),
        line_table text not null check (line_table in ('invoice_lines', 'sales_order_lines')),
        line_id uuid not null,
        product_id uuid not null references %1$I.products(id),
        status text not null default 'proposed' check (status in ('proposed', 'validated', 'cancelled')),
        source text not null default 'manual' check (source in ('manual', 'auto_h4')),
        note text,
        created_by uuid, created_at timestamptz not null default now(),
        validated_by uuid, validated_at timestamptz,
        cancelled_by uuid, cancelled_at timestamptz, cancel_reason text
      )$f$, s);
    execute format('create unique index if not exists historical_line_links_one_active on %I.historical_line_links (line_table, line_id) where status <> %L', s, 'cancelled');
    execute format('create index if not exists historical_line_links_product on %I.historical_line_links (product_id)', s);
    execute format('alter table %I.historical_line_links enable row level security', s);
    execute format('revoke all on %I.historical_line_links from anon, authenticated', s);
    execute format('grant select on %I.historical_line_links to authenticated', s);
    execute format('grant all on %I.historical_line_links to service_role', s);
    execute format('drop policy if exists links_read on %I.historical_line_links', s);
    execute format('create policy links_read on %1$I.historical_line_links for select to authenticated using ((select public.has_company_access(%1$L)) and (select public.has_any_permission(array[%2$L], %1$L)))', s, 'produits.voir');
  end loop;
end $$;

create or replace function public.historical_link_rules()
returns trigger language plpgsql set search_path = public as $$
declare n int;
begin
  if tg_op = 'DELETE' then raise exception 'Une correspondance ne se supprime pas : annulez-la (l''historique est conservé)'; end if;
  if tg_op = 'INSERT' then
    -- the line must exist in the SAME company and still be a free sales line
    execute format('select count(*) from %I.%I where id = $1 and product_id is null and line_type = %L', tg_table_schema, new.line_table, 'product') into n using new.line_id;
    if n = 0 then raise exception 'Correspondance refusée : ligne introuvable dans cette société, ou déjà rattachée à un produit'; end if;
    if new.status = 'cancelled' then raise exception 'Correspondance refusée : statut initial invalide'; end if;
    return new;
  end if;
  if new.line_table <> old.line_table or new.line_id <> old.line_id or new.product_id <> old.product_id
     or new.source <> old.source or new.created_by is distinct from old.created_by or new.created_at <> old.created_at then
    raise exception 'Correspondance : pour la corriger, annulez-la puis créez-en une nouvelle';
  end if;
  if old.status = 'cancelled' then raise exception 'Correspondance annulée : elle ne peut plus être modifiée'; end if;
  if new.status = 'proposed' and old.status = 'validated' then raise exception 'Correspondance validée : annulez-la pour la corriger'; end if;
  return new;
end $$;

do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('drop trigger if exists historical_link_rules on %I.historical_line_links', s);
    execute format('create trigger historical_link_rules before insert or update or delete on %I.historical_line_links for each row execute function public.historical_link_rules()', s);
    execute format('drop trigger if exists audit_row on %I.historical_line_links', s);
    execute format('create trigger audit_row after insert or update or delete on %I.historical_line_links for each row execute function public.audit_row()', s);
  end loop;
end $$;

-- R1: emission / confirmation need every SALES line (comment lines excluded) to be a catalogue product
create or replace function public.document_rules()
returns trigger language plpgsql set search_path = public as $$
declare v_status text; n int; k text;
begin
  if tg_table_name = 'invoices' then
    -- R1: an invoice is emitted only when every line is a catalogue product (credit notes copy old lines)
    if old.status = 'draft' and new.status = 'sent' and coalesce(new.number, '') not like 'AVR-%' then
      execute format('select count(*) from %I.invoice_lines where invoice_id = $1 and product_id is null and line_type <> ''comment''', tg_table_schema) into n using old.id;
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
      execute format('select count(*) from %I.sales_order_lines where order_id = $1 and product_id is null and line_type <> ''comment''', tg_table_schema) into n using old.id;
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
