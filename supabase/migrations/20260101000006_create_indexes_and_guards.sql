-- Migracija 6: Indeksi in zaščitni triggerji
-- Datum: 2026-08-13
-- Opis: Performance indeksi, zaščita pred prekrivanjem urnikov/članstev, zaščita stolpcev

SET search_path = public, pg_catalog;

-- ============================================================================
-- INDEKSI ZA PERFORMANCE
-- ============================================================================

-- Aktivnosti
CREATE INDEX idx_activities_team_date ON activities(team_id, activity_date);
CREATE INDEX idx_activities_completed ON activities(is_completed) WHERE is_completed = false;
CREATE INDEX idx_activities_season ON activities(season_id);

-- Prisotnost
CREATE INDEX idx_attendance_activity ON attendance_records(activity_id);
CREATE INDEX idx_attendance_player ON attendance_records(player_id);

-- Trenerji aktivnosti
CREATE INDEX idx_activity_coaches_activity ON activity_coaches(activity_id);
CREATE INDEX idx_activity_coaches_coach ON activity_coaches(coach_id);

-- Igralci in članstva
CREATE INDEX idx_team_players_team ON team_players(team_id);
CREATE INDEX idx_team_players_player ON team_players(player_id);
CREATE INDEX idx_team_players_valid ON team_players(valid_from, valid_to);

-- Trenerji selekcij
CREATE INDEX idx_team_coaches_team ON team_coaches(team_id);
CREATE INDEX idx_team_coaches_coach ON team_coaches(coach_id);

-- Urniki
CREATE INDEX idx_schedule_team_day ON schedule_templates(team_id, day_of_week);
CREATE INDEX idx_schedule_valid ON schedule_templates(valid_from, valid_to);

-- Ceniki
CREATE INDEX idx_coach_rates_coach_season ON coach_rates(coach_id, season_id);

-- Revizijska sled
CREATE INDEX idx_audit_table ON audit_log(table_name);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_record ON audit_log(table_name, record_id);

-- ============================================================================
-- ZAŠČITNI TRIGGERJI ZA STOLPCE
-- ============================================================================

-- Prepreči spreminjanje kritičnih stolpcev v activity_coaches
CREATE OR REPLACE FUNCTION _app_internals.prevent_activity_coaches_column_changes()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prepreči spreminjanje identifikatorjev
  IF OLD.activity_id IS DISTINCT FROM NEW.activity_id THEN
    RAISE EXCEPTION 'Spreminjanje activity_id ni dovoljeno';
  END IF;
  
  IF OLD.coach_id IS DISTINCT FROM NEW.coach_id THEN
    RAISE EXCEPTION 'Spreminjanje coach_id ni dovoljeno';
  END IF;
  
  -- Prepreči spreminjanje vloge (razen če je admin)
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT _app_internals.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Spreminjanje vloge ni dovoljeno';
    END IF;
  END IF;
  
  -- Prepreči spreminjanje finančnih snapshots (razen če je admin)
  IF OLD.rate_snapshot IS DISTINCT FROM NEW.rate_snapshot OR
     OLD.activity_amount IS DISTINCT FROM NEW.activity_amount OR
     OLD.mileage_amount IS DISTINCT FROM NEW.mileage_amount OR
     OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
    IF NOT _app_internals.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Spreminjanje finančnih podatkov ni dovoljeno';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_activity_coaches_column_changes
  BEFORE UPDATE ON activity_coaches
  FOR EACH ROW
  EXECUTE FUNCTION _app_internals.prevent_activity_coaches_column_changes();

-- Prepreči spreminjanje kritičnih stolpcev v attendance_records
CREATE OR REPLACE FUNCTION _app_internals.prevent_attendance_column_changes()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prepreči spreminjanje identifikatorjev
  IF OLD.activity_id IS DISTINCT FROM NEW.activity_id THEN
    RAISE EXCEPTION 'Spreminjanje activity_id ni dovoljeno';
  END IF;
  
  IF OLD.player_id IS DISTINCT FROM NEW.player_id THEN
    RAISE EXCEPTION 'Spreminjanje player_id ni dovoljeno';
  END IF;
  
  -- Prepreči spreminjanje prvotnega vnašalca in časa
  IF OLD.recorded_by IS DISTINCT FROM NEW.recorded_by THEN
    RAISE EXCEPTION 'Spreminjanje recorded_by ni dovoljeno';
  END IF;
  
  IF OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Spreminjanje created_at ni dovoljeno';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_attendance_column_changes
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION _app_internals.prevent_attendance_column_changes();

-- Prepreči spreminjanje kritičnih stolpcev v activities
CREATE OR REPLACE FUNCTION _app_internals.prevent_activity_column_changes()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prepreči spreminjanje sezone (mora biti konsistentna s team_id)
  IF OLD.season_id IS DISTINCT FROM NEW.season_id THEN
    RAISE EXCEPTION 'Spreminjanje season_id ni dovoljeno';
  END IF;
  
  -- Prepreči spreminjanje team_id
  IF OLD.team_id IS DISTINCT FROM NEW.team_id THEN
    RAISE EXCEPTION 'Spreminjanje team_id ni dovoljeno';
  END IF;
  
  -- Prepreči spreminjanje datuma
  IF OLD.activity_date IS DISTINCT FROM NEW.activity_date THEN
    IF NOT _app_internals.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Spreminjanje datuma ni dovoljeno';
    END IF;
  END IF;
  
  -- Prepreči spreminjanje created_by
  IF OLD.created_by IS DISTINCT FROM NEW.created_by THEN
    RAISE EXCEPTION 'Spreminjanje created_by ni dovoljeno';
  END IF;
  
  -- Prepreči spreminjanje created_at
  IF OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Spreminjanje created_at ni dovoljeno';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_activity_column_changes
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION _app_internals.prevent_activity_column_changes();

-- ============================================================================
-- ZAŠČITA PRED PREKRIVAJOČIMI SE URNIKI
-- ============================================================================

CREATE OR REPLACE FUNCTION _app_internals.prevent_overlapping_schedules()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  v_conflict_count INTEGER;
BEGIN
  -- Preveri prekrivanje samo za aktivne urnike
  IF NEW.is_active = true THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.schedule_templates
    WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND team_id = NEW.team_id
      AND day_of_week = NEW.day_of_week
      AND is_active = true
      AND (
        -- Prekrivanje veljavnosti
        (valid_from, COALESCE(valid_to, 'infinity'::DATE)) OVERLAPS 
        (NEW.valid_from, COALESCE(NEW.valid_to, 'infinity'::DATE))
      )
      AND (
        -- Prekrivanje časa
        (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
      );
    
    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Urnik se prekriva z obstoječim urnikom za isto selekcijo in dan';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_overlapping_schedules
  BEFORE INSERT OR UPDATE ON schedule_templates
  FOR EACH ROW
  EXECUTE FUNCTION _app_internals.prevent_overlapping_schedules();

-- ============================================================================
-- ZAŠČITA PRED PREKRIVAJOČIMI SE ČLANSTVI
-- ============================================================================

CREATE OR REPLACE FUNCTION _app_internals.prevent_overlapping_memberships()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  v_conflict_count INTEGER;
BEGIN
  -- Preveri prekrivanje samo za isto selekcijo in istega igralca
  SELECT COUNT(*) INTO v_conflict_count
  FROM public.team_players
  WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND team_id = NEW.team_id
    AND player_id = NEW.player_id
    AND (
      (valid_from, COALESCE(valid_to, 'infinity'::DATE)) OVERLAPS 
      (NEW.valid_from, COALESCE(NEW.valid_to, 'infinity'::DATE))
    );
  
  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Članstvo se prekriva z obstoječim članstvom za istega igralca v isti selekciji';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_overlapping_memberships
  BEFORE INSERT OR UPDATE ON team_players
  FOR EACH ROW
  EXECUTE FUNCTION _app_internals.prevent_overlapping_memberships();

-- ============================================================================
-- ZAŠČITA NESPREMENLJIVOSTI REVIZIJSKE SLEDI
-- ============================================================================

CREATE OR REPLACE FUNCTION _app_internals.prevent_audit_modification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Revizijska sled je nespremenljiva';
END;
$$;

CREATE TRIGGER prevent_audit_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION _app_internals.prevent_audit_modification();

CREATE TRIGGER prevent_audit_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION _app_internals.prevent_audit_modification();

-- ============================================================================
-- KOMENTAR
-- ============================================================================

COMMENT ON FUNCTION _app_internals.prevent_activity_coaches_column_changes IS 'Prevents modification of critical columns in activity_coaches';
COMMENT ON FUNCTION _app_internals.prevent_attendance_column_changes IS 'Prevents modification of critical columns in attendance_records';
COMMENT ON FUNCTION _app_internals.prevent_activity_column_changes IS 'Prevents modification of critical columns in activities';
COMMENT ON FUNCTION _app_internals.prevent_overlapping_schedules IS 'Prevents overlapping schedule templates';
COMMENT ON FUNCTION _app_internals.prevent_overlapping_memberships IS 'Prevents overlapping team memberships';
COMMENT ON FUNCTION _app_internals.prevent_audit_modification IS 'Makes audit log immutable';