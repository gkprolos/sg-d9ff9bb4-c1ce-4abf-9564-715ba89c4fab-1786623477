-- Fix store_orders RLS policies - remove user_roles dependency
-- Parent users with valid Supabase Auth session should be able to insert orders

DROP POLICY IF EXISTS store_orders_parent_insert ON store_orders;

CREATE POLICY store_orders_parent_insert ON store_orders
  FOR INSERT
  WITH CHECK (
    -- Allow insert if user is authenticated (has valid uid)
    auth.uid() IS NOT NULL AND parent_id = auth.uid()
  );