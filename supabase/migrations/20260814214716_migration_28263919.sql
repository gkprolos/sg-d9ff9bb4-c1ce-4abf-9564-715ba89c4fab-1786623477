-- DROP old restrictive policy that blocks INSERT for non-assigned teams
DROP POLICY IF EXISTS "activities_insert_coach" ON activities;

-- Verify only new policy remains
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'activities' 
  AND schemaname = 'public'
  AND cmd = 'INSERT';