-- Add comprehensive RLS policies for coach/admin on store_order_items
-- Allow coaches/admins to SELECT all order items
CREATE POLICY store_order_items_coach_admin_select
  ON store_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('coach', 'admin')
    )
  );

-- Allow coaches/admins to UPDATE all order items
CREATE POLICY store_order_items_coach_admin_update
  ON store_order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('coach', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('coach', 'admin')
    )
  );

-- Allow coaches/admins to INSERT order items (for manual order creation)
CREATE POLICY store_order_items_coach_admin_insert
  ON store_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('coach', 'admin')
    )
  );