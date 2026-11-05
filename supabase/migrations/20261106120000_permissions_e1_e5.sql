-- Decisions E1 to E5 and anomaly A4 of 05/11/2026 (RAPPORT_ROLES_UTILISATEURS_TEST.md).
-- Requires 20261105120000_permissions_personnalisables.sql.
-- Rollback: supabase/rollback/20261106120000_permissions_e1_e5_rollback.sql
-- No business row is modified: one permission, one column, rules, column privileges and audit triggers are added.

begin;

-- E4: salaries need their own permission (Super admin and Admin by default; exception possible per company)
insert into public.permission_catalog (key, module, label, sort, sensitive, customizable, grantable_to_sales_rep)
values ('employes.salaires', 'Équipe', 'Employés : consulter les salaires', 603, true, true, true)
on conflict (key) do update set label = excluded.label, module = excluded.module, sort = excluded.sort, sensitive = excluded.sensitive;
insert into public.role_permissions (role, permission_key) values ('super_admin', 'employes.salaires'), ('admin', 'employes.salaires')
on conflict do nothing;

-- E2: internal notes of an invoice, separate from the notes printed on the PDF ("notes")
do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('alter table %I.invoices add column if not exists internal_notes text', s);
  end loop;
end $$;

-- E1 (invoiced quote) and E2 (printed notes of an emitted invoice), added to the document rules
create or replace function public.document_rules()
returns trigger language plpgsql set search_path = public as $$
declare v_status text; n int; k text;
begin
  if tg_table_name = 'invoices' then
    if old.status is distinct from 'draft' then
      if new.status = 'draft' then raise exception 'Facture émise : elle ne peut pas revenir en brouillon (corriger par un avoir)'; end if;
      if new.status = 'cancelled' and old.status <> 'cancelled' then raise exception 'Facture émise : elle ne peut pas être annulée (corriger par un avoir)'; end if;
      if old.status = 'cancelled' and new.status <> 'cancelled' then raise exception 'Facture annulée : son statut ne peut plus changer'; end if;
      -- E2: the printed notes are part of the emitted document; internal_notes stay editable
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
    if new.status is distinct from old.status then
      execute format('select count(*) from %I.invoices where order_id = $1 and status <> ''cancelled''', tg_table_schema) into n using old.id;
      if old.status = 'invoiced' and n > 0 then raise exception 'Devis facturé : son statut ne peut plus changer'; end if;
      if new.status = 'cancelled' and n > 0 then raise exception 'Ce devis a une facture : il ne peut pas être annulé'; end if;
    end if;
    -- E1: an invoiced quote is frozen, except its project (project_code) and technical timestamps
    if old.status = 'invoiced' then
      for k in select jsonb_object_keys(to_jsonb(new)) loop
        if k not in ('project_code', 'updated_at') and (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
          raise exception 'Devis facturé : seul le projet reste modifiable (champ refusé : %)', k;
        end if;
      end loop;
    end if;
    return new;

  elsif tg_table_name = 'sales_order_lines' then
    -- E1: lines of an invoiced quote are frozen; only the delivered quantity follows the deliveries
    execute format('select status from %I.sales_orders where id = $1', tg_table_schema) into v_status
      using case when tg_op = 'DELETE' then old.order_id else new.order_id end;
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

do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format('drop trigger if exists document_rules on %I.sales_order_lines', s);
    execute format('create trigger document_rules before insert or update or delete on %I.sales_order_lines for each row execute function public.document_rules()', s);
    -- A4: internal notes of purchase orders are recorded in purchase_order_events: audit them too
    if to_regclass(format('%I.purchase_order_events', s)) is not null then
      execute format('drop trigger if exists audit_row on %I.purchase_order_events', s);
      execute format('create trigger audit_row after insert or update or delete on %I.purchase_order_events for each row execute function public.audit_row()', s);
    end if;
  end loop;
end $$;

-- E4 and E5: sensitive columns are never readable through a user session (direct access to the database).
-- The CRM server (service role) reads them and sends them only to users holding the permission.
do $$
declare s text; t record; cols text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    for t in select * from (values
      ('employees', array['salary', 'salary_currency']),
      ('deals', array['cost']),
      ('products', array['buy_price', 'buy_price_currency', 'sku', 'internal_notes'])
    ) as x(tbl, hidden) loop
      if to_regclass(format('%I.%I', s, t.tbl)) is null then continue; end if;
      select string_agg(quote_ident(column_name), ', ') into cols
      from information_schema.columns
      where table_schema = s and table_name = t.tbl and column_name <> all (t.hidden);
      execute format('revoke select on %I.%I from authenticated', s, t.tbl);
      execute format('grant select (%s) on %I.%I to authenticated', cols, s, t.tbl);
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
