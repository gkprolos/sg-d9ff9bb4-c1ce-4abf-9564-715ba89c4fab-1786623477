-- Recreate simple coach_select_safe policy WITHOUT recursion
CREATE POLICY coach_select_safe ON public.activity_coaches
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can see all
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
    OR
    -- Coach can see their own activity_coaches records
    coach_id = auth.uid()
  );

COMMENT ON POLICY coach_select_safe ON activity_coaches IS
  'Coaches can see their own activity_coaches records, admins can see all';