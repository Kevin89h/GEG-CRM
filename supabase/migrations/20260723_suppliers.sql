-- Table fournisseurs
CREATE TABLE IF NOT EXISTS geg_guinee.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  country text,
  city text,
  address text,
  payment_terms text, -- '30j', '60j', 'immediate', etc.
  currency text DEFAULT 'USD',
  iban text,
  swift text,
  bank_name text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON geg_guinee.suppliers(name);

-- Ajouter supplier_id sur purchase_orders (garde supplier_name pour compatibilité)
ALTER TABLE geg_guinee.purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES geg_guinee.suppliers(id) ON DELETE SET NULL;

-- Ajouter supplier_id sur supplier_invoices
ALTER TABLE geg_guinee.supplier_invoices
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES geg_guinee.suppliers(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE geg_guinee.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_select" ON geg_guinee.suppliers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_insert" ON geg_guinee.suppliers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_update" ON geg_guinee.suppliers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_delete" ON geg_guinee.suppliers FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
);

-- Migrer les supplier_name existants de purchase_orders vers la table suppliers
INSERT INTO geg_guinee.suppliers (name)
SELECT DISTINCT supplier_name
FROM geg_guinee.purchase_orders
WHERE supplier_name IS NOT NULL AND supplier_name <> ''
ON CONFLICT DO NOTHING;

-- Migrer les supplier_name existants de supplier_invoices
INSERT INTO geg_guinee.suppliers (name)
SELECT DISTINCT supplier_name
FROM geg_guinee.supplier_invoices
WHERE supplier_name IS NOT NULL AND supplier_name <> ''
ON CONFLICT DO NOTHING;

-- Mettre à jour supplier_id sur purchase_orders
UPDATE geg_guinee.purchase_orders po
SET supplier_id = s.id
FROM geg_guinee.suppliers s
WHERE po.supplier_name = s.name AND po.supplier_id IS NULL;

-- Mettre à jour supplier_id sur supplier_invoices
UPDATE geg_guinee.supplier_invoices si
SET supplier_id = s.id
FROM geg_guinee.suppliers s
WHERE si.supplier_name = s.name AND si.supplier_id IS NULL;
