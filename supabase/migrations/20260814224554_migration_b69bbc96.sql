-- Migration: Add RLS policy for coaches to see their activities
-- Date: 2026-08-14
-- Description: Coaches can SELECT activities where they are assigned as head or assistant

-- Drop existing coach SELECT policy if it exists
DROP POLICY IF EXISTS "activities_select_coaches" ON public.activities;

-- Create new policy: coaches see activities where they are assigned
CREATE POLICY "activities_select_coaches"
ON public.activities
FOR SELECT
USING (
  -- Admin sees all
  _app_internals.is_admin(auth.uid())
  OR
  -- Coach sees activities where they are assigned
  EXISTS (
    SELECT 1 FROM activity_coaches ac
    WHERE ac.activity_id = activities.id
      AND ac.coach_id = auth.uid()
  )
);

COMMENT ON POLICY "activities_select_coaches" ON public.activities IS 'Coaches can see activities where they are assigned as head or assistant';