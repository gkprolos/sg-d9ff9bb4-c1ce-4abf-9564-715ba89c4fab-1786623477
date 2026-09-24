-- ============================================================================
-- REVOKE PUBLIC ACCESS TO STORE STATISTICS VIEWS
-- ============================================================================
-- Migration: Restrict direct access to store_stats_* views
-- Only accessible via SECURITY DEFINER RPC functions (admin-only)
-- ============================================================================

DO $$ 
BEGIN
  -- Remove public access from store_stats_monthly_revenue view
  REVOKE ALL ON store_stats_monthly_revenue FROM anon, authenticated, public;
  RAISE NOTICE 'Revoked public access from store_stats_monthly_revenue';

  -- Remove public access from store_stats_top_items view
  REVOKE ALL ON store_stats_top_items FROM anon, authenticated, public;
  RAISE NOTICE 'Revoked public access from store_stats_top_items';

  -- Grant access only to service_role (for RPC functions to work)
  GRANT SELECT ON store_stats_monthly_revenue TO service_role;
  GRANT SELECT ON store_stats_top_items TO service_role;
  RAISE NOTICE 'Granted service_role access for RPC function execution';

  RAISE NOTICE 'Success: Store statistics views secured - access only via admin RPC functions';
END $$;