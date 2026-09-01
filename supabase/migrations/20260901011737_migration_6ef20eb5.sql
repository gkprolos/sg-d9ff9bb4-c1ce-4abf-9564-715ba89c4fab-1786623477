-- Drop and recreate coach_select_safe policy WITHOUT any subqueries
-- Simple direct check: coaches see their own records, admins see all
DROP POLICY IF EXISTS coach_select_safe ON public.activity_coaches;

CREATE POLICY coach_select_safe 
  ON public.activity_coaches 
  FOR SELECT 
  USING (
    -- Admins can see all
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
    OR
    -- Coaches can see their own activity_coaches records
    coach_id = auth.uid()
  );

COMMENT ON POLICY coach_select_safe ON activity_coaches IS
  'Coaches can see their own activity_coaches records, admins can see all - NO RECURSION';