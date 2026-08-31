-- Drop the problematic recursive SELECT policy on activity_coaches
DROP POLICY IF EXISTS coach_select_own ON activity_coaches;

-- Create simple non-recursive replacement for coach SELECT
CREATE POLICY coach_select_simple ON activity_coaches
  FOR SELECT
  TO authenticated
  USING (
    -- Coach can see only their own records (no recursion)
    coach_id = auth.uid()
  );

COMMENT ON POLICY coach_select_simple ON activity_coaches IS 
  'Non-recursive SELECT policy for coaches: Can see only records where coach_id = auth.uid(). Admin SELECT uses separate activity_coaches_select_admin policy with is_admin function.';