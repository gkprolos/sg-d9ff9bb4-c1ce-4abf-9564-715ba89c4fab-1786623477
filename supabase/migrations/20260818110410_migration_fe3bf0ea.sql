-- Add guardian contact fields to players table
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS guardian1_name TEXT,
ADD COLUMN IF NOT EXISTS guardian1_phone TEXT,
ADD COLUMN IF NOT EXISTS guardian1_email TEXT,
ADD COLUMN IF NOT EXISTS guardian2_name TEXT,
ADD COLUMN IF NOT EXISTS guardian2_phone TEXT,
ADD COLUMN IF NOT EXISTS guardian2_email TEXT;

SELECT 'Guardian contact columns added successfully' as status;