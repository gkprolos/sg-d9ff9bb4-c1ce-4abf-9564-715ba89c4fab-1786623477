-- Drop the circular dependency policy
DROP POLICY IF EXISTS "activities_update_policy" ON public.activities;

-- Create new policy using team_coaches directly (no circular dependency)
CREATE POLICY "activities_update_policy" ON public.activities
  FOR UPDATE
  USING (
    _app_internals.is_admin(auth.uid()) OR
    team_id IN (
      SELECT team_id FROM public.team_coaches
      WHERE coach_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    _app_internals.is_admin(auth.uid()) OR
    team_id IN (
      SELECT team_id FROM public.team_coaches
      WHERE coach_id = auth.uid() AND is_active = true
    )
  );