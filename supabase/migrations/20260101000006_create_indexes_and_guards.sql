-- Migracija 6: Indeksi in zaščitni triggerji
-- Datum: 2026-08-13
-- Opis: Performance indeksi in preprečevanje neveljavnih podatkov

-- ============================================================================
-- INDEKSI ZA PERFORMANCO
-- ============================================================================

-- profiles
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active) WHERE is_active = true;

-- user_roles
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- seasons
CREATE INDEX idx_seasons_is_active ON public.seasons(is_active) WHERE is_active = true;
CREATE INDEX idx_seasons_dates ON public.seasons(start_date, end_date);

-- teams
CREATE INDEX idx_teams_season_id ON public.teams(season_id);
CREATE INDEX idx_teams_is_archived ON public.teams(is_archived) WHERE is_archived = false;

-- players
CREATE INDEX idx_players_is_active ON public.players(is_active) WHERE is_active = true;
CREATE INDEX idx_players_name ON public.players(last_name, first_name);

-- team_players
CREATE INDEX idx_team_players_team_id ON public.team_players(team_id);
CREATE INDEX idx_team_players_player_id ON public.team_players(player_id);
CREATE INDEX idx_team_players_membership ON public.team_players(membership_status) WHERE membership_status = 'active';
CREATE INDEX idx_team_players_validity ON public.team_players(valid_from, valid_to);

-- team_coaches
CREATE INDEX idx_team_coaches_team_id ON public.team_coaches(team_id);
CREATE INDEX idx_team_coaches_coach_id ON public.team_coaches(coach_id);
CREATE INDEX idx_team_coaches_active ON public.team_coaches(is_active) WHERE is_active = true;

-- schedule_templates
CREATE INDEX idx_schedule_team_day ON public.schedule_templates(team_id, day_of_week);
CREATE INDEX idx_schedule_validity ON public.schedule_templates(valid_from, valid_to);

-- activities
CREATE INDEX idx_activities_team_date ON public.activities(team_id, activity_date);
CREATE INDEX idx_activities_season_id ON public.activities(season_id);
CREATE INDEX idx_activities_date ON public.activities(activity_date);
CREATE INDEX idx_activities_completed ON public.activities(is_completed);

-- activity_coaches
CREATE INDEX idx_activity_coaches_activity_id ON public.activity_coaches(activity_id);
CREATE INDEX idx_activity_coaches_coach_id ON public.activity_coaches(coach_id);

-- attendance_records
CREATE INDEX idx_attendance_activity_id ON public.attendance_records(activity_id);
CREATE INDEX idx_attendance_player_id ON public.attendance_records(player_id);

-- coach_rates
CREATE INDEX idx_coach_rates_coach_season ON public.coach_rates(coach_id, season_id);

-- audit_log
CREATE INDEX idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON public.audit_log(created_at DESC);

-- ============================================================================
-- ZAŠČITNI TRIGGER: Prepreči prekrivanje urnikov
-- ============================================================================
CREATE OR REPLACE FUNCTION _app_internals.prevent_schedule_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Preveri prekrivanje za isto selekcijo, dan, in aktivno obdobje
  IF EXISTS (
    SELECT 1 FROM public.schedule_templates
    WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND team_id = NEW.team_id
      AND day_of_week = NEW.day_of_week
      AND is_active = true
      AND (
        -- Obe obdobji sta odprti (obe NULL valid_to)
        (valid_to IS NULL AND NEW.valid_to IS NULL)
        OR
        -- Prekrivanje z odprtim obdobjem
        (valid_to IS NULL AND NEW.valid_from <= COALESCE(NEW.valid_to, '9999-12-31'::DATE))
        OR
        (NEW.valid_to IS NULL AND valid_from <= COALESCE(valid_to, '9999-12-31'::DATE))
        OR
        -- Prekrivanje zaprtih obdobij
        (
          valid_from <= COALESCE(NEW.valid_to, '9999-12-31'::DATE)
          AND COALESCE(valid_to, '9999-12-31'::DATE) >= NEW.valid_from
        )
      )
  ) THEN
    RAISE EXCEPTION 'Urnik za to selekcijo in dan že obstaja v prekrivajočem se obdobju';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_schedule_overlap
  BEFORE INSERT OR UPDATE ON public.schedule_templates
  FOR EACH ROW EXECUTE FUNCTION _app_internals.prevent_schedule_overlap();

-- ============================================================================
-- ZAŠČITNI TRIGGER: Prepreči prekrivanje članstev
-- ============================================================================
CREATE OR REPLACE FUNCTION _app_internals.prevent_membership_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Preveri prekrivanje za istega igralca v isti selekciji
  IF EXISTS (
    SELECT 1 FROM public.team_players
    WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND team_id = NEW.team_id
      AND player_id = NEW.player_id
      AND (
        -- Obe obdobji sta odprti
        (valid_to IS NULL AND NEW.valid_to IS NULL)
        OR
        -- Prekrivanje z odprtim obdobjem
        (valid_to IS NULL AND NEW.valid_from <= COALESCE(NEW.valid_to, '9999-12-31'::DATE))
        OR
        (NEW.valid_to IS NULL AND valid_from <= COALESCE(valid_to, '9999-12-31'::DATE))
        OR
        -- Prekrivanje zaprtih obdobij
        (
          valid_from <= COALESCE(NEW.valid_to, '9999-12-31'::DATE)
          AND COALESCE(valid_to, '9999-12-31'::DATE) >= NEW.valid_from
        )
      )
  ) THEN
    RAISE EXCEPTION 'Igralec je že član te selekcije v prekrivajočem se obdobju';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_membership_overlap
  BEFORE INSERT OR UPDATE ON public.team_players
  FOR EACH ROW EXECUTE FUNCTION _app_internals.prevent_membership_overlap();

-- ============================================================================
-- ZAŠČITNI TRIGGER: Prepreči spreminjanje zaključenih aktivnosti
-- ============================================================================
CREATE OR REPLACE FUNCTION _app_internals.prevent_completed_activity_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Admin lahko vse
  IF _app_internals.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Če je aktivnost zaključena, prepreči spremembe
  IF OLD.is_completed = true THEN
    RAISE EXCEPTION 'Ne morete spreminjati zaključene aktivnosti';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_completed_activity
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION _app_internals.prevent_completed_activity_modification();

-- ============================================================================
-- ZAŠČITNI TRIGGER: Prepreči spreminjanje finančnih snapshots
-- ============================================================================
CREATE OR REPLACE FUNCTION _app_internals.prevent_rate_snapshot_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Admin lahko vse
  IF _app_internals.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Če obstajajo snapshoti, jih običajni uporabnik ne sme spreminjati
  IF OLD.rate_type1_per_hour IS NOT NULL OR
     OLD.rate_type2_per_hour IS NOT NULL OR
     OLD.rate_type3_fixed IS NOT NULL OR
     OLD.rate_per_km IS NOT NULL OR
     OLD.activity_amount IS NOT NULL OR
     OLD.mileage_amount IS NOT NULL OR
     OLD.total_amount IS NOT NULL THEN
    
    -- Preveri, če se poskuša spremeniti katerikoli finančni podatek
    IF NEW.rate_type1_per_hour IS DISTINCT FROM OLD.rate_type1_per_hour OR
       NEW.rate_type2_per_hour IS DISTINCT FROM OLD.rate_type2_per_hour OR
       NEW.rate_type3_fixed IS DISTINCT FROM OLD.rate_type3_fixed OR
       NEW.rate_per_km IS DISTINCT FROM OLD.rate_per_km OR
       NEW.activity_amount IS DISTINCT FROM OLD.activity_amount OR
       NEW.mileage_amount IS DISTINCT FROM OLD.mileage_amount OR
       NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
      
      RAISE EXCEPTION 'Ne morete spreminjati finančnih podatkov obračunane aktivnosti';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_rate_snapshots
  BEFORE UPDATE ON public.activity_coaches
  FOR EACH ROW EXECUTE FUNCTION _app_internals.prevent_rate_snapshot_modification();

-- ============================================================================
-- ZAŠČITNI TRIGGER: Prepreči spreminjanje audit_log
-- ============================================================================
CREATE OR REPLACE FUNCTION _app_internals.prevent_audit_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Revizijska sled je nespremenljiva';
END;
$$;

CREATE TRIGGER guard_audit_immutable_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION _app_internals.prevent_audit_modification();

CREATE TRIGGER guard_audit_immutable_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION _app_internals.prevent_audit_modification();

COMMENT ON FUNCTION _app_internals.prevent_schedule_overlap IS 'Prevents overlapping schedule templates';
COMMENT ON FUNCTION _app_internals.prevent_membership_overlap IS 'Prevents overlapping team memberships';
COMMENT ON FUNCTION _app_internals.prevent_completed_activity_modification IS 'Protects completed activities from modification';
COMMENT ON FUNCTION _app_internals.prevent_rate_snapshot_modification IS 'Protects financial snapshots from tampering';
COMMENT ON FUNCTION _app_internals.prevent_audit_modification IS 'Makes audit log immutable';