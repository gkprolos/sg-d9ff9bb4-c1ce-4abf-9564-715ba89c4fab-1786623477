-- CLEAN SLATE: Drop ALL activities policies
DROP POLICY IF EXISTS "Admin manage activities" ON public.activities;
DROP POLICY IF EXISTS "Admin select all activities" ON public.activities;
DROP POLICY IF EXISTS "Coaches select team activities" ON public.activities;
DROP POLICY IF EXISTS "admin_update_activities" ON public.activities;
DROP POLICY IF EXISTS "coach_update_activities" ON public.activities;
DROP POLICY IF EXISTS "activities_update_policy" ON public.activities;

-- BASIC RULE 1: Admin sees and manages EVERYTHING
CREATE POLICY "admin_all_activities" ON public.activities
  FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()))
  WITH CHECK (_app_internals.is_admin(auth.uid()));

-- BASIC RULE 2: Coach sees only their team activities
CREATE POLICY "coach_select_activities" ON public.activities
  FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.team_coaches
      WHERE coach_id = auth.uid() AND is_active = true
    )
  );

-- BASIC RULE 3: Coach can UPDATE is_completed on their team activities
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