-- Retour arrière de 20261125120000 : contrôle M4 sans le registre des anomalies historiques.
-- Le registre est conservé s'il contient des lignes (validations de GEG), supprimé s'il est vide.
begin;
do $do$
declare s text; n int;
begin
  foreach s in array array['geg_guinee', 'geg_singapore'] loop
    if to_regprocedure(format('%I.controle_achat_vente(uuid)', s)) is not null then
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
              and x.product_id in (select product_id from need) group by 1
          )
          select coalesce(jsonb_agg(jsonb_build_object('product_id', n.product_id, 'product', geg_libelle_produit(n.product_id), 'invoiced', n.q,
                   'stock', coalesce(s.s, 0), 'purchased_not_received', coalesce(p.p, 0), 'invoiced_not_delivered', coalesce(o.o, 0),
                   'missing', n.q - (coalesce(s.s, 0) + coalesce(p.p, 0) - coalesce(o.o, 0)))), '[]'::jsonb)
          from need n left join stock s on s.product_id = n.product_id left join po p on p.product_id = n.product_id left join other o on o.product_id = n.product_id
          where coalesce(s.s, 0) + coalesce(p.p, 0) - coalesce(o.o, 0) < n.q
        $b$ $f$, s);
      execute format('revoke all on function %I.controle_achat_vente(uuid) from public, anon, authenticated', s);
      execute format('grant execute on function %I.controle_achat_vente(uuid) to service_role', s);
    end if;
    if to_regclass(format('%I.delivery_history_anomalies', s)) is not null then
      execute format('select count(*) from %I.delivery_history_anomalies', s) into n;
      if n = 0 then execute format('drop table %I.delivery_history_anomalies', s);
      else raise notice '% : registre conservé (% ligne(s) validée(s) par GEG)', s, n; end if;
    end if;
  end loop;
end $do$;
notify pgrst, 'reload schema';
commit;
