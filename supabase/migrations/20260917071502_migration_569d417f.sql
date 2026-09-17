-- Table 4: store_collection_periods (Zbirniki 1. in 15. v mesecu)
CREATE TABLE IF NOT EXISTS store_collection_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_date DATE NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  ordered_at TIMESTAMPTZ,
  ordered_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_collection_status CHECK (status IN ('open', 'ordered', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_store_collection_periods_date ON store_collection_periods(period_date);
CREATE INDEX IF NOT EXISTS idx_store_collection_periods_status ON store_collection_periods(status);

COMMENT ON TABLE store_collection_periods IS 'Zbirniki naročil (1. in 15. dan v mesecu)';