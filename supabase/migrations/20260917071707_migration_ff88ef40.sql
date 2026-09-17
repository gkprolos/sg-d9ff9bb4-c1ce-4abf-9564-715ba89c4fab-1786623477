-- RLS Policies: store_collection_periods

ALTER TABLE store_collection_periods ENABLE ROW LEVEL SECURITY;

-- Admin & Coach: CRUD
DROP POLICY IF EXISTS store_collection_periods_admin_all ON store_collection_periods;
CREATE POLICY store_collection_periods_admin_all ON store_collection_periods
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
    )
  );

-- Parents: READ only
DROP POLICY IF EXISTS store_collection_periods_parent_read ON store_collection_periods;
CREATE POLICY store_collection_periods_parent_read ON store_collection_periods
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'parent'
    )
  );

COMMENT ON POLICY store_collection_periods_admin_all ON store_collection_periods IS 'Admin/Coach can CRUD collection periods';