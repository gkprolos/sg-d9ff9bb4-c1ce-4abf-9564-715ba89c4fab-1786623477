-- Step 1: DROP problematic policies that create circular dependency
DROP POLICY IF EXISTS coach_select ON public.activities;
DROP POLICY IF EXISTS coach_select_no_recursion ON public.activity_coaches;