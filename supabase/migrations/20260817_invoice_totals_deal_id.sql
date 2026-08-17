-- Add deal_id to invoice_totals view
DROP VIEW geg_guinee.invoice_totals;
CREATE VIEW geg_guinee.invoice_totals AS
 SELECT i.id,
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
