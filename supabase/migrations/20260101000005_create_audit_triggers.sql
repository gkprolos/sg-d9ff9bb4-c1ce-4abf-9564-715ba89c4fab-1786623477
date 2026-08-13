-- Migracija 5: Audit Triggerji
-- Datum: 2026-08-13
-- Opis: Nespremenljiva revizijska sled za vse pomembne tabele

-- ============================================================================
-- AUDIT TRIGGER FUNKCIJA
-- ============================================================================
CREATE OR REPLACE FUNCTION _app_internals.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_correction_request_id UUID;
  v_correction_reason TEXT;
BEGIN
  -- Pridobi podatke o uporabniku
  v_user_id := auth.uid();
  
  SELECT full_name INTO v_user_name
  FROM public.profiles
  WHERE id = v_user_id;

  -- Preveri transakcijski kontekst za popravek
  BEGIN
    v_correction_request_id := current_setting('app.correction_request_id', true)::UUID;
    v_correction_reason := current_setting('app.correction_reason', true);
  EXCEPTION
    WHEN OTHERS THEN
      v_correction_request_id := NULL;
      v_correction_reason := NULL;
  END;

  -- INSERT
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (
      table_name,
      record_id,
      operation,
      old_values,
      new_values,
      user_id,
      user_name,
      correction_request_id,
      correction_reason
    ) VALUES (
      TG_TABLE_NAME,
      (to_jsonb(NEW) ->> 'id')::UUID,
      'INSERT',
      NULL,
      to_jsonb(NEW),
      v_user_id,
      v_user_name,
      v_correction_request_id,
      v_correction_reason
    );
    RETURN NEW;
  
  -- UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (
      table_name,
      record_id,
      operation,
      old_values,
      new_values,
      user_id,
      user_name,
      correction_request_id,
      correction_reason
    ) VALUES (
      TG_TABLE_NAME,
      (to_jsonb(OLD) ->> 'id')::UUID,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      v_user_id,
      v_user_name,
      v_correction_request_id,
      v_correction_reason
    );
    RETURN NEW;
  
  -- DELETE
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (
      table_name,
      record_id,
      operation,
      old_values,
      new_values,
      user_id,
      user_name,
      correction_request_id,
      correction_reason
    ) VALUES (
      TG_TABLE_NAME,
      (to_jsonb(OLD) ->> 'id')::UUID,
      'DELETE',
      to_jsonb(OLD),
      NULL,
      v_user_id,
      v_user_name,
      v_correction_request_id,
      v_correction_reason
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION _app_internals.audit_trigger IS 'Audit trigger function for all critical tables';

-- ============================================================================
-- AUDIT TRIGGERJI ZA VSE POMEMBNE TABELE
-- ============================================================================

-- profiles
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- user_roles
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- seasons
CREATE TRIGGER audit_seasons
  AFTER INSERT OR UPDATE OR DELETE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- teams
CREATE TRIGGER audit_teams
  AFTER INSERT OR UPDATE OR DELETE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- venues
CREATE TRIGGER audit_venues
  AFTER INSERT OR UPDATE OR DELETE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- players
CREATE TRIGGER audit_players
  AFTER INSERT OR UPDATE OR DELETE ON public.players
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- guardians
CREATE TRIGGER audit_guardians
  AFTER INSERT OR UPDATE OR DELETE ON public.guardians
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- player_guardians
CREATE TRIGGER audit_player_guardians
  AFTER INSERT OR UPDATE OR DELETE ON public.player_guardians
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- team_players
CREATE TRIGGER audit_team_players
  AFTER INSERT OR UPDATE OR DELETE ON public.team_players
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- team_coaches
CREATE TRIGGER audit_team_coaches
  AFTER INSERT OR UPDATE OR DELETE ON public.team_coaches
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- schedule_templates
CREATE TRIGGER audit_schedule_templates
  AFTER INSERT OR UPDATE OR DELETE ON public.schedule_templates
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- activities
CREATE TRIGGER audit_activities
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- activity_coaches
CREATE TRIGGER audit_activity_coaches
  AFTER INSERT OR UPDATE OR DELETE ON public.activity_coaches
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- attendance_records
CREATE TRIGGER audit_attendance_records
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- form_types
CREATE TRIGGER audit_form_types
  AFTER INSERT OR UPDATE OR DELETE ON public.form_types
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- player_forms
CREATE TRIGGER audit_player_forms
  AFTER INSERT OR UPDATE OR DELETE ON public.player_forms
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- coach_rates
CREATE TRIGGER audit_coach_rates
  AFTER INSERT OR UPDATE OR DELETE ON public.coach_rates
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

-- correction_requests
CREATE TRIGGER audit_correction_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.correction_requests
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger();

COMMENT ON TRIGGER audit_profiles ON public.profiles IS 'Audit trail for profile changes';
COMMENT ON TRIGGER audit_activities ON public.activities IS 'Audit trail for activity changes';
COMMENT ON TRIGGER audit_attendance_records ON public.attendance_records IS 'Audit trail for attendance changes';