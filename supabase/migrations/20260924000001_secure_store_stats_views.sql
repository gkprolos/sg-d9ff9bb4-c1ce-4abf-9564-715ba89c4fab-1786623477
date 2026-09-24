-- ============================================================================
-- SECURE STORE STATISTICS VIEWS - ADMIN ONLY ACCESS
-- ============================================================================
-- Purpose: Restrict direct access to store_stats views and provide
--          SECURITY DEFINER RPC functions for admin-only access

-- ============================================================================
-- 1. CREATE SECURITY DEFINER FUNCTIONS (Admin Only)
-- ============================================================================

-- Function: Get monthly revenue statistics
CREATE OR REPLACE FUNCTION get_store_monthly_revenue()
RETURNS TABLE (
  month text,
  total_revenue numeric,
  orders_count bigint,
  avg_order_value numeric
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Return monthly revenue data
  RETURN QUERY
  SELECT 
    v.month,
    v.total_revenue,
    v.orders_count,
    v.avg_order_value
  FROM store_stats_monthly_revenue v
  ORDER BY v.month DESC
  LIMIT 12;
END;
$$;

-- Function: Get top selling items statistics
CREATE OR REPLACE FUNCTION get_store_top_items()
RETURNS TABLE (
  item_number text,
  item_name text,
  total_sold bigint,
  total_revenue numeric,
  collections_count bigint
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Return top items data
  RETURN QUERY
  SELECT 
    v.item_number,
    v.item_name,
    v.total_sold,
    v.total_revenue,
    v.collections_count
  FROM store_stats_top_items v
  ORDER BY v.total_sold DESC
  LIMIT 10;
END;
$$;

-- ============================================================================
-- 2. REVOKE DIRECT ACCESS TO VIEWS
-- ============================================================================

-- Revoke all direct access to the views
REVOKE ALL ON store_stats_monthly_revenue FROM anon, authenticated;
REVOKE ALL ON store_stats_top_items FROM anon, authenticated;

-- Grant SELECT only to service_role (for admin operations)
GRANT SELECT ON store_stats_monthly_revenue TO service_role;
GRANT SELECT ON store_stats_top_items TO service_role;

-- ============================================================================
-- 3. GRANT EXECUTE ON FUNCTIONS
-- ============================================================================

-- Grant execute permission to authenticated users (function checks admin role internally)
GRANT EXECUTE ON FUNCTION get_store_monthly_revenue() TO authenticated;
GRANT EXECUTE ON FUNCTION get_store_top_items() TO authenticated;

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

DO $$ 
DECLARE
  func_count integer;
BEGIN
  -- Check that functions exist
  SELECT COUNT(*) INTO func_count
  FROM pg_proc 
  WHERE proname IN ('get_store_monthly_revenue', 'get_store_top_items');
  
  IF func_count < 2 THEN
    RAISE EXCEPTION 'Store stats functions not created properly';
  END IF;
  
  RAISE NOTICE 'Success: Store statistics views secured with admin-only RPC functions';
END $$;