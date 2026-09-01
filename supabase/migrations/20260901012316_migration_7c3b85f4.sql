-- Drop ABSOLUTELY ALL policies on both tables
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename
    FROM pg_policies
    WHERE tablename IN ('activities', 'activity_coaches')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END
$$;

-- Verify all policies dropped
SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('activities', 'activity_coaches');