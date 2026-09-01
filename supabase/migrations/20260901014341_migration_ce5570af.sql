-- Fix activities policies to include activity_coaches participation

-- 1. Verify admin has ALL operations (should already exist)
DROP POLICY IF EXISTS activities_admin ON activities;
CREATE POLICY activities_admin ON activities
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- 2. Drop old coach_select and recreate with activity_coaches check
DROP POLICY IF EXISTS activities_coach_select ON activities;
CREATE POLICY activities_coach_select ON activities
  FOR SELECT
  USING (
    -- Coach is assigned to team (main coach)
    team_id IN (
      SELECT team_id 
      FROM team_coaches 
      WHERE coach_id = auth.uid() 
        AND is_active = true
    )
    OR
    -- Coach participated in this activity (assistant or created it)
    id IN (
      SELECT activity_id 
      FROM activity_coaches 
      WHERE coach_id = auth.uid()
    )
  );

-- 3. Drop old coach_write and recreate - coaches can create on any team
DROP POLICY IF EXISTS activities_coach_write ON activities;
CREATE POLICY activities_coach_write ON activities
  FOR INSERT
  WITH CHECK (
    -- Coaches can create activities on teams they're assigned to
    team_id IN (
      SELECT team_id 
      FROM team_coaches 
      WHERE coach_id = auth.uid() 
        AND is_active = true
    )
    OR
    -- OR on any team (will be added as activity_coaches participant)
    true
  );

-- 4. Drop old coach_update and recreate - coaches can update their activities
DROP POLICY IF EXISTS activities_coach_update ON activities;
CREATE POLICY activities_coach_update ON activities
  FOR UPDATE
  USING (
    -- Coach is assigned to team
    team_id IN (
      SELECT team_id 
      FROM team_coaches 
      WHERE coach_id = auth.uid() 
        AND is_active = true
    )
    OR
    -- Coach participated in this activity
    id IN (
      SELECT activity_id 
      FROM activity_coaches 
      WHERE coach_id = auth.uid()
    )
  );

-- 5. Add DELETE policy for coaches - coaches can delete their activities
DROP POLICY IF EXISTS activities_coach_delete ON activities;
CREATE POLICY activities_coach_delete ON activities
  FOR DELETE
  USING (
    -- Coach is assigned to team
    team_id IN (
      SELECT team_id 
      FROM team_coaches 
      WHERE coach_id = auth.uid() 
        AND is_active = true
    )
    OR
    -- Coach participated in this activity
    id IN (
      SELECT activity_id 
      FROM activity_coaches 
      WHERE coach_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON POLICY activities_admin ON activities IS
  'Admins have full access to all activities';

COMMENT ON POLICY activities_coach_select ON activities IS
  'Coaches can see activities where they are assigned to team OR participated as activity_coaches';

COMMENT ON POLICY activities_coach_write ON activities IS
  'Coaches can create activities on any team';

COMMENT ON POLICY activities_coach_update ON activities IS
  'Coaches can update activities where they are assigned to team OR participated';

COMMENT ON POLICY activities_coach_delete ON activities IS
  'Coaches can delete activities where they are assigned to team OR participated';