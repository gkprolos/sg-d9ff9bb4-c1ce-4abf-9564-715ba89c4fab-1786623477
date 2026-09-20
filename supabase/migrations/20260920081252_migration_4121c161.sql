-- Drop existing parent read policy that requires Auth session
DROP POLICY IF EXISTS store_items_parent_read ON store_items;

-- Create new public read policy for active items (no Auth required)
CREATE POLICY store_items_public_read_active ON store_items
  FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);