-- Create store_categories table for dynamic category management
CREATE TABLE IF NOT EXISTS store_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_store_categories_active ON store_categories(is_active);
CREATE INDEX idx_store_categories_order ON store_categories(display_order);

COMMENT ON TABLE store_categories IS 'Kategorije artiklov (nastavljive)';
COMMENT ON COLUMN store_categories.display_order IS 'Vrstni red prikaza (0 = prva)';

-- Insert default categories
INSERT INTO store_categories (name, description, display_order) VALUES
  ('Dresi', 'Klubski dresi in majice', 1),
  ('Kopački', 'Športna obutev', 2),
  ('Oprema', 'Ostala športna oprema', 3),
  ('Drugo', 'Ostalo', 4)
ON CONFLICT (name) DO NOTHING;