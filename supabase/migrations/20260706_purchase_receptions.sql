-- Bons de réception liés aux bons de commande
CREATE TABLE IF NOT EXISTS purchase_receptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL,
  number          text NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  notes           text,
  user_id         uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_reception_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reception_id    uuid NOT NULL REFERENCES purchase_receptions(id) ON DELETE CASCADE,
  order_line_id   uuid,
  product_id      uuid,
  description     text NOT NULL,
  quantity        numeric NOT NULL,
  unit_price      numeric NOT NULL DEFAULT 0,
  warehouse_id    uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Lien facultatif entre facture fournisseur et bon de commande
ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS purchase_order_id uuid,
  ADD COLUMN IF NOT EXISTS reception_id      uuid;
