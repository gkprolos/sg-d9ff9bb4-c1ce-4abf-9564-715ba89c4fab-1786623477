-- Drop duplicate admin policies (activities_admin with cmd='ALL' already covers everything)
DROP POLICY IF EXISTS activities_admin_delete ON activities;
DROP POLICY IF EXISTS activities_admin_update ON activities;

-- Verify remaining policies
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'activities'
ORDER BY policyname;