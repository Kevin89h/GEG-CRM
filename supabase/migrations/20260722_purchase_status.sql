-- Quantité reçue par ligne de commande achat (suivi réception partielle)
ALTER TABLE geg_guinee.purchase_order_lines
  ADD COLUMN IF NOT EXISTS qty_received numeric(14,3) NOT NULL DEFAULT 0;

-- Nouveaux statuts supportés (colonne text, pas d'enum) :
--   draft | confirmed | ordered | in_transit | partial | received | cancelled

-- Table d'historique des événements par bon de commande
CREATE TABLE IF NOT EXISTS geg_guinee.purchase_order_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES geg_guinee.purchase_orders(id) ON DELETE CASCADE,
  event_type  text NOT NULL, -- 'status_change' | 'reception' | 'note'
  payload     jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  user_id     uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_po_events_order ON geg_guinee.purchase_order_events(order_id);
