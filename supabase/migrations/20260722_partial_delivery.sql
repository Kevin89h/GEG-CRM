-- Quantité déjà livrée par ligne de commande
ALTER TABLE geg_guinee.sales_order_lines
  ADD COLUMN IF NOT EXISTS qty_delivered numeric(14,3) NOT NULL DEFAULT 0;

-- Lier les bons de livraison à une commande (sales_order)
ALTER TABLE geg_guinee.delivery_notes
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES geg_guinee.sales_orders(id) ON DELETE SET NULL;

-- Lignes du bon de livraison avec référence à la ligne de commande
ALTER TABLE geg_guinee.delivery_note_lines
  ADD COLUMN IF NOT EXISTS order_line_id uuid REFERENCES geg_guinee.sales_order_lines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qty_delivered numeric(14,3);

-- Index
CREATE INDEX IF NOT EXISTS idx_delivery_notes_order_id ON geg_guinee.delivery_notes(order_id);
