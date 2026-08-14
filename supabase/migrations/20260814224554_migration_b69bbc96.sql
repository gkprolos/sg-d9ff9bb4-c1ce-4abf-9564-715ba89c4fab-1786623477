-- Drop the trigger that prevents activity deletion completely
DROP TRIGGER IF EXISTS validate_activity_coaches_trigger ON public.activities;
DROP TRIGGER IF EXISTS validate_activity_coaches_trigger ON public.activity_coaches;

-- Drop the validation function with CASCADE to remove all dependent triggers
DROP FUNCTION IF EXISTS _app_internals.validate_activity_coaches() CASCADE;

SELECT 'All triggers removed - activities can now be deleted' as status;