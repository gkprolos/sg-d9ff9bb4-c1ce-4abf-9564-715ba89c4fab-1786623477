-- Migration: Fix recursive RLS policy on activities
-- Date: 2026-08-14
-- Description: Remove recursive policy that causes infinite loop

-- Drop the recursive policy
DROP POLICY IF EXISTS "activities_select_coaches" ON public.activities;

-- Keep only admin policy - coaches will access activities via activity_coaches JOIN
CREATE POLICY "activities_select_admin"
ON public.activities
FOR SELECT
USING (
  _app_internals.is_admin(auth.uid())
);

COMMENT ON POLICY "activities_select_admin" ON public.activities IS 'Admins can see all activities. Coaches access via activity_coaches join.';