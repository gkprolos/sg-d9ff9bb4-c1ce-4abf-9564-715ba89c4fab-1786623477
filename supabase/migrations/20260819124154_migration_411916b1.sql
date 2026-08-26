-- Drop ALL existing RLS policies on activities table first
DROP POLICY IF EXISTS "admin_all_activities" ON activities;
DROP POLICY IF EXISTS "admin_delete_activities" ON activities;
DROP POLICY IF EXISTS "admin_full_access" ON activities;
DROP POLICY IF EXISTS "activities_allow_insert" ON activities;
DROP POLICY IF EXISTS "activities_delete_admin" ON activities;
DROP POLICY IF EXISTS "activities_insert_coaches" ON activities;
DROP POLICY IF EXISTS "activities_select_admin" ON activities;
DROP POLICY IF EXISTS "activities_select_assigned_coach" ON activities;
DROP POLICY IF EXISTS "activities_update_coach" ON activities;
DROP POLICY IF EXISTS "activities_update_coaches" ON activities;
DROP POLICY IF EXISTS "coach_insert_own_teams" ON activities;
DROP POLICY IF EXISTS "coach_select_own_teams" ON activities;
DROP POLICY IF EXISTS "coach_update_own_teams" ON activities;