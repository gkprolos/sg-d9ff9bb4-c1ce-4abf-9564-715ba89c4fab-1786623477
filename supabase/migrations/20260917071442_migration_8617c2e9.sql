-- Table 3: store_order_items (Postavke naročil)
CREATE TABLE IF NOT EXISTS store_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES store_items(id),
  item_name VARCHAR(200) NOT NULL, -- Snapshot
  item_number VARCHAR(50) NOT NULL, -- Snapshot
  size VARCHAR(10) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_order_items_order ON store_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_store_order_items_item ON store_order_items(item_id);

COMMENT ON TABLE store_order_items IS 'Postavke naročil (snapshot cen in nazivov)';