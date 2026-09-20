-- Add INSERT policy for store_collection_periods to allow creating new collection periods
-- This is needed for parent order submission flow
CREATE POLICY store_collection_periods_public_insert ON store_collection_periods
  FOR INSERT
  WITH CHECK (
    status = 'open' OR 
    (status IS NULL AND period_date >= CURRENT_DATE)
  );