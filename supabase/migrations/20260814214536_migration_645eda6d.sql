-- Simplify RLS policies for activities - allow ALL coaches to INSERT regardless of team assignment

-- DROP old policy
DROP POLICY IF EXISTS "activities_insert_coaches" ON activities;

-- CREATE new simplified policy - any coach can INSERT activity for any team
CREATE POLICY "activities_insert_all_coaches"
ON activities
FOR INSERT
TO public
WITH CHECK (
  -- Admins can insert
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
  OR
  -- Any coach can insert (no team restriction)
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'coach'
  )
);

-- Verify
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'activities' 
  AND schemaname = 'public'
  AND cmd = 'INSERT';