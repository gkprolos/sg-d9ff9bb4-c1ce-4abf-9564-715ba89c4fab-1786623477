-- Drop and recreate store_categories policies using JWT email instead of auth.users
DROP POLICY IF EXISTS "store_categories_parent_read" ON store_categories;
DROP POLICY IF EXISTS "store_categories_read" ON store_categories;

CREATE POLICY "store_categories_read" ON store_categories
FOR SELECT USING (
  is_active = true 
  AND (
    -- Admin/Coach can see all active categories
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach'))
    OR 
    -- Parent can see active categories if their email matches guardian in players
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

COMMENT ON POLICY "store_categories_read" ON store_categories IS 
'Parents can view active categories if their email (from JWT) is registered as guardian. Admin/Coach can view all active categories.';