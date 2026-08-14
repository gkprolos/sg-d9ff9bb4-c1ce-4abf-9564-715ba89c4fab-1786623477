-- Fix recursive RLS policy immediately
DROP POLICY IF EXISTS "activities_select_coaches" ON public.activities;
DROP POLICY IF EXISTS "activities_select_admin" ON public.activities;

-- Create non-recursive policy for admins only
CREATE POLICY "activities_select_admin"
ON public.activities
FOR SELECT
USING (
  _app_internals.is_admin(auth.uid())
);

SELECT 'Recursive RLS policy removed - activities accessible only to admins via direct query' as status;