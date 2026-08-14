-- CORRECTED: Use is_any_active_coach instead of is_coach
-- This SQL will DROP restrictive policies and CREATE new ones for coach full visibility

-- ========================================
-- 1. PLAYERS - SELECT ALL + UPDATE restricted
-- ========================================
DROP POLICY IF EXISTS "players_select_by_coach" ON public.players;
DROP POLICY IF EXISTS "players_update_by_coach" ON public.players;

CREATE POLICY "players_select_all_coaches"
ON public.players FOR SELECT
TO public
USING (
  _app_internals.is_admin(auth.uid()) OR 
  _app_internals.is_any_active_coach(auth.uid())
);

CREATE POLICY "players_update_by_assigned_coach"
ON public.players FOR UPDATE
TO public
USING (
  _app_internals.is_admin(auth.uid()) OR
  id IN (
    SELECT DISTINCT tp.player_id 
    FROM team_players tp
    JOIN team_coaches tc ON tc.team_id = tp.team_id
    WHERE tc.coach_id = auth.uid()
  )
);

-- ========================================
-- 2. TEAMS - SELECT ALL + UPDATE restricted
-- ========================================
DROP POLICY IF EXISTS "teams_select_by_coach" ON public.teams;
DROP POLICY IF EXISTS "teams_update_by_coach" ON public.teams;

CREATE POLICY "teams_select_all_coaches"
ON public.teams FOR SELECT
TO public
USING (
  _app_internals.is_admin(auth.uid()) OR 
  _app_internals.is_any_active_coach(auth.uid())
);

CREATE POLICY "teams_update_by_assigned_coach"
ON public.teams FOR UPDATE
TO public
USING (
  _app_internals.is_admin(auth.uid()) OR
  id IN (SELECT _app_internals.coach_team_ids(auth.uid()))
);

-- ========================================
-- 3. SCHEDULE_TEMPLATES - SELECT ALL (read-only for coaches)
-- ========================================
DROP POLICY IF EXISTS "schedule_templates_select_by_coach" ON public.schedule_templates;
DROP POLICY IF EXISTS "schedule_templates_select_assigned_coach" ON public.schedule_templates;

CREATE POLICY "schedule_templates_select_all_coaches"
ON public.schedule_templates FOR SELECT
TO public
USING (
  _app_internals.is_admin(auth.uid()) OR 
  _app_internals.is_any_active_coach(auth.uid())
);

-- ========================================
-- 4. TEAM_PLAYERS - SELECT ALL + MODIFY restricted to assigned teams
-- ========================================
DROP POLICY IF EXISTS "team_players_select_by_coach" ON public.team_players;
DROP POLICY IF EXISTS "team_players_select_assigned_coach" ON public.team_players;
DROP POLICY IF EXISTS "team_players_insert_by_coach" ON public.team_players;
DROP POLICY IF EXISTS "team_players_update_by_coach" ON public.team_players;
DROP POLICY IF EXISTS "team_players_delete_by_coach" ON public.team_players;

CREATE POLICY "team_players_select_all_coaches"
ON public.team_players FOR SELECT
TO public
USING (
  _app_internals.is_admin(auth.uid()) OR 
  _app_internals.is_any_active_coach(auth.uid())
);

CREATE POLICY "team_players_insert_assigned_coach"
ON public.team_players FOR INSERT
TO public
WITH CHECK (
  _app_internals.is_admin(auth.uid()) OR
  team_id IN (SELECT _app_internals.coach_team_ids(auth.uid()))
);

CREATE POLICY "team_players_update_assigned_coach"
ON public.team_players FOR UPDATE
TO public
USING (
  _app_internals.is_admin(auth.uid()) OR
  team_id IN (SELECT _app_internals.coach_team_ids(auth.uid()))
);

CREATE POLICY "team_players_delete_assigned_coach"
ON public.team_players FOR DELETE
TO public
USING (
  _app_internals.is_admin(auth.uid()) OR
  team_id IN (SELECT _app_internals.coach_team_ids(auth.uid()))
);

-- ========================================
-- VERIFICATION: Check created policies
-- ========================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('players', 'teams', 'schedule_templates', 'team_players')
  AND schemaname = 'public'
ORDER BY tablename, policyname;