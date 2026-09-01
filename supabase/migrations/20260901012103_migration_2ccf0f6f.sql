-- Drop ALL policies on activities and activity_coaches to start fresh
DROP POLICY IF EXISTS admin_full_access ON activities;
DROP POLICY IF EXISTS coach_select ON activities;
DROP POLICY IF EXISTS coach_insert ON activities;
DROP POLICY IF EXISTS coach_update ON activities;
DROP POLICY IF EXISTS coach_delete ON activities;
DROP POLICY IF EXISTS coach_select_safe ON activity_coaches;
DROP POLICY IF EXISTS admin_all_activity_coaches ON activity_coaches;
DROP POLICY IF EXISTS coach_own_records ON activity_coaches;

-- Create SIMPLE policies WITHOUT cross-table joins

-- ========== ACTIVITIES TABLE ==========

-- Admin can do everything
CREATE POLICY activities_admin_all ON activities
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Coaches can SELECT activities where they are assigned to the team
CREATE POLICY activities_coach_select ON activities
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_coaches
      WHERE coach_id = auth.uid()
        AND is_active = true
    )
  );

-- Coaches can INSERT activities for their assigned teams
CREATE POLICY activities_coach_insert ON activities
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_coaches
      WHERE coach_id = auth.uid()
        AND is_active = true
    )
  );

-- Coaches can UPDATE activities for their assigned teams
CREATE POLICY activities_coach_update ON activities
  FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_coaches
      WHERE coach_id = auth.uid()
        AND is_active = true
    )
  );

-- ========== ACTIVITY_COACHES TABLE ==========

-- Admin can do everything
CREATE POLICY activity_coaches_admin_all ON activity_coaches
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Coaches can SELECT their own records (NO JOIN to activities!)
CREATE POLICY activity_coaches_coach_select ON activity_coaches
  FOR SELECT
  USING (
    coach_id = auth.uid()
  );

-- Coaches can INSERT their own records
CREATE POLICY activity_coaches_coach_insert ON activity_coaches
  FOR INSERT
  WITH CHECK (
    coach_id = auth.uid()
  );

-- Coaches can UPDATE their own records
CREATE POLICY activity_coaches_coach_update ON activity_coaches
  FOR UPDATE
  USING (
    coach_id = auth.uid()
  );

-- Coaches can DELETE their own records
CREATE POLICY activity_coaches_coach_delete ON activity_coaches
  FOR DELETE
  USING (
    coach_id = auth.uid()
  );