-- Apply RLS policies for coach player management
-- PLAYERS policies
DROP POLICY IF EXISTS "players_insert_coaches" ON public.players;
DROP POLICY IF EXISTS "players_update_coaches" ON public.players;

CREATE POLICY "players_insert_coaches"
ON public.players
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_active = true
  )
  AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('coach', 'admin')
  )
);

CREATE POLICY "players_update_coaches"
ON public.players
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_active = true
  )
  AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('coach', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_active = true
  )
  AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('coach', 'admin')
  )
);

-- TEAM_PLAYERS policies
DROP POLICY IF EXISTS "team_players_insert_coaches" ON public.team_players;
DROP POLICY IF EXISTS "team_players_delete_coaches" ON public.team_players;

CREATE POLICY "team_players_insert_coaches"
ON public.team_players
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_active = true
  )
  AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('coach', 'admin')
  )
  AND
  EXISTS (
    SELECT 1 FROM teams
    WHERE id = team_id
      AND is_archived = false
  )
);

CREATE POLICY "team_players_delete_coaches"
ON public.team_players
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_active = true
  )
  AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('coach', 'admin')
  )
);

SELECT 'RLS policies for coach player management created successfully' as status;