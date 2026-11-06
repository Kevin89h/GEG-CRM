-- Decisions F1 and F3 of 06/11/2026 (RAPPORT_ROLES_UTILISATEURS_TEST.md).
-- Requires 20261106120000_permissions_e1_e5.sql.
-- Rollback: supabase/rollback/20261107120000_permissions_f1_f3_rollback.sql
-- No business row is modified.

begin;

-- F3: a cancelled quote is entirely frozen (no exception, unlike the invoiced quote); its lines too.
-- F1: unchanged rules for invoices; quotes rules extended. Full function re-declared for clarity.
create or replace function public.document_rules()
returns trigger language plpgsql set search_path = public as $$
declare v_status text; n int; k text;
begin
  if tg_table_name = 'invoices' then
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

-- F1: the detailed costs of an opportunity are readable (direct access) only with
-- "voir coûts et marge" or "saisir les coûts"; writing them already needs "saisir les coûts".
do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    if to_regclass(format('%I.deal_costs', s)) is not null then
      execute format('drop policy if exists perm_select on %I.deal_costs', s);
      execute format('create policy perm_select on %1$I.deal_costs as restrictive for select to authenticated using ((select public.has_any_permission(array[''opportunites.couts_voir'', ''opportunites.couts_modifier''], %1$L)))', s);
    end if;
  end loop;
end $$;

-- F1, E4, E5: sensitive columns are never WRITTEN through a user session either (direct access);
-- the CRM server (service role) writes them after checking the permission of the user.
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
      execute format('revoke insert, update on %I.%I from authenticated', s, t.tbl);
      execute format('grant insert (%1$s), update (%1$s) on %2$I.%3$I to authenticated', cols, s, t.tbl);
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
