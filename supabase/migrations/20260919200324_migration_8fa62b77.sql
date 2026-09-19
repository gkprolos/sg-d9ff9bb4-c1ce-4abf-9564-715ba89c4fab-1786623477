-- Drop problematic policy and create corrected one
DROP POLICY IF EXISTS "store_items_parent_read" ON store_items;

CREATE POLICY "store_items_parent_read" ON store_items
FOR SELECT USING (
  is_active = true 
  AND (
    -- Admin/Coach can see all active items
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach'))
    OR 
    -- Parent can see active items if their email (from JWT) matches guardian email in players
    EXISTS (
      SELECT 1 FROM players p
      WHERE (
          p.guardian1_email = (auth.jwt() ->> 'email')
          OR p.guardian2_email = (auth.jwt() ->> 'email')
        )
        AND p.is_active = true
    )
  )
);

COMMENT ON POLICY "store_items_parent_read" ON store_items IS 
'Parents can view active items if their email (from JWT) is registered as guardian1_email or guardian2_email in players table. Admin/Coach can view all active items.';