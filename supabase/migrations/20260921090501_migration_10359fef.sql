-- Drop existing restrictive policies and create permissive INSERT policy for authenticated users
DROP POLICY IF EXISTS store_collection_periods_public_insert ON store_collection_periods;
DROP POLICY IF EXISTS store_collection_periods_auth_insert ON store_collection_periods;

-- Create new INSERT policy that allows any authenticated user to create collection periods
CREATE POLICY store_collection_periods_insert_policy 
  ON store_collection_periods
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also ensure SELECT is allowed for authenticated users
DROP POLICY IF EXISTS store_collection_periods_public_select ON store_collection_periods;
CREATE POLICY store_collection_periods_select_policy
  ON store_collection_periods
  FOR SELECT
  TO authenticated
  USING (true);