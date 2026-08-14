-- Add head_coach_id column to teams table
ALTER TABLE teams 
ADD COLUMN head_coach_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN teams.head_coach_id IS 'Glavni trener selekcije';