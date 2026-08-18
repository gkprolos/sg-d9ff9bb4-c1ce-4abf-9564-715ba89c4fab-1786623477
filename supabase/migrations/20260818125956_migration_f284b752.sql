-- Drop the old policy if it exists
DROP POLICY IF EXISTS "activities_update_policy" ON public.activities;

-- Create the corrected policy
CREATE POLICY "activities_update_policy" ON public.activities
  FOR UPDATE
  USING (
    _app_internals.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.activity_coaches ac
      WHERE ac.activity_id = activities.id
      AND ac.coach_id = auth.uid()
    )
  );