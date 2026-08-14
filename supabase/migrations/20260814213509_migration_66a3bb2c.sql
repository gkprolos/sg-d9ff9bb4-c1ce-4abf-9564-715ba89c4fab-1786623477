-- Simplify RLS policies to use user_roles directly instead of is_any_active_coach()

-- 1. DROP and recreate teams policies with simplified logic
DROP POLICY IF EXISTS teams_select_all_coaches ON teams;
DROP POLICY IF EXISTS teams_select_admin ON teams;

CREATE POLICY teams_select_all
ON teams FOR SELECT
TO public
USING (
  -- Admins see all
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
  OR
  -- Coaches see all teams (not just assigned)
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'coach'
  )
);

-- 2. DROP and recreate venues policies
DROP POLICY IF EXISTS venues_select_all ON venues;

CREATE POLICY venues_select_all
ON venues FOR SELECT
TO public
USING (
  -- Admins see all
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
  OR
  -- Coaches see all venues
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'coach'
  )
);

-- 3. Verify policies
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('teams', 'venues')
  AND schemaname = 'public'
ORDER BY tablename, policyname;