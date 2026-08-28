-- Add CASCADE delete for team_players.player_id
ALTER TABLE public.team_players
DROP CONSTRAINT IF EXISTS team_players_player_id_fkey,
ADD CONSTRAINT team_players_player_id_fkey
  FOREIGN KEY (player_id)
  REFERENCES public.players(id)
  ON DELETE CASCADE;

-- Add CASCADE delete for attendance_records.player_id
ALTER TABLE public.attendance_records
DROP CONSTRAINT IF EXISTS attendance_records_player_id_fkey,
ADD CONSTRAINT attendance_records_player_id_fkey
  FOREIGN KEY (player_id)
  REFERENCES public.players(id)
  ON DELETE CASCADE;

-- Add CASCADE delete for player_forms.player_id
ALTER TABLE public.player_forms
DROP CONSTRAINT IF EXISTS player_forms_player_id_fkey,
ADD CONSTRAINT player_forms_player_id_fkey
  FOREIGN KEY (player_id)
  REFERENCES public.players(id)
  ON DELETE CASCADE;

-- player_guardians already has CASCADE (verified from schema)

-- Verify changes
SELECT 
  tc.table_name,
  kcu.column_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'player_id'
  AND tc.table_name IN ('team_players', 'attendance_records', 'player_forms', 'player_guardians')
ORDER BY tc.table_name;