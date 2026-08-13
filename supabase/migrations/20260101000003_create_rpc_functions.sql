-- Migracija 3: RPC funkcije
-- Datum: 2026-08-13
-- Opis: Javne RPC funkcije za poslovne operacije

-- ============================================================================
-- FUNKCIJA: create_or_open_activity
-- Opis: Atomsko ustvarjanje ali odpiranje aktivnosti
-- ============================================================================
CREATE FUNCTION public.create_or_open_activity(
  p_team_id UUID,
  p_activity_date DATE,
  p_activity_type_id INT DEFAULT NULL,
  p_venue_id UUID DEFAULT NULL,
  p_custom_venue TEXT DEFAULT NULL,
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL,
  p_is_home_game BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_coach_id UUID;
  v_team RECORD;
  v_template RECORD;
  v_activity_id UUID;
  v_existing_activity RECORD;
  v_role TEXT;
BEGIN
  -- 1. IDENTITETA IZ auth.uid()
  v_coach_id := auth.uid();
  IF v_coach_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Niste prijavljeni');
  END IF;

  -- 2. PREVERI AKTIVEN TRENER
  IF NOT _app_internals.is_active_user(v_coach_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vaš uporabniški račun ni aktiven');
  END IF;

  -- 3. PREVERI SELEKCIJO IN SEZONO
  SELECT t.*, s.id as season_id, s.start_date, s.end_date, s.is_archived as season_archived
  INTO v_team
  FROM public.teams t
  JOIN public.seasons s ON t.season_id = s.id
  WHERE t.id = p_team_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selekcija ne obstaja');
  END IF;

  IF v_team.is_archived THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selekcija je arhivirana');
  END IF;

  IF v_team.season_archived THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sezona je arhivirana');
  END IF;

  -- 4. PREVERI DATUM ZNOTRAJ SEZONE
  IF p_activity_date < v_team.start_date OR p_activity_date > v_team.end_date THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Datum mora biti znotraj sezone %s - %s', v_team.start_date, v_team.end_date)
    );
  END IF;

  -- 5. PREVERI ZAKLENJEN MESEC
  IF _app_internals.is_month_locked(p_activity_date) AND NOT _app_internals.is_admin(v_coach_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Mesec %s je zaklenjen za urejanje', to_char(p_activity_date, 'YYYY-MM'))
    );
  END IF;

  -- 6. PREVERI DOVOLJENJE TRENERJA
  IF NOT _app_internals.coach_can_access_team(v_coach_id, p_team_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nimate dostopa do te selekcije');
  END IF;

  -- 7. PREVERI OBSTOJ AKTIVNOSTI
  SELECT * INTO v_existing_activity
  FROM public.activities
  WHERE team_id = p_team_id
    AND season_id = v_team.season_id
    AND activity_date = p_activity_date;

  IF FOUND THEN
    -- AKTIVNOST ŽE OBSTAJA
    IF v_existing_activity.is_completed THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Aktivnost je že zaključena in je ni mogoče urejati. Za popravek kontaktirajte administratorja.'
      );
    END IF;

    -- Preveri ali je trener že dodan
    SELECT role INTO v_role
    FROM public.activity_coaches
    WHERE activity_id = v_existing_activity.id AND coach_id = v_coach_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'activity_id', v_existing_activity.id,
        'mode', 'existing',
        'role', v_role,
        'message', format('Aktivnost že obstaja. Vaša vloga: %s', 
          CASE WHEN v_role = 'head' THEN 'Glavni trener' ELSE 'Sotrener' END)
      );
    ELSE
      -- Dodaj kot sotrenerja
      IF NOT _app_internals.coach_can_be_assistant(v_coach_id, p_team_id) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', format('Aktivnost že obstaja (ustvaril %s). Vi nimate dovoljenja za sodelovanje kot sotrener.',
            (SELECT full_name FROM public.profiles WHERE id = v_existing_activity.created_by))
        );
      END IF;

      INSERT INTO public.activity_coaches (activity_id, coach_id, role)
      VALUES (v_existing_activity.id, v_coach_id, 'assistant');

      RETURN jsonb_build_object(
        'success', true,
        'activity_id', v_existing_activity.id,
        'mode', 'joined_as_assistant',
        'role', 'assistant',
        'message', 'Uspešno dodani kot sotrener'
      );
    END IF;
  END IF;

  -- 8. NOVA AKTIVNOST - Poišči predlogo urnika
  SELECT * INTO v_template
  FROM public.schedule_templates
  WHERE team_id = p_team_id
    AND day_of_week = EXTRACT(ISODOW FROM p_activity_date)
    AND (valid_from IS NULL OR p_activity_date >= valid_from)
    AND (valid_to IS NULL OR p_activity_date <= valid_to)
    AND is_active = true
  ORDER BY valid_from DESC NULLS LAST
  LIMIT 1;

  -- Če NI predloge, obvezni podatki morajo biti podani
  IF NOT FOUND THEN
    IF p_start_time IS NULL OR p_end_time IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Za ta dan ni rednega termina. Prosimo vnesite začetni in končni čas.',
        'requires_manual_input', true
      );
    END IF;
    IF p_venue_id IS NULL AND p_custom_venue IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Za ta dan ni rednega termina. Prosimo vnesite lokacijo.',
        'requires_manual_input', true
      );
    END IF;
    IF p_activity_type_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Za ta dan ni rednega termina. Prosimo vnesite vrsto aktivnosti.',
        'requires_manual_input', true
      );
    END IF;
    IF p_activity_type_id = 3 AND p_is_home_game IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Pri tekmi je obvezna izbira domača/gostovanje.',
        'requires_manual_input', true
      );
    END IF;
  END IF;

  -- 9. Določi vlogo
  IF _app_internals.coach_can_be_head(v_coach_id, p_team_id) THEN
    v_role := 'head';
  ELSIF _app_internals.coach_can_be_assistant(v_coach_id, p_team_id) THEN
    v_role := 'assistant';
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Nimate dovoljenja za nobeno vlogo pri tej selekciji');
  END IF;

  -- 10. USTVARI AKTIVNOST
  BEGIN
    INSERT INTO public.activities (
      season_id,
      team_id,
      activity_date,
      activity_type_id,
      venue_id,
      custom_venue,
      start_time,
      end_time,
      is_home_game,
      created_by
    ) VALUES (
      v_team.season_id,
      p_team_id,
      p_activity_date,
      COALESCE(p_activity_type_id, v_template.default_activity_type_id),
      COALESCE(p_venue_id, v_template.venue_id),
      COALESCE(p_custom_venue, v_template.custom_venue),
      COALESCE(p_start_time, v_template.start_time),
      COALESCE(p_end_time, v_template.end_time),
      p_is_home_game,
      v_coach_id
    )
    RETURNING id INTO v_activity_id;

    INSERT INTO public.activity_coaches (activity_id, coach_id, role)
    VALUES (v_activity_id, v_coach_id, v_role);

    RETURN jsonb_build_object(
      'success', true,
      'activity_id', v_activity_id,
      'mode', 'created',
      'role', v_role,
      'used_template', FOUND,
      'message', format('Aktivnost ustvarjena. Vaša vloga: %s',
        CASE WHEN v_role = 'head' THEN 'Glavni trener' ELSE 'Sotrener' END)
    );

  EXCEPTION
    WHEN unique_violation THEN
      -- SOČASNI VNOS
      SELECT id INTO v_activity_id
      FROM public.activities
      WHERE team_id = p_team_id
        AND season_id = v_team.season_id
        AND activity_date = p_activity_date;

      IF _app_internals.coach_can_be_assistant(v_coach_id, p_team_id) THEN
        INSERT INTO public.activity_coaches (activity_id, coach_id, role)
        VALUES (v_activity_id, v_coach_id, 'assistant')
        ON CONFLICT (activity_id, coach_id) DO NOTHING;

        RETURN jsonb_build_object(
          'success', true,
          'activity_id', v_activity_id,
          'mode', 'concurrent_join',
          'role', 'assistant',
          'message', 'Aktivnost je ravnokar ustvaril drug trener. Dodani ste bili kot sotrener.'
        );
      ELSE
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Aktivnost je pravkar ustvaril drug trener. Vi nimate dovoljenja za sodelovanje.'
        );
      END IF;
  END;
END;
$$;

COMMENT ON FUNCTION public.create_or_open_activity IS 'Atomically create or open activity for attendance';

-- ============================================================================
-- FUNKCIJA: complete_activity_with_rates
-- Opis: Zaključi aktivnost in izračunaj obračune
-- ============================================================================
CREATE FUNCTION public.complete_activity_with_rates(
  p_activity_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  v_rate_snapshot RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Niste prijavljeni');
  END IF;

  IF NOT _app_internals.is_active_user(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vaš uporabniški račun ni aktiven');
  END IF;

  v_is_admin := _app_internals.is_admin(v_user_id);

  -- 1. PREVERI AKTIVNOST
  SELECT * INTO v_activity
  FROM public.activities
  WHERE id = p_activity_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aktivnost ne obstaja');
  END IF;

  IF v_activity.is_completed AND NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aktivnost je že zaključena');
  END IF;

  -- 2. PREVERI DOVOLJENJE - SAMO GLAVNI TRENER ALI ADMIN
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

  -- 3. PREVERI ZAKLENJEN MESEC
  IF NOT v_is_admin AND _app_internals.is_month_locked(v_activity.activity_date) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Mesec %s je zaklenjen', to_char(v_activity.activity_date, 'YYYY-MM'))
    );
  END IF;

  -- 4. PREVERI POPOLNOST PRISOTNOSTI
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

  -- 5. PREVERI IN IZRAČUNAJ ZA VSAKEGA TRENERJA
  FOR v_coach IN
    SELECT *
    FROM public.activity_coaches
    WHERE activity_id = p_activity_id
  LOOP
    -- Pridobi veljavne postavke
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

    -- Preveri ustrezne postavke
    IF v_coach.role = 'head' THEN
      IF v_activity.activity_type_id = 1 AND v_rates.head_type1_per_hour IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Manjka postavka head_type1_per_hour');
      ELSIF v_activity.activity_type_id = 2 AND v_rates.head_type2_per_hour IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Manjka postavka head_type2_per_hour');
      ELSIF v_activity.activity_type_id = 3 AND v_rates.head_type3_fixed IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Manjka postavka head_type3_fixed');
      END IF;
    ELSE
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

    -- IZRAČUN
    v_hours := ROUND(EXTRACT(EPOCH FROM (v_activity.end_time - v_activity.start_time)) / 3600.0, 2);

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
    ELSE
      v_activity_amount := CASE 
        WHEN v_coach.role = 'head' THEN v_rates.head_type3_fixed
        ELSE v_rates.assistant_type3_fixed
      END;
    END IF;

    v_mileage_amount := ROUND(COALESCE(v_coach.mileage_km, 0) * COALESCE(v_rates.rate_per_km, 0), 2);
    v_total_amount := v_activity_amount + v_mileage_amount;

    -- SHRANI SNAPSHOT
    UPDATE public.activity_coaches
    SET
      rate_type1_per_hour = CASE WHEN v_coach.role = 'head' THEN v_rates.head_type1_per_hour ELSE v_rates.assistant_type1_per_hour END,
      rate_type2_per_hour = CASE WHEN v_coach.role = 'head' THEN v_rates.head_type2_per_hour ELSE v_rates.assistant_type2_per_hour END,
      rate_type3_fixed = CASE WHEN v_coach.role = 'head' THEN v_rates.head_type3_fixed ELSE v_rates.assistant_type3_fixed END,
      rate_per_km = v_rates.rate_per_km,
      hours_worked = v_hours,
      activity_amount = v_activity_amount,
      mileage_amount = v_mileage_amount,
      total_amount = v_total_amount
    WHERE activity_id = p_activity_id
      AND coach_id = v_coach.coach_id;
  END LOOP;

  -- 6. OZNAČI AKTIVNOST KOT ZAKLJUČENO
  UPDATE public.activities
  SET is_completed = true,
      completed_at = now(),
      completed_by = v_user_id
  WHERE id = p_activity_id;

  RETURN jsonb_build_object('success', true, 'message', 'Aktivnost uspešno zaključena in obračunana');
END;
$$;

COMMENT ON FUNCTION public.complete_activity_with_rates IS 'Complete activity and calculate coach payments';

-- Grant execute
REVOKE ALL ON FUNCTION public.create_or_open_activity FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_open_activity TO authenticated;

REVOKE ALL ON FUNCTION public.complete_activity_with_rates FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_activity_with_rates TO authenticated;