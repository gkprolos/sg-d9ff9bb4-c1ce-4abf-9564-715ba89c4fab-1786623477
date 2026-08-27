-- Add DELETE policy for profiles table (admin only)
CREATE POLICY "profiles_delete_admin" ON profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Add DELETE policy for user_roles table (admin only)
CREATE POLICY "user_roles_delete_admin" ON user_roles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
    )
  );

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename IN ('profiles', 'user_roles')
  AND cmd = 'DELETE'
ORDER BY tablename, policyname;