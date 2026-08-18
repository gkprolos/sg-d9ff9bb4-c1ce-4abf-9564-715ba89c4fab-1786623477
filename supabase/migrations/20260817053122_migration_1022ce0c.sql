-- Migration: Add guardian contact fields to players table
-- Date: 2026-08-17
-- Description: Add guardian1 and guardian2 contact information fields directly to players table

-- Add guardian1 fields
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS guardian1_name TEXT,
ADD COLUMN IF NOT EXISTS guardian1_phone TEXT,
ADD COLUMN IF NOT EXISTS guardian1_email TEXT;

-- Add guardian2 fields
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS guardian2_name TEXT,
ADD COLUMN IF NOT EXISTS guardian2_phone TEXT,
ADD COLUMN IF NOT EXISTS guardian2_email TEXT;

COMMENT ON COLUMN public.players.guardian1_name IS 'Full name of first guardian/parent';
COMMENT ON COLUMN public.players.guardian1_phone IS 'Phone number of first guardian/parent';
COMMENT ON COLUMN public.players.guardian1_email IS 'Email address of first guardian/parent';
COMMENT ON COLUMN public.players.guardian2_name IS 'Full name of second guardian/parent';
COMMENT ON COLUMN public.players.guardian2_phone IS 'Phone number of second guardian/parent';
COMMENT ON COLUMN public.players.guardian2_email IS 'Email address of second guardian/parent';