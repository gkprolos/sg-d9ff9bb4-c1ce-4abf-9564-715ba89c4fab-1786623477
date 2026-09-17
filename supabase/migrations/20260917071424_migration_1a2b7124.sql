-- Table 2: store_orders (Naročila staršev)
CREATE TABLE IF NOT EXISTS store_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE, -- ORD-2026-0001 (auto-generated)
  parent_id UUID NOT NULL REFERENCES auth.users(id),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  ordered_at TIMESTAMPTZ, -- Kdaj naročeno dobavitelju
  ordered_by UUID REFERENCES auth.users(id),
  delivered_at TIMESTAMPTZ, -- Kdaj predano staršu
  delivered_by UUID REFERENCES auth.users(id),
  invoiced_at TIMESTAMPTZ, -- Kdaj izdelan račun
  invoiced_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('open', 'ordered', 'delivered', 'invoiced', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_store_orders_parent ON store_orders(parent_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_status ON store_orders(status);
CREATE INDEX IF NOT EXISTS idx_store_orders_created ON store_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_store_orders_number ON store_orders(order_number);

COMMENT ON TABLE store_orders IS 'Naročila staršev za opremo';
COMMENT ON COLUMN store_orders.status IS 'open, ordered, delivered, invoiced, cancelled';