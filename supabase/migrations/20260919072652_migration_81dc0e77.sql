-- Create store_collections table
CREATE TABLE IF NOT EXISTS store_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_number TEXT UNIQUE NOT NULL,
  collection_date DATE NOT NULL,
  ordered_at TIMESTAMPTZ,
  ordered_by UUID REFERENCES auth.users(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create store_collection_items table (aggregated quantities)
CREATE TABLE IF NOT EXISTS store_collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES store_collections(id) ON DELETE CASCADE,
  item_id UUID REFERENCES store_items(id),
  item_number TEXT NOT NULL,
  item_name TEXT NOT NULL,
  size TEXT NOT NULL,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(collection_id, item_number, size)
);

-- Add collection_id to store_orders
ALTER TABLE store_orders 
  ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES store_collections(id);

-- Create index on collection_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_store_orders_collection_id ON store_orders(collection_id);
CREATE INDEX IF NOT EXISTS idx_store_collection_items_collection_id ON store_collection_items(collection_id);

-- Trigger to auto-generate collection_number
CREATE OR REPLACE FUNCTION generate_collection_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_part TEXT;
BEGIN
  -- Extract year from collection_date
  year_part := TO_CHAR(NEW.collection_date, 'YYYY');
  
  -- Get next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(collection_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM store_collections
  WHERE collection_number LIKE 'COL-' || year_part || '-%';
  
  -- Format: COL-YYYY-0001
  NEW.collection_number := 'COL-' || year_part || '-' || LPAD(next_num::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_collection_number
  BEFORE INSERT ON store_collections
  FOR EACH ROW
  WHEN (NEW.collection_number IS NULL OR NEW.collection_number = '')
  EXECUTE FUNCTION generate_collection_number();

COMMENT ON TABLE store_collections IS 'Collection periods (1st and 15th of month)';
COMMENT ON TABLE store_collection_items IS 'Aggregated items per collection';
COMMENT ON COLUMN store_collections.collection_number IS 'Auto-generated: COL-YYYY-0001';
COMMENT ON COLUMN store_collections.collection_date IS 'Date of collection (1st or 15th)';
COMMENT ON COLUMN store_collections.status IS 'draft = created, ordered = sent to supplier, received = items received';