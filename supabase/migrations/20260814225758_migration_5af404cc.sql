-- Apply RLS policy for coaches to see their activities
DROP POLICY IF EXISTS "activities_select_coaches" ON public.activities;

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

SELECT 'RLS policy for coach activity access created successfully' as status;