-- Fix store_collection_periods RLS policy - remove user_roles dependency
-- Allow authenticated parent users to INSERT collection periods for open orders

DROP POLICY IF EXISTS store_collection_periods_public_insert ON store_collection_periods;

CREATE POLICY store_collection_periods_auth_insert ON store_collection_periods
  FOR INSERT
  WITH CHECK (
    -- Allow insert if user is authenticated
    auth.uid() IS NOT NULL
    AND (status = 'open' OR status IS NULL)
    AND period_date >= CURRENT_DATE
  );