-- Remove potential policy conflicts by dropping conflicting UPDATE policies
DROP POLICY IF EXISTS "Admin manage activities" ON public.activities;
DROP POLICY IF EXISTS "activities_update_policy" ON public.activities;

-- Create separate admin policies for each operation (no FOR ALL)
CREATE POLICY "admin_insert_activities" ON public.activities
  FOR INSERT
  TO authenticated
  WITH CHECK (_app_internals.is_admin(auth.uid()));

CREATE POLICY "admin_update_activities" ON public.activities
  FOR UPDATE
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()))
  WITH CHECK (_app_internals.is_admin(auth.uid()));

CREATE POLICY "admin_delete_activities" ON public.activities
  FOR DELETE
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Coach UPDATE policy without circular dependency - simplified check
CREATE POLICY "coach_update_activities" ON public.activities
  FOR UPDATE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.team_coaches
      WHERE coach_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_coaches
      WHERE coach_id = auth.uid() AND is_active = true
    )
  );