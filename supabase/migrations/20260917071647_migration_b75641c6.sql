-- RLS Policies: store_order_items

ALTER TABLE store_order_items ENABLE ROW LEVEL SECURITY;

-- Admin & Coach: READ all
DROP POLICY IF EXISTS store_order_items_admin_read ON store_order_items;
CREATE POLICY store_order_items_admin_read ON store_order_items
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
    )
  );

-- Parents: CRUD own order items (via order ownership)
DROP POLICY IF EXISTS store_order_items_parent_all ON store_order_items;
CREATE POLICY store_order_items_parent_all ON store_order_items
  FOR ALL
  USING (
    order_id IN (
      SELECT id FROM store_orders WHERE parent_id = auth.uid()
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM store_orders WHERE parent_id = auth.uid() AND status = 'open'
    )
  );

COMMENT ON POLICY store_order_items_parent_all ON store_order_items IS 'Parents can CRUD items of their own open orders';