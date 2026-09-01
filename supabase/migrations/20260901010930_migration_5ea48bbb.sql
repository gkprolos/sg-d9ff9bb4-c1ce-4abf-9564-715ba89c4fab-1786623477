-- Drop policy that depends on the function
DROP POLICY IF EXISTS coach_select_safe ON public.activity_coaches;

-- Drop the function with CASCADE to handle any remaining dependencies
DROP FUNCTION IF EXISTS public.coach_can_see_activity(uuid) CASCADE;