-- Migration: Remove activity coach constraint that prevents deletion
-- Date: 2026-08-14
-- Description: Drop trigger that requires at least one coach on activities

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS validate_activity_coaches_trigger ON public.activities;

-- Drop the validation function (if not used elsewhere)
DROP FUNCTION IF EXISTS _app_internals.validate_activity_coaches();

COMMENT ON TABLE public.activities IS 'Activities table - coach validation removed to allow admin deletions';