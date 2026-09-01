-- Create ONLY simple policies WITHOUT any cross-table joins

-- ========== ACTIVITIES TABLE ==========

-- Admin: can do everything
CREATE POLICY activities_admin ON activities
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Coach: can SELECT activities for assigned teams ONLY (no activity_coaches join!)
CREATE POLICY activities_coach_select ON activities
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_coaches
      WHERE coach_id = auth.uid()
        AND is_active = true
    )
  );

-- Coach: can INSERT/UPDATE for assigned teams
CREATE POLICY activities_coach_write ON activities
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_coaches
      WHERE coach_id = auth.uid()
        AND is_active = true
    )
  );

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

-- Admin: can do everything
CREATE POLICY activity_coaches_admin ON activity_coaches
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Coach: can SELECT own records ONLY (no activities join!)
CREATE POLICY activity_coaches_coach_select ON activity_coaches
  FOR SELECT
  USING (
    coach_id = auth.uid()
  );

-- Coach: can INSERT own records
CREATE POLICY activity_coaches_coach_insert ON activity_coaches
  FOR INSERT
  WITH CHECK (
    coach_id = auth.uid()
  );

-- Coach: can UPDATE own records
CREATE POLICY activity_coaches_coach_update ON activity_coaches
  FOR UPDATE
  USING (
    coach_id = auth.uid()
  );