-- Drop and recreate complete_activity_with_rates with proper schema qualification
DROP FUNCTION IF EXISTS public.complete_activity_with_rates(uuid);

CREATE OR REPLACE FUNCTION public.complete_activity_with_rates(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activity_type_id integer;
  v_start_time time;
  v_end_time time;
  v_hours_worked numeric;
  v_coach record;
  v_rate record;
  v_amount numeric;
BEGIN
  -- Get activity details with proper schema
  SELECT activity_type_id, start_time, end_time
  INTO v_activity_type_id, v_start_time, v_end_time
  FROM public.activities
  WHERE id = p_activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activity not found';
  END IF;

  -- Calculate hours worked
  IF v_start_time IS NOT NULL AND v_end_time IS NOT NULL THEN
    v_hours_worked := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 3600.0;
  ELSE
    v_hours_worked := 0;
  END IF;

  -- Update each activity_coaches record with proper schema
  FOR v_coach IN 
    SELECT 
      ac.id,
      ac.coach_id,
      ac.role,
      ac.mileage_km,
      a.season_id
    FROM public.activity_coaches ac
    JOIN public.activities a ON a.id = ac.activity_id
    WHERE ac.activity_id = p_activity_id
  LOOP
    -- Get coach rates for this season with proper schema
    SELECT *
    INTO v_rate
    FROM public.coach_rates
    WHERE coach_id = v_coach.coach_id
      AND season_id = v_coach.season_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No rates found for coach % in this season', v_coach.coach_id;
    END IF;

    -- Calculate amount based on activity type and role
    IF v_activity_type_id = 3 THEN
      -- Match pricing: use match_rate (no role distinction for matches)
      v_amount := COALESCE(v_rate.match_rate, 0);
    ELSE
      -- Training/practice: use role-specific hourly rate
      IF v_coach.role = 'head' THEN
        IF v_activity_type_id = 1 THEN
          v_amount := v_hours_worked * COALESCE(v_rate.head_hourly_rate_type1, 0);
        ELSE -- type 2
          v_amount := v_hours_worked * COALESCE(v_rate.head_hourly_rate_type2, 0);
        END IF;
      ELSE -- assistant role
        IF v_activity_type_id = 1 THEN
          v_amount := v_hours_worked * COALESCE(v_rate.assistant_hourly_rate_type1, 0);
        ELSE -- type 2
          v_amount := v_hours_worked * COALESCE(v_rate.assistant_hourly_rate_type2, 0);
        END IF;
      END IF;
    END IF;

    -- Add mileage amount
    IF v_coach.mileage_km IS NOT NULL AND v_coach.mileage_km > 0 THEN
      v_amount := v_amount + (v_coach.mileage_km * COALESCE(v_rate.mileage_rate, 0));
    END IF;

    -- Update activity_coaches record with proper schema
    UPDATE public.activity_coaches
    SET 
      hours_worked = v_hours_worked,
      total_amount = v_amount,
      updated_at = now()
    WHERE id = v_coach.id;
  END LOOP;

  -- Mark activity as completed with proper schema
  UPDATE public.activities
  SET 
    status = 'completed',
    updated_at = now()
  WHERE id = p_activity_id;

  RETURN jsonb_build_object(
    'success', true,
    'activity_id', p_activity_id,
    'hours_worked', v_hours_worked
  );
END;
$$;

COMMENT ON FUNCTION public.complete_activity_with_rates(uuid) IS
  'Complete activity attendance and calculate amounts for all coaches based on their rates';