-- Drop ALL existing policies on activities and recreate with correct ones
DROP POLICY IF EXISTS admin_full_access ON public.activities;
DROP POLICY IF EXISTS coach_select ON public.activities;
DROP POLICY IF EXISTS coach_insert ON public.activities;
DROP POLICY IF EXISTS coach_update ON public.activities;
DROP POLICY IF EXISTS coach_delete ON public.activities;

-- Recreate admin policy (all operations)
CREATE POLICY admin_full_access ON public.activities
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Recreate coach SELECT policy (can see activities where they are team_coach OR participant)
CREATE POLICY coach_select ON public.activities
  FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM team_coaches
      WHERE coach_id = auth.uid()
        AND is_active = true
    )
    OR id IN (
      SELECT activity_id FROM activity_coaches
      WHERE coach_id = auth.uid()
    )
  );

-- Recreate coach INSERT policy
CREATE POLICY coach_insert ON public.activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_coaches
      WHERE coach_id = auth.uid()
        AND is_active = true
    )
  );

-- Recreate coach UPDATE policy
CREATE POLICY coach_update ON public.activities
  FOR UPDATE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM team_coaches
      WHERE coach_id = auth.uid()
        AND is_active = true
    )
    OR id IN (
      SELECT activity_id FROM activity_coaches
      WHERE coach_id = auth.uid()
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_coaches
      WHERE coach_id = auth.uid()
        AND is_active = true
    )
  );

-- Recreate coach DELETE policy
CREATE POLICY coach_delete ON public.activities
  FOR DELETE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM team_coaches
      WHERE coach_id = auth.uid()
        AND is_active = true
    )
  );