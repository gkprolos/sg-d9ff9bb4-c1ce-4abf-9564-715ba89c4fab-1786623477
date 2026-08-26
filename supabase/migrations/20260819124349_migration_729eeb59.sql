-- Remove duplicate policies - keep only clean minimal set
DROP POLICY IF EXISTS "admin_insert_activities" ON activities;
DROP POLICY IF EXISTS "coach_select_activities" ON activities;
DROP POLICY IF EXISTS "coach_update_activities" ON activities;