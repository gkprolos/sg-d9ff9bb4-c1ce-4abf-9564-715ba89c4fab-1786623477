-- Migracija 2: Interne pomožne funkcije
-- Datum: 2026-08-13
-- Opis: SECURITY DEFINER funkcije za avtorizacijo in validacijo

-- ============================================================================
-- FUNKCIJA: is_admin
-- Opis: Preveri ali je uporabnik administrator
-- ============================================================================
CREATE FUNCTION _app_internals.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = p_user_id 
      AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION _app_internals.is_admin IS 'Check if user is admin';

-- ============================================================================
-- FUNKCIJA: is_active_user
-- Opis: Preveri ali je uporabnik aktiven
-- ============================================================================
CREATE FUNCTION _app_internals.is_active_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles
    WHERE id = p_user_id 
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION _app_internals.is_active_user IS 'Check if user profile is active';

-- ============================================================================
-- FUNKCIJA: coach_can_access_team
-- Opis: Preveri ali ima trener dostop do selekcije
-- ============================================================================
CREATE FUNCTION _app_internals.coach_can_access_team(
  p_coach_id UUID,
  p_team_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_coaches tc
    JOIN public.teams t ON tc.team_id = t.id
    WHERE tc.coach_id = p_coach_id
      AND tc.team_id = p_team_id
      AND tc.is_active = true
      AND t.is_archived = false
  );
$$;

COMMENT ON FUNCTION _app_internals.coach_can_access_team IS 'Check if coach has access to team';

-- ============================================================================
-- FUNKCIJA: coach_can_be_head
-- Opis: Preveri ali sme biti trener glavni trener
-- ============================================================================
CREATE FUNCTION _app_internals.coach_can_be_head(
  p_coach_id UUID,
  p_team_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_coaches
    WHERE coach_id = p_coach_id
      AND team_id = p_team_id
      AND can_be_head_coach = true
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION _app_internals.coach_can_be_head IS 'Check if coach can be head coach';

-- ============================================================================
-- FUNKCIJA: coach_can_be_assistant
-- Opis: Preveri ali sme biti trener sotrener
-- ============================================================================
CREATE FUNCTION _app_internals.coach_can_be_assistant(
  p_coach_id UUID,
  p_team_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_coaches
    WHERE coach_id = p_coach_id
      AND team_id = p_team_id
      AND can_be_assistant = true
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION _app_internals.coach_can_be_assistant IS 'Check if coach can be assistant coach';

-- ============================================================================
-- FUNKCIJA: is_month_locked
-- Opis: Preveri ali je mesec zaklenjen za urejanje
-- ============================================================================
CREATE FUNCTION _app_internals.is_month_locked(p_date DATE)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT date_trunc('month', p_date AT TIME ZONE 'Europe/Ljubljana')::DATE 
    < date_trunc('month', (now() AT TIME ZONE 'Europe/Ljubljana'))::DATE;
$$;

COMMENT ON FUNCTION _app_internals.is_month_locked IS 'Check if month is locked (before current month in Europe/Ljubljana)';

-- ============================================================================
-- FUNKCIJA: is_activity_completed
-- Opis: Preveri ali je aktivnost zaključena
-- ============================================================================
CREATE FUNCTION _app_internals.is_activity_completed(p_activity_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT is_completed
  FROM public.activities
  WHERE id = p_activity_id;
$$;

COMMENT ON FUNCTION _app_internals.is_activity_completed IS 'Check if activity is completed';

-- ============================================================================
-- FUNKCIJA: is_month_locked_for_activity
-- Opis: Preveri ali je mesec aktivnosti zaklenjen
-- ============================================================================
CREATE FUNCTION _app_internals.is_month_locked_for_activity(p_activity_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT date_trunc('month', activity_date AT TIME ZONE 'Europe/Ljubljana')::DATE 
    < date_trunc('month', (now() AT TIME ZONE 'Europe/Ljubljana'))::DATE
  FROM public.activities
  WHERE id = p_activity_id;
$$;

COMMENT ON FUNCTION _app_internals.is_month_locked_for_activity IS 'Check if activity month is locked';

-- ============================================================================
-- FUNKCIJA: is_player_member_on_date
-- Opis: Preveri ali je igralec član selekcije na določen datum
-- ============================================================================
CREATE FUNCTION _app_internals.is_player_member_on_date(
  p_player_id UUID,
  p_team_id UUID,
  p_date DATE
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_players
    WHERE player_id = p_player_id
      AND team_id = p_team_id
      AND membership_status = 'active'
      AND (valid_from IS NULL OR valid_from <= p_date)
      AND (valid_to IS NULL OR valid_to >= p_date)
  );
$$;

COMMENT ON FUNCTION _app_internals.is_player_member_on_date IS 'Check if player is team member on specific date';

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION _app_internals.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION _app_internals.is_active_user TO authenticated;
GRANT EXECUTE ON FUNCTION _app_internals.coach_can_access_team TO authenticated;
GRANT EXECUTE ON FUNCTION _app_internals.coach_can_be_head TO authenticated;
GRANT EXECUTE ON FUNCTION _app_internals.coach_can_be_assistant TO authenticated;
GRANT EXECUTE ON FUNCTION _app_internals.is_month_locked TO authenticated;
GRANT EXECUTE ON FUNCTION _app_internals.is_activity_completed TO authenticated;
GRANT EXECUTE ON FUNCTION _app_internals.is_month_locked_for_activity TO authenticated;
GRANT EXECUTE ON FUNCTION _app_internals.is_player_member_on_date TO authenticated;