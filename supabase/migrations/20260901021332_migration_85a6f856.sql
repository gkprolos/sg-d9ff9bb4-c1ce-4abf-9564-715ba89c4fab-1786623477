-- Fix complete_activity_with_rates to use correct column names from coach_rates
DROP FUNCTION IF EXISTS public.complete_activity_with_rates(uuid);

CREATE OR REPLACE FUNCTION public.complete_activity_with_rates(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activity RECORD;
  v_main_coach_id uuid;
  v_user_id uuid := auth.uid();
  v_is_admin boolean;
  v_is_active boolean;
  v_month_locked boolean;
  v_missing_players text[];
  v_coach RECORD;
  v_rate RECORD;
  v_hours numeric;
  v_activity_amount numeric;
  v_mileage_amount numeric;
  v_total_amount numeric;
  v_rate_hourly numeric;
  v_rate_match numeric;
BEGIN
  -- Get current user info
  SELECT 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin'),
    EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND is_active = true)
  INTO v_is_admin, v_is_active;

  -- Check if user is active
  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Uporabnik ni aktiven';
  END IF;

  -- Get activity details
  SELECT 
    a.*,
    s.name as season_name,
    t.name as team_name
  INTO v_activity
  FROM public.activities a
  JOIN public.teams t ON a.team_id = t.id
  JOIN public.seasons s ON a.season_id = s.id
  WHERE a.id = p_activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aktivnost ne obstaja';
  END IF;

  -- Check if activity already completed
  IF v_activity.status = 'completed' THEN
    RAISE EXCEPTION 'Aktivnost je že zaključena';
  END IF;

  -- Get main coach
  SELECT coach_id INTO v_main_coach_id
  FROM public.activity_coaches
  WHERE activity_id = p_activity_id
    AND role = 'head_coach'
  LIMIT 1;

  -- Check permissions (only main coach or admin can complete)
  IF NOT v_is_admin AND (v_main_coach_id IS NULL OR v_main_coach_id != v_user_id) THEN
    RAISE EXCEPTION 'Samo glavni trener lahko zaključi aktivnost';
  END IF;

  -- Check if month is locked (cannot modify past months)
  v_month_locked := DATE_TRUNC('month', v_activity.activity_date) < DATE_TRUNC('month', CURRENT_DATE);
  IF v_month_locked AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Mesec % je zaklenjen za urejanje', TO_CHAR(v_activity.activity_date, 'YYYY-MM');
  END IF;

  -- Check attendance completeness
  SELECT array_agg(p.first_name || ' ' || p.last_name)
  INTO v_missing_players
  FROM public.team_players tp
  JOIN public.players p ON tp.player_id = p.id
  WHERE tp.team_id = v_activity.team_id
    AND tp.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.activity_id = p_activity_id
        AND ar.player_id = tp.player_id
    );

  IF array_length(v_missing_players, 1) > 0 THEN
    RAISE EXCEPTION 'Manjkajoča prisotnost za igralce: %', array_to_string(v_missing_players, ', ');
  END IF;

  -- Calculate hours
  v_hours := EXTRACT(EPOCH FROM (v_activity.end_time - v_activity.start_time)) / 3600.0;

  -- Process each coach on the activity
  FOR v_coach IN
    SELECT 
      ac.id as activity_coach_id,
      ac.coach_id,
      ac.role,
      ac.mileage_km,
      p.first_name || ' ' || p.last_name as coach_name
    FROM public.activity_coaches ac
    JOIN public.profiles p ON ac.coach_id = p.id
    WHERE ac.activity_id = p_activity_id
  LOOP
    -- Get coach rates for this season
    SELECT * INTO v_rate
    FROM public.coach_rates
    WHERE coach_id = v_coach.coach_id
      AND season_id = v_activity.season_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Manjkajoče finančne postavke za trenerja %', v_coach.coach_name;
    END IF;

    -- Determine rates based on role and activity type
    IF v_coach.role = 'head_coach' THEN
      -- Head coach rates - FIXED COLUMN NAMES
      CASE v_activity.activity_type_id
        WHEN 1 THEN 
          v_rate_hourly := v_rate.hourly_rate_type1_head;  -- Training in hall
          v_rate_match := NULL;
        WHEN 2 THEN 
          v_rate_hourly := v_rate.hourly_rate_type2_head;  -- Training outside/prep match
          v_rate_match := NULL;
        WHEN 3 THEN 
          v_rate_hourly := NULL;
          v_rate_match := v_rate.match_rate_type3_head;    -- Official match
        ELSE
          RAISE EXCEPTION 'Neveljaven tip aktivnosti';
      END CASE;
    ELSE
      -- Assistant coach rates - FIXED COLUMN NAMES
      CASE v_activity.activity_type_id
        WHEN 1 THEN 
          v_rate_hourly := v_rate.hourly_rate_type1_assistant;
          v_rate_match := NULL;
        WHEN 2 THEN 
          v_rate_hourly := v_rate.hourly_rate_type2_assistant;
          v_rate_match := NULL;
        WHEN 3 THEN 
          v_rate_hourly := NULL;
          v_rate_match := v_rate.match_rate_type3_assistant;
        ELSE
          RAISE EXCEPTION 'Neveljaven tip aktivnosti';
      END CASE;
    END IF;

    -- Calculate amounts
    IF v_activity.activity_type_id IN (1, 2) THEN
      -- Hourly rate for types 1 and 2
      v_activity_amount := v_hours * COALESCE(v_rate_hourly, 0);
    ELSE
      -- Fixed match rate for type 3
      v_activity_amount := COALESCE(v_rate_match, 0);
    END IF;

    -- Calculate mileage
    v_mileage_amount := COALESCE(v_coach.mileage_km, 0) * COALESCE(v_rate.rate_per_km, 0);
    
    v_total_amount := v_activity_amount + v_mileage_amount;

    -- Update activity_coaches with calculated amounts and rate snapshot
    UPDATE public.activity_coaches
    SET 
      hours_worked = v_hours,
      activity_amount = v_activity_amount,
      mileage_amount = v_mileage_amount,
      -- Save rate snapshot
      hourly_rate_used = v_rate_hourly,
      match_rate_used = v_rate_match,
      rate_per_km_used = v_rate.rate_per_km,
      updated_at = NOW()
    WHERE id = v_coach.activity_coach_id;

  END LOOP;

  -- Mark activity as completed
  UPDATE public.activities
  SET 
    status = 'completed',
    updated_at = NOW(),
    updated_by = v_user_id
  WHERE id = p_activity_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Aktivnost uspešno zaključena in obračunana'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.complete_activity_with_rates(uuid) IS
  'Complete activity attendance and calculate amounts for all coaches. Uses correct column names: hourly_rate_type1_head, hourly_rate_type1_assistant, etc.';