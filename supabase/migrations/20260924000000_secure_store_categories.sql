-- ============================================================================
-- ENABLE RLS ON store_categories
-- ============================================================================
-- Purpose: Prevent direct public write access to store_categories
-- Safe: Preserves existing public read access needed by parents

-- Enable Row Level Security
ALTER TABLE store_categories ENABLE ROW LEVEL SECURITY;

-- Public read policy (already exists, kept for clarity)
-- Parents need to see categories in store for filtering
DROP POLICY IF EXISTS "store_categories_read" ON store_categories;
CREATE POLICY "store_categories_read" 
ON store_categories FOR SELECT 
USING (true);

-- Admin write policy (INSERT, UPDATE, DELETE)
CREATE POLICY "store_categories_admin_write" 
ON store_categories FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Verification query
DO $$ 
BEGIN
  -- Check RLS is enabled
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'store_categories') THEN
    RAISE EXCEPTION 'RLS not enabled on store_categories';
  END IF;
  
  -- Check policies exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'store_categories' AND policyname = 'store_categories_read') THEN
    RAISE EXCEPTION 'Public read policy missing';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'store_categories' AND policyname = 'store_categories_admin_write') THEN
    RAISE EXCEPTION 'Admin write policy missing';
  END IF;
  
  RAISE NOTICE 'Success: store_categories RLS enabled with public read + admin write';
END $$;