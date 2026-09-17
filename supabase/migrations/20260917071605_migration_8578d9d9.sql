-- RLS Policies: store_items

ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;

-- Admin & Coach: CRUD
DROP POLICY IF EXISTS store_items_admin_all ON store_items;
CREATE POLICY store_items_admin_all ON store_items
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
    )
  );

-- Parents: READ only active items
DROP POLICY IF EXISTS store_items_parent_read ON store_items;
CREATE POLICY store_items_parent_read ON store_items
  FOR SELECT
  USING (
    is_active = true
    AND auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'parent'
    )
  );

COMMENT ON POLICY store_items_admin_all ON store_items IS 'Admin/Coach can CRUD all items';
COMMENT ON POLICY store_items_parent_read ON store_items IS 'Parents can read only active items';