-- Migration: ajout des colonnes Odoo-style sur la table products
-- À exécuter dans Supabase > SQL Editor

ALTER TABLE geg_guinee.products
  ADD COLUMN IF NOT EXISTS can_be_sold       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_be_purchased   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_type       text    NOT NULL DEFAULT 'storable'
    CHECK (product_type IN ('consumable', 'service', 'storable')),
  ADD COLUMN IF NOT EXISTS barcode            text,
  ADD COLUMN IF NOT EXISTS tva_vente          numeric(5,2) DEFAULT 18,
  ADD COLUMN IF NOT EXISTS tva_achat          numeric(5,2) DEFAULT 18;

COMMENT ON COLUMN geg_guinee.products.product_type IS 'consumable | service | storable';
