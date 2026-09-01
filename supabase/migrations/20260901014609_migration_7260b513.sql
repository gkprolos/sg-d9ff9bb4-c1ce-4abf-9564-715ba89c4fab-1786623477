-- Drop ALL activities policies and recreate with correct definitions
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'activities'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON activities';
  END LOOP;
END $$;

-- Create clean policies

-- 1. Admin ALL operations
CREATE POLICY activities_admin ON activities
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- 2. Coach SELECT - assigned teams OR activity_coaches participation
CREATE POLICY activities_coach_select ON activities
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id 
      FROM team_coaches 
      WHERE coach_id = auth.uid() 
        AND is_active = true
    )
    OR
    id IN (
      SELECT activity_id 
      FROM activity_coaches 
      WHERE coach_id = auth.uid()
    )
  );

-- 3. Coach INSERT - can create on any team
CREATE POLICY activities_coach_insert ON activities
  FOR INSERT
  WITH CHECK (true);

-- 4. Coach UPDATE - assigned teams OR activity_coaches participation
CREATE POLICY activities_coach_update ON activities
  FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id 
      FROM team_coaches 
      WHERE coach_id = auth.uid() 
        AND is_active = true
    )
    OR
    id IN (
      SELECT activity_id 
      FROM activity_coaches 
      WHERE coach_id = auth.uid()
    )
  );

-- 5. Coach DELETE - assigned teams OR activity_coaches participation
CREATE POLICY activities_coach_delete ON activities
  FOR DELETE
  USING (
    team_id IN (
      SELECT team_id 
      FROM team_coaches 
      WHERE coach_id = auth.uid() 
        AND is_active = true
    )
    OR
    id IN (
      SELECT activity_id 
      FROM activity_coaches 
      WHERE coach_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON POLICY activities_admin ON activities IS
  'Admins have ALL operations on all activities';

COMMENT ON POLICY activities_coach_select ON activities IS
  'Coaches see activities on assigned teams OR where they participated (activity_coaches)';

COMMENT ON POLICY activities_coach_insert ON activities IS
  'Coaches can create activities on any team';

COMMENT ON POLICY activities_coach_update ON activities IS
  'Coaches can update activities on assigned teams OR where they participated';

COMMENT ON POLICY activities_coach_delete ON activities IS
  'Coaches can delete activities on assigned teams OR where they participated';