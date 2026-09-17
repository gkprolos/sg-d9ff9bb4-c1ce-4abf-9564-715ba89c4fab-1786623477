-- FAZA 1: PODATKOVNA OSNOVA - STORE MODULE
-- Migration: Create store tables with inventory tracking and categories

-- Table 1: store_items (Artikli z zalogo in kategorijami)
CREATE TABLE IF NOT EXISTS store_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_number VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- "Dresi", "Kopački", "Oprema"
  available_sizes JSONB NOT NULL DEFAULT '[]', -- ["S", "M", "L", "XL"]
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  quantity_in_stock INTEGER NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
  low_stock_threshold INTEGER DEFAULT 5,
  image_url TEXT,
  external_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_store_items_active ON store_items(is_active);
CREATE INDEX IF NOT EXISTS idx_store_items_number ON store_items(item_number);
CREATE INDEX IF NOT EXISTS idx_store_items_category ON store_items(category);
CREATE INDEX IF NOT EXISTS idx_store_items_name ON store_items(name);

COMMENT ON TABLE store_items IS 'Artikli za naročanje opreme';
COMMENT ON COLUMN store_items.category IS 'Kategorija: Dresi, Kopački, Oprema...';
COMMENT ON COLUMN store_items.quantity_in_stock IS 'Trenutna zaloga';
COMMENT ON COLUMN store_items.low_stock_threshold IS 'Opozorilo pri nizki zalogi';