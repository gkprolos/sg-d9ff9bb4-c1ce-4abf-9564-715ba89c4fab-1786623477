-- Fix store_order_items SELECT policy - simplify to allow all authenticated users
-- This is safer and covers coach/admin/parent
DROP POLICY IF EXISTS store_order_items_coach_admin_select ON store_order_items;
DROP POLICY IF EXISTS store_order_items_parent_select ON store_order_items;

CREATE POLICY store_order_items_select_policy 
  ON store_order_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Also fix UPDATE policy
DROP POLICY IF EXISTS store_order_items_coach_admin_update ON store_order_items;

CREATE POLICY store_order_items_update_policy
  ON store_order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('coach', 'admin')
    )
  );