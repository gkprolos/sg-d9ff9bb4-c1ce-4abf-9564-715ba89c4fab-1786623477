-- Create clean, simple RLS policies for activities
-- Policy 1: Admin full access
CREATE POLICY "admin_full_access" ON activities
  FOR ALL
  USING (_app_internals.is_admin(auth.uid()))
  WITH CHECK (_app_internals.is_admin(auth.uid()));

-- Policy 2: Coach can insert for their teams
CREATE POLICY "coach_insert" ON activities
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id 
      FROM team_coaches 
      WHERE coach_id = auth.uid() 
        AND is_active = true
    )
  );

-- Policy 3: Coach can select activities for their teams
CREATE POLICY "coach_select" ON activities
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id 
      FROM team_coaches 
      WHERE coach_id = auth.uid() 
        AND is_active = true
    )
  );

-- Policy 4: Coach can update activities for their teams
CREATE POLICY "coach_update" ON activities
  FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id 
      FROM team_coaches 
      WHERE coach_id = auth.uid() 
        AND is_active = true
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id 
      FROM team_coaches 
      WHERE coach_id = auth.uid() 
        AND is_active = true
    )
  );