-- Migration: Fix coach RLS policies
-- Date: 2026-08-14
-- Description: Remove recursive team_coaches policy and add proper SELECT policies for coaches

-- 1. Drop recursive policy on team_coaches
DROP POLICY IF EXISTS "Coaches select team assignments" ON public.team_coaches;

-- 2. Create safe SELECT policies for coaches on all reference tables

-- Teams: All active coaches can SELECT all non-archived teams
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

COMMENT ON POLICY "coaches_select_teams" ON public.teams IS 'All active coaches can view all non-archived teams';
COMMENT ON POLICY "coaches_select_venues" ON public.venues IS 'All active coaches can view all active venues';
COMMENT ON POLICY "coaches_select_schedules" ON public.schedule_templates IS 'All active coaches can view all active schedules';
COMMENT ON POLICY "coaches_select_players" ON public.players IS 'All active coaches can view all active players';
COMMENT ON POLICY "coaches_select_team_players" ON public.team_players IS 'All active coaches can view all active memberships';
COMMENT ON POLICY "coaches_select_team_coaches" ON public.team_coaches IS 'All active coaches can view team coach assignments';