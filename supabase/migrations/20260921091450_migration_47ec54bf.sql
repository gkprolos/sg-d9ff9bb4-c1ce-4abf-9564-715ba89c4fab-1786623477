-- Add comprehensive RLS policies for coach/admin on store_orders
-- Allow coaches/admins to SELECT all orders
CREATE POLICY store_orders_coach_admin_select
  ON store_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('coach', 'admin')
    )
  );

-- Allow coaches/admins to UPDATE all orders
CREATE POLICY store_orders_coach_admin_update
  ON store_orders
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