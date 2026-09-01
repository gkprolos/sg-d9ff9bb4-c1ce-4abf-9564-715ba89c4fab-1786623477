-- Drop and recreate admin_full_access policy on activities to fix SELECT access
DROP POLICY IF EXISTS admin_full_access ON public.activities;

CREATE POLICY admin_full_access ON public.activities
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );