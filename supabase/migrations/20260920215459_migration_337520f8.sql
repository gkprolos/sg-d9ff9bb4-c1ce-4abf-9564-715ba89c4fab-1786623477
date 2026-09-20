-- Fix user_roles SELECT policy - allow all authenticated users to read their own role
DROP POLICY IF EXISTS user_roles_select_own ON user_roles;

CREATE POLICY user_roles_select_own ON user_roles
  FOR SELECT
  USING (
    -- Allow users to see their own role
    auth.uid() = user_id
    -- Also allow if user_id is null (for queries that don't match)
    OR user_id IS NULL
  );

-- Also insert parent role for gregor.kamin@gmail.com if not exists
INSERT INTO user_roles (user_id, role)
VALUES (
  '804b28f3-c9d1-42ee-823f-f3d63bc5945d',
  'parent'
)
ON CONFLICT (user_id) DO UPDATE SET role = 'parent';