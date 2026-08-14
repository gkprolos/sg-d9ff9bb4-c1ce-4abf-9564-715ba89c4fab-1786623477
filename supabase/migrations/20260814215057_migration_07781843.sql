-- Simplify RLS completely - remove ALL existing policies and create one simple INSERT policy
-- This will help identify if the problem is policy logic or something else

-- Drop ALL existing INSERT policies
DROP POLICY IF EXISTS "activities_insert_coach" ON activities;
DROP POLICY IF EXISTS "activities_insert_coaches" ON activities;
DROP POLICY IF EXISTS "activities_insert_all_coaches" ON activities;
DROP POLICY IF EXISTS "activities_insert_admin" ON activities;

-- Create ONE simple INSERT policy that allows both admin and coach
CREATE POLICY "activities_allow_insert" 
ON activities 
FOR INSERT 
WITH CHECK (
  -- Allow if user is admin OR coach (direct check)
  EXISTS (
    SELECT 1 
    FROM user_roles 
    WHERE user_id = auth.uid() 
      AND role IN ('admin', 'coach')
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