-- RLS Policies: store_orders

ALTER TABLE store_orders ENABLE ROW LEVEL SECURITY;

-- Admin & Coach: READ all
DROP POLICY IF EXISTS store_orders_admin_read ON store_orders;
CREATE POLICY store_orders_admin_read ON store_orders
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
    )
  );

-- Admin & Coach: UPDATE (status changes)
DROP POLICY IF EXISTS store_orders_admin_update ON store_orders;
CREATE POLICY store_orders_admin_update ON store_orders
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
    )
  );

-- Parents: CREATE own orders
DROP POLICY IF EXISTS store_orders_parent_insert ON store_orders;
CREATE POLICY store_orders_parent_insert ON store_orders
  FOR INSERT
  WITH CHECK (
    parent_id = auth.uid()
    AND auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'parent'
    )
  );

-- Parents: READ own orders
DROP POLICY IF EXISTS store_orders_parent_read ON store_orders;
CREATE POLICY store_orders_parent_read ON store_orders
  FOR SELECT
  USING (
    parent_id = auth.uid()
    AND auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'parent'
    )
  );

-- Parents: UPDATE own open orders only (for cancellation)
DROP POLICY IF EXISTS store_orders_parent_update ON store_orders;
CREATE POLICY store_orders_parent_update ON store_orders
  FOR UPDATE
  USING (
    parent_id = auth.uid()
    AND status = 'open'
    AND auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'parent'
    )
  );

COMMENT ON POLICY store_orders_admin_read ON store_orders IS 'Admin/Coach can read all orders';
COMMENT ON POLICY store_orders_parent_read ON store_orders IS 'Parents can read only their own orders';