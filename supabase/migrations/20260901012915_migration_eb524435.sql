-- Add missing UPDATE and DELETE policies for admin on activities
CREATE POLICY activities_admin_update ON activities
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY activities_admin_delete ON activities
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

COMMENT ON POLICY activities_admin_update ON activities IS
  'Admins can update all activities';

COMMENT ON POLICY activities_admin_delete ON activities IS
  'Admins can delete all activities';