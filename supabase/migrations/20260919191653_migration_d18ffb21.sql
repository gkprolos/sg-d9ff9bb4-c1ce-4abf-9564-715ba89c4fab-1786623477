-- Drop old RLS policy and create new one that checks guardian emails in players table
DROP POLICY IF EXISTS store_items_parent_read ON store_items;

CREATE POLICY store_items_parent_read ON store_items
  FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND deleted_at IS NULL
    AND (
      -- Admin/Coach can see all
      auth.uid() IN (
        SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
      )
      OR
      -- Parent can see if their email exists as guardian in players table
      (
        SELECT email FROM auth.users WHERE id = auth.uid()
      ) IN (
        SELECT guardian1_email FROM players WHERE guardian1_email IS NOT NULL
        UNION
        SELECT guardian2_email FROM players WHERE guardian2_email IS NOT NULL
      )
    )
  );

COMMENT ON POLICY store_items_parent_read ON store_items IS 
  'Parents can view active items if their email is registered as guardian, Admin/Coach can view all active items';