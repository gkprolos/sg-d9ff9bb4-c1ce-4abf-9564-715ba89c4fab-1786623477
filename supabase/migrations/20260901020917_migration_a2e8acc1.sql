-- Drop and recreate complete_activity_with_rates WITH ALL VALIDATIONS
-- Replace _app_internals functions with direct SQL checks
DROP FUNCTION IF EXISTS public.complete_activity_with_rates(uuid);

CREATE OR REPLACE FUNCTION public.complete_activity_with_rates(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_activity RECORD;
  v_coach RECORD;
  v_rates RECORD;
  v_missing_players TEXT[];
  v_hours NUMERIC;
  v_activity_amount NUMERIC;
  v_mileage_amount NUMERIC;
  v_total_amount NUMERIC;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Niste prijavljeni');
  END IF;

  -- Check if user is active (direct query instead of _app_internals.is_active_user)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vaš uporabniški račun ni aktiven');
  END IF;

  -- Check if user is admin (direct query instead of _app_internals.is_admin)
  v_is_admin := EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id AND role = 'admin'
  );

  -- 1. CHECK ACTIVITY EXISTS
  SELECT * INTO v_activity
  FROM public.activities
  WHERE id = p_activity_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aktivnost ne obstaja');
  END IF;

  IF v_activity.is_completed AND NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aktivnost je že zaključena');
  END IF;

  -- 2. CHECK PERMISSION - ONLY HEAD COACH OR ADMIN
  IF NOT v_is_admin THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.activity_coaches
      WHERE activity_id = p_activity_id
        AND coach_id = v_user_id
        AND role = 'head'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Samo glavni trener lahko zaključi aktivnost');
    END IF;
  END IF;

  -- 3. CHECK MONTH LOCKED (direct query instead of _app_internals.is_month_locked)
  IF NOT v_is_admin THEN
    -- Month is locked if activity_date is before first day of current month
    IF DATE_TRUNC('month', v_activity.activity_date) < DATE_TRUNC('month', CURRENT_DATE) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Mesec %s je zaklenjen', to_char(v_activity.activity_date, 'YYYY-MM'))
      );
    END IF;
  END IF;

  -- 4. CHECK ATTENDANCE COMPLETENESS
  SELECT array_agg(p.first_name || ' ' || p.last_name)
  INTO v_missing_players
  FROM public.team_players tp
  JOIN public.players p ON tp.player_id = p.id
  WHERE tp.team_id = v_activity.team_id
    AND tp.membership_status = 'active'
    AND (tp.valid_from IS NULL OR tp.valid_from <= v_activity.activity_date)
    AND (tp.valid_to IS NULL OR tp.valid_to >= v_activity.activity_date)
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.activity_id = p_activity_id
        AND ar.player_id = tp.player_id
    );

  IF array_length(v_missing_players, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Manjkajoča prisotnost',
      'missing_players', v_missing_players
    );
  END IF;

  -- 5. CALCULATE FOR EACH COACH
  FOR v_coach IN
    SELECT *
    FROM public.activity_coaches
    WHERE activity_id = p_activity_id
  LOOP
    -- Get rates for this coach
    SELECT * INTO v_rates
    FROM public.coach_rates
    WHERE coach_id = v_coach.coach_id
      AND season_id = v_activity.season_id
      AND is_active = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Trener %s nima veljavnih postavk za to sezono', 
          (SELECT full_name FROM public.profiles WHERE id = v_coach.coach_id))
      );
    END IF;

    -- Check required rates
    IF v_coach.role = 'head' THEN
      IF v_activity.activity_type_id = 1 AND v_rates.head_type1_per_hour IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Manjka postavka head_type1_per_hour');
      ELSIF v_activity.activity_type_id = 2 AND v_rates.head_type2_per_hour IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Manjka postavka head_type2_per_hour');
      ELSIF v_activity.activity_type_id = 3 AND v_rates.head_type3_fixed IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Manjka postavka head_type3_fixed');
      END IF;
    ELSE -- assistant
      IF v_activity.activity_type_id = 1 AND v_rates.assistant_type1_per_hour IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Manjka postavka assistant_type1_per_hour');
      ELSIF v_activity.activity_type_id = 2 AND v_rates.assistant_type2_per_hour IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Manjka postavka assistant_type2_per_hour');
      ELSIF v_activity.activity_type_id = 3 AND v_rates.assistant_type3_fixed IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Manjka postavka assistant_type3_fixed');
      END IF;
    END IF;

    IF v_rates.rate_per_km IS NULL AND v_coach.mileage_km > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Manjka postavka rate_per_km');
    END IF;

    -- CALCULATE HOURS
    v_hours := ROUND(EXTRACT(EPOCH FROM (v_activity.end_time - v_activity.start_time)) / 3600.0, 2);

    -- CALCULATE ACTIVITY AMOUNT
    IF v_activity.activity_type_id = 1 THEN
      v_activity_amount := ROUND(v_hours * CASE 
        WHEN v_coach.role = 'head' THEN v_rates.head_type1_per_hour
        ELSE v_rates.assistant_type1_per_hour
      END, 2);
    ELSIF v_activity.activity_type_id = 2 THEN
      v_activity_amount := ROUND(v_hours * CASE 
        WHEN v_coach.role = 'head' THEN v_rates.head_type2_per_hour
        ELSE v_rates.assistant_type2_per_hour
      END, 2);
    ELSE -- type 3
      v_activity_amount := CASE 
        WHEN v_coach.role = 'head' THEN v_rates.head_type3_fixed
        ELSE v_rates.assistant_type3_fixed
      END;
    END IF;

    -- CALCULATE MILEAGE AMOUNT
    v_mileage_amount := ROUND(COALESCE(v_coach.mileage_km, 0) * COALESCE(v_rates.rate_per_km, 0), 2);
    v_total_amount := v_activity_amount + v_mileage_amount;

    -- SAVE SNAPSHOT TO ACTIVITY_COACHES
    UPDATE public.activity_coaches
    SET
      rate_type1_per_hour = CASE WHEN v_coach.role = 'head' THEN v_rates.head_type1_per_hour ELSE v_rates.assistant_type1_per_hour END,
      rate_type2_per_hour = CASE WHEN v_coach.role = 'head' THEN v_rates.head_type2_per_hour ELSE v_rates.assistant_type2_per_hour END,
      rate_type3_fixed = CASE WHEN v_coach.role = 'head' THEN v_rates.head_type3_fixed ELSE v_rates.assistant_type3_fixed END,
      rate_per_km = v_rates.rate_per_km,
      hours_worked = v_hours,
      activity_amount = v_activity_amount,
      mileage_amount = v_mileage_amount,
      total_amount = v_total_amount,
      updated_at = now()
    WHERE activity_id = p_activity_id
      AND coach_id = v_coach.coach_id;
  END LOOP;

  -- 6. MARK ACTIVITY AS COMPLETED
  UPDATE public.activities
  SET is_completed = true,
      completed_at = now(),
      completed_by = v_user_id,
      updated_at = now()
  WHERE id = p_activity_id;

  RETURN jsonb_build_object('success', true, 'message', 'Aktivnost uspešno zaključena in obračunana');
END;
$$;

COMMENT ON FUNCTION public.complete_activity_with_rates(uuid) IS
  'Complete activity and calculate amounts for all coaches. Validates: user active, permissions, month lock, attendance completeness, rates. Replaces _app_internals functions with direct SQL checks.';