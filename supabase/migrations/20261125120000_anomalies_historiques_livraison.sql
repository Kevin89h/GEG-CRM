-- Registre des anomalies historiques de livraison (décision GEG du 24/11/2026, point 1).
-- DEV UNIQUEMENT tant que GEG n'a pas autorisé la production.
--
-- Le contrôle M4 (achat avant vente) compte les anciennes factures RÉELLEMENT en attente de livraison.
-- Une ligne de facture historique dont la marchandise est en fait partie sans BL (anomalie du passé, point D-24)
-- n'est retirée de ce calcul QUE si GEG l'a inscrite dans ce registre, après confirmation des équipes.
-- Son statut de livraison n'est PAS modifié (aucun BL fictif, aucun statut forcé) : elle reste visible « à livrer »
-- tant qu'elle n'est pas régularisée. Aucune ligne n'est inscrite par cette migration.
begin;

do $$
declare s text;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    execute format($t$
      create table if not exists %1$I.delivery_history_anomalies (
        invoice_line_id uuid primary key references %1$I.invoice_lines(id) on delete cascade,
        motif text not null check (btrim(motif) <> ''),
        validated_by uuid not null references auth.users(id),
        validated_at timestamptz not null default now(),
        source text
      )$t$, s);
    execute format('alter table %I.delivery_history_anomalies enable row level security', s);
    execute format('revoke all on %I.delivery_history_anomalies from anon, authenticated', s);
    execute format('grant select, insert, update, delete on %I.delivery_history_anomalies to service_role', s);
    if exists (select 1 from pg_proc where proname = 'audit_row') then
      execute format('drop trigger if exists audit_row on %I.delivery_history_anomalies', s);
      execute format('create trigger audit_row after insert or update or delete on %I.delivery_history_anomalies for each row execute function public.audit_row()', s);
    end if;

    -- M4 : les lignes inscrites au registre ne comptent plus dans « déjà facturé non livré »
    execute format($f$
      create or replace function %1$I.controle_achat_vente(p_invoice uuid) returns jsonb
      language sql stable set search_path = %1$I, public as $b$
        with need as (
          select x.product_id, sum(x.quantity) as q from invoice_line_delivery x where x.invoice_id = p_invoice and x.product_id is not null group by 1
        ), stock as (
          select product_id, sum(quantity) as s from stock_levels where product_id in (select product_id from need) group by 1
        ), po as (
          select l.product_id, sum(greatest(l.quantity - greatest(coalesce(l.qty_received, 0), coalesce(r.q, 0)), 0)) as p
          from purchase_order_lines l join purchase_orders o on o.id = l.order_id
          left join (select order_line_id, sum(quantity) as q from purchase_reception_lines group by 1) r on r.order_line_id = l.id
          where o.status in ('confirmed', 'ordered', 'in_transit', 'partial') and l.product_id in (select product_id from need) group by 1
        ), other as (
          select x.product_id, sum(x.remaining) as o from invoice_line_delivery x join invoices i on i.id = x.invoice_id
          where i.status in ('sent', 'partial', 'paid') and i.id <> p_invoice and coalesce(i.number, '') not like 'AVR-%%'
            and x.product_id in (select product_id from need)
            and not exists (select 1 from delivery_history_anomalies a where a.invoice_line_id = x.invoice_line_id)
          group by 1
        )
        select coalesce(jsonb_agg(jsonb_build_object('product_id', n.product_id, 'product', geg_libelle_produit(n.product_id), 'invoiced', n.q,
                 'stock', coalesce(s.s, 0), 'purchased_not_received', coalesce(p.p, 0), 'invoiced_not_delivered', coalesce(o.o, 0),
                 'missing', n.q - (coalesce(s.s, 0) + coalesce(p.p, 0) - coalesce(o.o, 0)))), '[]'::jsonb)
        from need n left join stock s on s.product_id = n.product_id left join po p on p.product_id = n.product_id left join other o on o.product_id = n.product_id
        where coalesce(s.s, 0) + coalesce(p.p, 0) - coalesce(o.o, 0) < n.q
      $b$ $f$, s);
    execute format('revoke all on function %I.controle_achat_vente(uuid) from public, anon, authenticated', s);
    execute format('grant execute on function %I.controle_achat_vente(uuid) to service_role', s);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
