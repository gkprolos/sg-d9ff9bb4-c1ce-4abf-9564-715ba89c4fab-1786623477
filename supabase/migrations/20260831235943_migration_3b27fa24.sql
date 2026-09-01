-- Create new expanded coach_select policy
-- Coaches can see ALL activity_coaches records for activities they can see
-- (activities RLS already filters which activities coach can view)
CREATE POLICY coach_select ON public.activity_coaches
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can see all
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
    OR
    -- Coach can see activity_coaches for activities they have access to
    -- (activities.coach_select policy already limits which activities coach can see)
    -- So if activity is visible, all its coaches should be visible
    activity_id IN (
      SELECT id FROM activities
      -- activities RLS will filter this automatically
    )
  );

COMMENT ON POLICY coach_select ON activity_coaches IS
  'Coaches can see all coaches on activities they have access to view';