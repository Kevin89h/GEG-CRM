-- Table fournisseurs pour geg_singapore (miroir de geg_guinee.suppliers)
CREATE TABLE IF NOT EXISTS geg_singapore.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  country text,
  city text,
  address text,
  payment_terms text,
  currency text DEFAULT 'USD',
  iban text,
  swift text,
  bank_name text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_singapore_suppliers_name ON geg_singapore.suppliers(name);

ALTER TABLE geg_singapore.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_select" ON geg_singapore.suppliers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_insert" ON geg_singapore.suppliers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_update" ON geg_singapore.suppliers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_delete" ON geg_singapore.suppliers FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);
