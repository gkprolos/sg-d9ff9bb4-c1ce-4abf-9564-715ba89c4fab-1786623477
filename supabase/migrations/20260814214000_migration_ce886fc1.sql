-- Add INSERT and UPDATE RLS policies for coaches on activities

-- 1. Allow coaches to INSERT activities
CREATE POLICY "activities_insert_coaches"
ON activities
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'coach')
  )
);

-- 2. Allow coaches to UPDATE their own activities (where they are coach)
CREATE POLICY "activities_update_coaches"
ON activities
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM activity_coaches
    WHERE activity_coaches.activity_id = activities.id
    AND activity_coaches.coach_id = auth.uid()
  )
);

-- 3. Allow coaches and admins to INSERT into activity_coaches
CREATE POLICY "activity_coaches_insert_all"
ON activity_coaches
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'coach')
  )
);

-- 4. Allow coaches to UPDATE their own activity_coaches records
CREATE POLICY "activity_coaches_update_own"
ON activity_coaches
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
  OR coach_id = auth.uid()
);

-- Verify new policies
SELECT 
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('activities', 'activity_coaches')
  AND schemaname = 'public'
ORDER BY tablename, cmd, policyname;