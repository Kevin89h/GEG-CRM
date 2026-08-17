-- Add deal_id to supplier_invoices
ALTER TABLE geg_guinee.supplier_invoices
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES geg_guinee.deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_deal_id ON geg_guinee.supplier_invoices(deal_id);

-- Manual cost entries per deal (commission, transport, achat, autre)
CREATE TABLE IF NOT EXISTS geg_guinee.deal_costs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES geg_guinee.deals(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('commission', 'transport', 'achat', 'autre')),
  label       text,
  amount      numeric(18,2) NOT NULL DEFAULT 0,
  currency    text NOT NULL DEFAULT 'GNF',
  paid        boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_costs_deal_id ON geg_guinee.deal_costs(deal_id);

ALTER TABLE geg_guinee.deal_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage deal_costs"
  ON geg_guinee.deal_costs FOR ALL
  USING (true) WITH CHECK (true);
