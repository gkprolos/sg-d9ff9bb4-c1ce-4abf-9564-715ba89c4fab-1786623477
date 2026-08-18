-- Drop and recreate the policy with WITH CHECK clause
DROP POLICY IF EXISTS "activities_update_policy" ON public.activities;

CREATE POLICY "activities_update_policy" ON public.activities
  FOR UPDATE
  USING (
    _app_internals.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.activity_coaches ac
      WHERE ac.activity_id = activities.id
      AND ac.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    _app_internals.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.activity_coaches ac
      WHERE ac.activity_id = activities.id
      AND ac.coach_id = auth.uid()
    )
  );