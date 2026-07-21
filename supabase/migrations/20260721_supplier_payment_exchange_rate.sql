-- Add exchange_rate column to supplier_payments for cross-currency payments
ALTER TABLE geg_guinee.supplier_payments
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(18, 6) DEFAULT NULL;
