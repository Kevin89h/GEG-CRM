-- Retour arrière de 20261117120000_paiements_fournisseurs_multidevises (D-09, D-10, D-12).
-- Remet les vues d'origine (paiements additionnés sans conversion), la fonction d'annulation d'origine, et retire la
-- colonne exchange_rate de Singapour SEULEMENT si aucun paiement ne l'utilise. Aucune donnée métier n'est modifiée.
begin;

create or replace view geg_guinee.supplier_invoice_totals with (security_invoker = true) as
select si.id, si.number, si.supplier_name, si.status, si.currency, si.total_ht, si.total_ttc, si.invoice_date, si.due_date,
       coalesce(sum(sp.amount), 0::numeric) as total_paid,
       si.total_ttc - coalesce(sum(sp.amount), 0::numeric) as balance
from geg_guinee.supplier_invoices si
left join geg_guinee.supplier_payments sp on sp.supplier_invoice_id = si.id
group by si.id;

create or replace view geg_singapore.supplier_invoice_totals with (security_invoker = true) as
select si.id, si.number, si.supplier_name, si.status, si.currency, si.total_ht, si.total_ttc, si.invoice_date, si.due_date,
       coalesce(sum(sp.amount), 0::numeric) as total_paid,
       si.total_ttc - coalesce(sum(sp.amount), 0::numeric) as balance
from geg_singapore.supplier_invoices si
left join geg_singapore.supplier_payments sp on sp.supplier_invoice_id = si.id
group by si.id;

create or replace function public.delete_payment_safe(p_schema text, p_kind text, p_payment_id uuid, p_invoice_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  pay jsonb; tx jsonb; v_tx_id uuid; n_linked int; n_candidates int; n_rivals int;
  v_table text; v_fk text; v_link text; v_type text; v_category text; v_inv_table text;
  v_paid numeric; v_total numeric; v_status text; v_new_status text;
begin
  if p_schema not in ('geg_guinee', 'geg_singapore') then raise exception 'Société inconnue'; end if;
  if p_kind = 'client' then
    v_table := 'payments'; v_fk := 'invoice_id'; v_link := 'payment_id'; v_type := 'credit'; v_category := 'invoice_payment'; v_inv_table := 'invoices';
  elsif p_kind = 'fournisseur' then
    v_table := 'supplier_payments'; v_fk := 'supplier_invoice_id'; v_link := 'supplier_payment_id'; v_type := 'debit'; v_category := 'supplier_payment'; v_inv_table := 'supplier_invoices';
  else raise exception 'Type de paiement inconnu'; end if;

  execute format('select to_jsonb(p) from %I.%I p where id = $1 and %I = $2 for update', p_schema, v_table, v_fk)
    into pay using p_payment_id, p_invoice_id;
  if pay is null then raise exception 'Paiement introuvable pour cette facture'; end if;

  -- 1. Explicit link
  execute format('select count(*) from %I.treasury_transactions where %I = $1', p_schema, v_link) into n_linked using p_payment_id;
  if n_linked > 1 then raise exception 'Suppression refusée : plusieurs opérations de trésorerie sont liées à ce paiement'; end if;
  if n_linked = 1 then
    execute format('select to_jsonb(t) from %I.treasury_transactions t where %I = $1 for update', p_schema, v_link) into tx using p_payment_id;
    if (tx ->> 'account_id') is distinct from (pay ->> 'treasury_account_id')
       or (tx ->> 'amount')::numeric <> (pay ->> 'amount')::numeric
       or tx ->> 'type' <> v_type
       or (tx ->> 'payment_id' is not null and tx ->> 'supplier_payment_id' is not null) then
      raise exception 'Suppression refusée : l''opération de trésorerie liée ne correspond pas au paiement';
    end if;
  elsif pay ->> 'treasury_account_id' is not null then
    -- 2. Legacy payment: strict single match, no rival payment
    execute format(
      'select count(*) from %I.treasury_transactions t
        where t.account_id = $1 and t.amount = $2 and coalesce(t.currency, '''') = coalesce($3, '''')
          and (t.date at time zone ''UTC'')::date = ($4 at time zone ''UTC'')::date and t.type = $5 and t.category = $6
          and t.payment_id is null and t.supplier_payment_id is null', p_schema)
      into n_candidates using (pay ->> 'treasury_account_id')::uuid, (pay ->> 'amount')::numeric, pay ->> 'currency',
                              (pay ->> 'paid_at')::timestamptz, v_type, v_category;
    execute format(
      'select (select count(*) from %1$I.payments where treasury_account_id = $1 and amount = $2 and coalesce(currency, '''') = coalesce($3, '''') and (paid_at at time zone ''UTC'')::date = ($4 at time zone ''UTC'')::date)
            + (select count(*) from %1$I.supplier_payments where treasury_account_id = $1 and amount = $2 and coalesce(currency, '''') = coalesce($3, '''') and (paid_at at time zone ''UTC'')::date = ($4 at time zone ''UTC'')::date)', p_schema)
      into n_rivals using (pay ->> 'treasury_account_id')::uuid, (pay ->> 'amount')::numeric, pay ->> 'currency', (pay ->> 'paid_at')::timestamptz;
    if n_candidates <> 1 then
      raise exception 'Suppression refusée : impossible d''identifier avec certitude l''opération de trésorerie de ce paiement (% correspondance(s))', n_candidates;
    end if;
    if n_rivals <> 1 then
      raise exception 'Suppression refusée : un autre paiement du même montant, sur le même compte et à la même date existe (% paiements)', n_rivals;
    end if;
    execute format(
      'select to_jsonb(t) from %I.treasury_transactions t
        where t.account_id = $1 and t.amount = $2 and coalesce(t.currency, '''') = coalesce($3, '''')
          and (t.date at time zone ''UTC'')::date = ($4 at time zone ''UTC'')::date and t.type = $5 and t.category = $6
          and t.payment_id is null and t.supplier_payment_id is null for update', p_schema)
      into tx using (pay ->> 'treasury_account_id')::uuid, (pay ->> 'amount')::numeric, pay ->> 'currency',
                    (pay ->> 'paid_at')::timestamptz, v_type, v_category;
  end if;

  v_tx_id := (tx ->> 'id')::uuid;
  perform set_config('geg.payment_correction', 'on', true);
  if v_tx_id is not null then
    execute format('delete from %I.treasury_transactions where id = $1', p_schema) using v_tx_id;
  end if;
  execute format('delete from %I.%I where id = $1', p_schema, v_table) using p_payment_id;

  -- Invoice status from what remains paid
  if p_kind = 'client' then
    execute format('select coalesce(sum(coalesce(amount_in_invoice_currency, amount)), 0) from %I.payments where invoice_id = $1', p_schema) into v_paid using p_invoice_id;
    execute format('select total_ttc, status from %I.invoice_totals where id = $1', p_schema) into v_total, v_status using p_invoice_id;
    v_new_status := case when v_paid <= 0 then 'sent' when v_total is not null and v_paid >= v_total - 0.005 then 'paid' else 'partial' end;
    if v_status in ('sent', 'partial', 'paid') and v_new_status <> v_status then
      execute format('update %I.invoices set status = $1 where id = $2', p_schema) using v_new_status, p_invoice_id;
    end if;
  else
    execute format('select coalesce(sum(case when sp.currency is not null and sp.currency <> coalesce(si.currency, ''GNF'') and sp.exchange_rate is not null and sp.exchange_rate <> 0 then sp.amount / sp.exchange_rate else sp.amount end), 0)
                     from %1$I.supplier_payments sp, %1$I.supplier_invoices si where sp.supplier_invoice_id = $1 and si.id = $1', p_schema)
      into v_paid using p_invoice_id;
    execute format('select total_ttc, status from %I.supplier_invoices where id = $1', p_schema) into v_total, v_status using p_invoice_id;
    v_new_status := case when v_total is not null and v_paid >= v_total - 0.005 then 'paid' when v_paid > 0 then 'partial' else 'pending' end;
    if v_status in ('pending', 'partial', 'paid') and v_new_status <> v_status then
      execute format('update %I.supplier_invoices set status = $1 where id = $2', p_schema) using v_new_status, p_invoice_id;
    end if;
  end if;

  perform public.audit_write(p_schema, 'comptabilite', 'paiement.suppression_correction', v_table, p_payment_id::text,
    pay ->> 'reference', jsonb_build_object('paiement', pay, 'operation_tresorerie', tx), jsonb_build_object('statut_facture', v_new_status));
  perform set_config('geg.payment_correction', 'off', true);
  return jsonb_build_object('ok', true, 'treasury_transaction_id', v_tx_id, 'invoice_status', v_new_status);
end $function$;

do $$ begin
  if exists (select 1 from geg_singapore.supplier_payments where exchange_rate is not null) then
    raise notice 'Colonne geg_singapore.supplier_payments.exchange_rate conservée : des paiements l''utilisent';
  else
    alter table geg_singapore.supplier_payments drop column if exists exchange_rate;
  end if;
end $$;

do $ begin
  if exists (select 1 from geg_singapore.exchange_rates where notes is not null) then
    raise notice 'Colonne geg_singapore.exchange_rates.notes conservée : des taux l''utilisent';
  else
    alter table geg_singapore.exchange_rates drop column if exists notes;
  end if;
end $;

drop function if exists public.currency_decimals(text);

notify pgrst, 'reload schema';

commit;
