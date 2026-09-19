-- RLS Policies: store_collections

ALTER TABLE store_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_collection_items ENABLE ROW LEVEL SECURITY;

-- Admin/Coach: Full access to collections
CREATE POLICY store_collections_admin_all ON store_collections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'coach')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'coach')
    )
  );

CREATE POLICY store_collection_items_admin_all ON store_collection_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'coach')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'coach')
    )
  );

-- Parents: No access to collections (internal admin feature)

COMMENT ON POLICY store_collections_admin_all ON store_collections IS 'Admin/Coach can manage collections';
COMMENT ON POLICY store_collection_items_admin_all ON store_collection_items IS 'Admin/Coach can view collection items';