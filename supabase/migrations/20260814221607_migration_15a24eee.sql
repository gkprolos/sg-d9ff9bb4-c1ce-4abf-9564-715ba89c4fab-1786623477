-- Apply new RLS migration
-- This migration drops recursive policy and adds safe SELECT policies for coaches

-- 1. Drop recursive policy on team_coaches
DROP POLICY IF EXISTS "Coaches select team assignments" ON public.team_coaches;

-- 2. Create safe SELECT policies for coaches on all reference tables

-- Teams: All active coaches can SELECT all non-archived teams
DROP POLICY IF EXISTS "coaches_select_teams" ON public.teams;
CREATE POLICY "coaches_select_teams"
ON public.teams
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
  )
  AND is_archived = false
);

-- Venues: All active coaches can SELECT all active venues
DROP POLICY IF EXISTS "coaches_select_venues" ON public.venues;
CREATE POLICY "coaches_select_venues"
ON public.venues
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
  )
  AND is_active = true
);

-- Schedule templates: All active coaches can SELECT all active schedules
DROP POLICY IF EXISTS "coaches_select_schedules" ON public.schedule_templates;
CREATE POLICY "coaches_select_schedules"
ON public.schedule_templates
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
  )
  AND is_active = true
);

-- Players: All active coaches can SELECT all active players
DROP POLICY IF EXISTS "coaches_select_players" ON public.players;
CREATE POLICY "coaches_select_players"
ON public.players
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
  )
  AND is_active = true
);

-- Team players: All active coaches can SELECT all active memberships
DROP POLICY IF EXISTS "coaches_select_team_players" ON public.team_players;
CREATE POLICY "coaches_select_team_players"
ON public.team_players
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
  )
  AND membership_status = 'active'
);

-- Team coaches: All active coaches can SELECT team coach assignments (for reference, not for filtering access)
DROP POLICY IF EXISTS "coaches_select_team_coaches" ON public.team_coaches;
CREATE POLICY "coaches_select_team_coaches"
ON public.team_coaches
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_active = true
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
  )
);

-- Verify policies created
SELECT 'RLS policies successfully created for coaches' as status;