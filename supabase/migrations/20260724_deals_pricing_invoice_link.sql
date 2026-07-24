-- Prix vente et coût sur deals
ALTER TABLE geg_guinee.deals
  ADD COLUMN IF NOT EXISTS selling_price numeric(18,2),
  ADD COLUMN IF NOT EXISTS cost numeric(18,2);

-- Lien deal → facture
ALTER TABLE geg_guinee.invoices
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES geg_guinee.deals(id) ON DELETE SET NULL;

-- Index pour perf
CREATE INDEX IF NOT EXISTS idx_invoices_deal_id ON geg_guinee.invoices(deal_id);
