-- Create new expanded coach_select policy
-- Coaches can see activities where they are:
--   1. Team coach for that team (team_coaches)
--   2. OR participated on the activity (activity_coaches)
CREATE POLICY coach_select ON public.activities
  FOR SELECT
  TO authenticated
  USING (
    -- Check if user is admin
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
    OR
    -- Check if user is team coach for this team
    team_id IN (
      SELECT tc.team_id 
      FROM public.team_coaches tc
      WHERE tc.coach_id = auth.uid()
        AND tc.is_active = true
    )
    OR
    -- Check if user participated in this activity (substitution/assistant)
    id IN (
      SELECT ac.activity_id
      FROM public.activity_coaches ac
      WHERE ac.coach_id = auth.uid()
    )
  );

COMMENT ON POLICY coach_select ON public.activities IS 'Coaches can see activities where they are team coach OR participated as substitute/assistant';