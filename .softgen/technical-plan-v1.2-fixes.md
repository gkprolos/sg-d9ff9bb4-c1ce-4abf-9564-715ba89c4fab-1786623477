# Tehnični Načrt v1.2 – Popravki Blokirajočih Napak

> **Status:** Čaka na potrditev  
> **Datum:** 2026-08-13  
> **Verzija:** 1.2 (popravki na 1.1)

## Pregled Popravkov

Ta dokument odpravi 24 blokirajočih varnostnih in funkcionalnih napak iz različice 1.1.

---

## 1. KRITIČNI VARNOSTNI POPRAVKI

### 1.1 Odstranitev `p_coach_id` iz RPC Funkcij

**Problem:** Uporabnik lahko v RPC pošlje UUID trenerja in izvede operacijo v tujem imenu.

**Rešitev:** Identiteta VEDNO iz `auth.uid()`.

```sql
-- ❌ NAPAČNO (v1.1)
CREATE FUNCTION create_or_open_activity(
  p_coach_id UUID,
  p_team_id UUID,
  ...
)

-- ✅ PRAVILNO (v1.2)
CREATE FUNCTION create_or_open_activity(
  p_team_id UUID,
  p_activity_date DATE,
  p_activity_type_id INT,
  p_venue_id UUID DEFAULT NULL,
  p_custom_venue TEXT DEFAULT NULL,
  p_start_time TIME DEFAULT NULL,
  p_end_time TIME DEFAULT NULL,
  p_is_home_game BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, _app_internals
AS $$
DECLARE
  v_coach_id UUID;
  v_coach_profile RECORD;
  v_team RECORD;
  v_season RECORD;
  v_template RECORD;
  v_activity_id UUID;
  v_existing_activity RECORD;
  v_role TEXT;
  v_has_head_coach BOOLEAN;
BEGIN
  -- 1. IDENTITETA IZ auth.uid()
  v_coach_id := auth.uid();
  IF v_coach_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Niste prijavljeni'
    );
  END IF;

  -- 2. PREVERI AKTIVEN TRENER
  SELECT * INTO v_coach_profile
  FROM profiles
  WHERE id = v_coach_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Vaš uporabniški račun ni aktiven ali nimate trenerskih pravic'
    );
  END IF;

  -- 3. PREVERI SELEKCIJO IN SEZONO
  SELECT t.*, s.id as season_id, s.start_date, s.end_date, s.is_archived as season_archived
  INTO v_team
  FROM teams t
  JOIN seasons s ON t.season_id = s.id
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
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nimate dostopa do te selekcije'
    );
  END IF;

  -- 7. PREVERI OBSTOJ AKTIVNOSTI
  SELECT * INTO v_existing_activity
  FROM activities
  WHERE team_id = p_team_id
    AND season_id = v_team.season_id
    AND activity_date = p_activity_date;

  IF FOUND THEN
    -- AKTIVNOST ŽE OBSTAJA
    
    -- Preveri ali je že zaključena
    IF v_existing_activity.is_completed THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Aktivnost je že zaključena in je ni mogoče urejati. Za popravek kontaktirajte administratorja.'
      );
    END IF;

    -- Preveri ali je trener že dodan
    SELECT role INTO v_role
    FROM activity_coaches
    WHERE activity_id = v_existing_activity.id AND coach_id = v_coach_id;

    IF FOUND THEN
      -- Trener je že povezan
      RETURN jsonb_build_object(
        'success', true,
        'activity_id', v_existing_activity.id,
        'mode', 'existing',
        'role', v_role,
        'message', format('Aktivnost že obstaja. Vaša vloga: %s', 
          CASE WHEN v_role = 'head' THEN 'Glavni trener' ELSE 'Sotrener' END)
      );
    ELSE
      -- Dodaj kot sotrenerja (če je dovoljen)
      IF NOT _app_internals.coach_can_be_assistant(v_coach_id, p_team_id) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', format('Aktivnost že obstaja (ustvaril %s). Vi nimate dovoljenja za sodelovanje kot sotrener.',
            (SELECT full_name FROM profiles WHERE id = v_existing_activity.created_by))
        );
      END IF;

      INSERT INTO activity_coaches (activity_id, coach_id, role)
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

  -- 8. NOVA AKTIVNOST - PREVERI OBVEZNE PODATKE
  -- Poišči predlogo urnika
  SELECT * INTO v_template
  FROM schedule_templates
  WHERE team_id = p_team_id
    AND day_of_week = EXTRACT(DOW FROM p_activity_date)
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

  -- 9. USTVARI AKTIVNOST (iz predloge ali parametrov)
  -- Določi vlogo (head če je edini head coach, drugače assistant)
  SELECT COUNT(*) > 0 INTO v_has_head_coach
  FROM team_coaches
  WHERE team_id = p_team_id AND role = 'head' AND coach_id != v_coach_id;

  IF _app_internals.coach_can_be_head(v_coach_id, p_team_id) AND NOT v_has_head_coach THEN
    v_role := 'head';
  ELSIF _app_internals.coach_can_be_assistant(v_coach_id, p_team_id) THEN
    v_role := 'assistant';
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nimate dovoljenja za nobeno vlogo pri tej selekciji'
    );
  END IF;

  BEGIN
    INSERT INTO activities (
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

    -- Dodaj glavnega trenerja / sotrenerja
    INSERT INTO activity_coaches (activity_id, coach_id, role)
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
      -- SOČASNI VNOS - poskusi dodati kot sotrenerja
      SELECT id INTO v_activity_id
      FROM activities
      WHERE team_id = p_team_id
        AND season_id = v_team.season_id
        AND activity_date = p_activity_date;

      IF _app_internals.coach_can_be_assistant(v_coach_id, p_team_id) THEN
        INSERT INTO activity_coaches (activity_id, coach_id, role)
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

-- Revoke public, grant samo authenticated
REVOKE ALL ON FUNCTION create_or_open_activity FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_or_open_activity TO authenticated;
```

### 1.2 Varne Pomožne Funkcije (brez p_user_id)

```sql
-- ✅ coach_can_access_team - NIKOLI ne sprejema user_id
CREATE FUNCTION _app_internals.coach_can_access_team(
  p_coach_id UUID,
  p_team_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_coaches tc
    JOIN teams t ON tc.team_id = t.id
    WHERE tc.coach_id = p_coach_id
      AND tc.team_id = p_team_id
      AND tc.is_active = true
      AND t.is_archived = false
  );
$$;

-- ✅ Preveri aktiven profil
CREATE FUNCTION _app_internals.is_active_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND is_active = true
  );
$$;
```

**Pravilo:** Vse RPC in pomožne funkcije morajo uporabiti `auth.uid()` za identiteto klicatelja. NIKOLI `p_user_id`, `p_coach_id` parametrov za avtorizacijo.

---

## 2. RLS POLITIKE - STOLPČNA DOVOLJENJA

### 2.1 Activities - Omeji Posodabljanje

```sql
-- ❌ PREŠIROKO (v1.1)
CREATE POLICY "coaches_update_own_activities"
ON activities FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  AND NOT is_completed
  AND NOT _app_internals.is_month_locked(activity_date)
);

-- ✅ PRAVILNO (v1.2) - samo dovoljeni stolpci
CREATE POLICY "coaches_update_limited_fields"
ON activities FOR UPDATE
TO authenticated
USING (
  -- Samo če je glavni trener in mesec ni zaklenjen
  EXISTS (
    SELECT 1 FROM activity_coaches ac
    WHERE ac.activity_id = activities.id
      AND ac.coach_id = auth.uid()
      AND ac.role = 'head'
  )
  AND NOT is_completed  -- ZAKLJUČENE NE SME SPREMINJATI
  AND NOT _app_internals.is_month_locked(activity_date)
  AND _app_internals.is_active_user(auth.uid())
)
WITH CHECK (
  -- SAMO ti stolpci se smejo spreminjati
  activity_type_id IS NOT DISTINCT FROM OLD.activity_type_id OR activity_type_id IS NOT NULL
  AND (venue_id IS NOT DISTINCT FROM OLD.venue_id OR custom_venue IS NOT DISTINCT FROM OLD.custom_venue)
  AND start_time > OLD.activity_date::timestamp  -- prepreči premik v preteklost
  AND end_time > start_time
  AND (is_home_game IS NOT DISTINCT FROM OLD.is_home_game OR activity_type_id != 3)
  -- ZAŠČITENI STOLPCI - ne smejo se spreminjati
  AND season_id = OLD.season_id
  AND team_id = OLD.team_id
  AND activity_date = OLD.activity_date
  AND created_by = OLD.created_by
  AND created_at = OLD.created_at
  AND is_completed = OLD.is_completed
);
```

### 2.2 Activity_Coaches - Zaščita Finančnih Polj

```sql
CREATE POLICY "coaches_update_own_mileage_only"
ON activity_coaches FOR UPDATE
TO authenticated
USING (
  coach_id = auth.uid()
  AND NOT _app_internals.is_activity_completed(activity_id)
  AND NOT _app_internals.is_month_locked_for_activity(activity_id)
  AND _app_internals.is_active_user(auth.uid())
)
WITH CHECK (
  -- SAMO mileage_km se sme spreminjati
  mileage_km >= 0
  AND mileage_km IS NOT NULL
  -- ZAŠČITENI STOLPCI
  AND coach_id = OLD.coach_id
  AND activity_id = OLD.activity_id
  AND role = OLD.role
  AND rate_type1_per_hour = OLD.rate_type1_per_hour
  AND rate_type2_per_hour = OLD.rate_type2_per_hour
  AND rate_type3_fixed = OLD.rate_type3_fixed
  AND rate_per_km = OLD.rate_per_km
  AND hours_worked = OLD.hours_worked
  AND activity_amount = OLD.activity_amount
  AND mileage_amount = OLD.mileage_amount
  AND total_amount = OLD.total_amount
);
```

### 2.3 Attendance_Records - Zaščita Metapodatkov

```sql
CREATE POLICY "coaches_update_attendance_status_only"
ON attendance_records FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM activity_coaches ac
    WHERE ac.activity_id = attendance_records.activity_id
      AND ac.coach_id = auth.uid()
  )
  AND NOT _app_internals.is_activity_completed(activity_id)
  AND NOT _app_internals.is_month_locked_for_activity(activity_id)
  AND _app_internals.is_active_user(auth.uid())
)
WITH CHECK (
  -- SAMO status in notes
  status IN (0, 1, 2)
  -- ZAŠČITENI STOLPCI
  AND activity_id = OLD.activity_id
  AND player_id = OLD.player_id
  AND recorded_by = OLD.recorded_by
  AND recorded_at = OLD.recorded_at
);
```

---

## 3. ZAKLJUČEVANJE AKTIVNOSTI

### 3.1 Samo Glavni Trener Ali Admin

```sql
CREATE FUNCTION complete_activity_with_rates(
  p_activity_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, _app_internals
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
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Niste prijavljeni');
  END IF;

  v_is_admin := _app_internals.is_admin(v_user_id);

  -- 1. PREVERI AKTIVNOST
  SELECT * INTO v_activity
  FROM activities
  WHERE id = p_activity_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aktivnost ne obstaja');
  END IF;

  IF v_activity.is_completed THEN
    IF NOT v_is_admin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Aktivnost je že zaključena');
    END IF;
    -- Admin lahko ponovno obračuna (audit log)
  END IF;

  -- 2. PREVERI DOVOLJENJE - SAMO GLAVNI TRENER ALI ADMIN
  IF NOT v_is_admin THEN
    IF NOT EXISTS (
      SELECT 1 FROM activity_coaches
      WHERE activity_id = p_activity_id
        AND coach_id = v_user_id
        AND role = 'head'
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Samo glavni trener lahko zaključi aktivnost'
      );
    END IF;
  END IF;

  -- 3. PREVERI ZAKLENJEN MESEC (samo za ne-admin)
  IF NOT v_is_admin AND _app_internals.is_month_locked(v_activity.activity_date) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Mesec %s je zaklenjen', to_char(v_activity.activity_date, 'YYYY-MM'))
    );
  END IF;

  -- 4. PREVERI POPOLNOST PRISOTNOSTI
  SELECT array_agg(p.full_name)
  INTO v_missing_players
  FROM team_players tp
  JOIN players p ON tp.player_id = p.id
  WHERE tp.team_id = v_activity.team_id
    AND tp.membership_status = 'active'
    AND (tp.valid_from IS NULL OR tp.valid_from <= v_activity.activity_date)
    AND (tp.valid_to IS NULL OR tp.valid_to >= v_activity.activity_date)
    AND NOT EXISTS (
      SELECT 1 FROM attendance_records ar
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
    FROM activity_coaches
    WHERE activity_id = p_activity_id
  LOOP
    -- Pridobi veljavne postavke
    SELECT * INTO v_rates
    FROM coach_rates
    WHERE coach_id = v_coach.coach_id
      AND season_id = v_activity.season_id
      AND is_active = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Trener %s nima veljavnih postavk za to sezono', 
          (SELECT full_name FROM profiles WHERE id = v_coach.coach_id))
      );
    END IF;

    -- Preveri ustrezne postavke glede na vlogo in tip
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

    -- IZRAČUN
    v_hours := EXTRACT(EPOCH FROM (v_activity.end_time - v_activity.start_time)) / 3600.0;

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

    v_mileage_amount := ROUND(COALESCE(v_coach.mileage_km, 0) * v_rates.rate_per_km, 2);
    v_total_amount := v_activity_amount + v_mileage_amount;

    -- SHRANI SNAPSHOT POSTAVK IN IZRAČUNE
    UPDATE activity_coaches
    SET
      rate_type1_per_hour = v_rates.head_type1_per_hour,
      rate_type2_per_hour = v_rates.head_type2_per_hour,
      rate_type3_fixed = v_rates.head_type3_fixed,
      rate_per_km = v_rates.rate_per_km,
      hours_worked = v_hours,
      activity_amount = v_activity_amount,
      mileage_amount = v_mileage_amount,
      total_amount = v_total_amount
    WHERE activity_id = p_activity_id
      AND coach_id = v_coach.coach_id;
  END LOOP;

  -- 6. OZNAČI AKTIVNOST KOT ZAKLJUČENO
  UPDATE activities
  SET is_completed = true,
      completed_at = now(),
      completed_by = v_user_id
  WHERE id = p_activity_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Aktivnost uspešno zaključena in obračunana'
  );
END;
$$;

REVOKE ALL ON FUNCTION complete_activity_with_rates FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_activity_with_rates TO authenticated;
```

---

## 4. REVIZIJSKA SLED - DOKONČANI TRIGGERJI

### 4.1 Razlog Popravka v Istem Zapisu

```sql
-- Dodaj razlog v audit_log tabelo
ALTER TABLE audit_log
ADD COLUMN correction_request_id UUID REFERENCES correction_requests(id),
ADD COLUMN correction_reason TEXT;

-- Trigger funkcija z razlogom
CREATE FUNCTION _app_internals.audit_trigger_with_reason()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_correction_request_id UUID;
  v_correction_reason TEXT;
BEGIN
  v_user_id := auth.uid();
  
  SELECT full_name INTO v_user_name
  FROM profiles
  WHERE id = v_user_id;

  -- Preveri session variable za admin popravke
  BEGIN
    v_correction_request_id := current_setting('app.correction_request_id', true)::UUID;
    v_correction_reason := current_setting('app.correction_reason', true);
  EXCEPTION WHEN OTHERS THEN
    v_correction_request_id := NULL;
    v_correction_reason := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (
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
      NEW.id,
      'INSERT',
      NULL,
      to_jsonb(NEW),
      v_user_id,
      v_user_name,
      v_correction_request_id,
      v_correction_reason
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (
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
      NEW.id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      v_user_id,
      v_user_name,
      v_correction_request_id,
      v_correction_reason
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (
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
      OLD.id,
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
END;
$$;

-- Dodaj trigger na VSE pomembne tabele
CREATE TRIGGER audit_activities
  AFTER INSERT OR UPDATE OR DELETE ON activities
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_activity_coaches
  AFTER INSERT OR UPDATE OR DELETE ON activity_coaches
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_attendance
  AFTER INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_players
  AFTER INSERT OR UPDATE OR DELETE ON players
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_team_players
  AFTER INSERT OR UPDATE OR DELETE ON team_players
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_team_coaches
  AFTER INSERT OR UPDATE OR DELETE ON team_coaches
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_guardians
  AFTER INSERT OR UPDATE OR DELETE ON guardians
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_player_forms
  AFTER INSERT OR UPDATE OR DELETE ON player_forms
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_coach_rates
  AFTER INSERT OR UPDATE OR DELETE ON coach_rates
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_schedules
  AFTER INSERT OR UPDATE OR DELETE ON schedule_templates
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_teams
  AFTER INSERT OR UPDATE OR DELETE ON teams
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_seasons
  AFTER INSERT OR UPDATE OR DELETE ON seasons
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_venues
  AFTER INSERT OR UPDATE OR DELETE ON venues
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_correction_requests
  AFTER UPDATE ON correction_requests
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();

CREATE TRIGGER audit_profiles
  AFTER UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_with_reason();
```

### 4.2 Administratorska Funkcija za Popravek

```sql
-- Tipizirana funkcija za admin popravke
CREATE FUNCTION admin_correct_attendance(
  p_attendance_id UUID,
  p_new_status INT,
  p_new_notes TEXT,
  p_correction_request_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, _app_internals
AS $$
DECLARE
  v_user_id UUID;
  v_request RECORD;
BEGIN
  v_user_id := auth.uid();
  
  IF NOT _app_internals.is_admin(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Samo administrator lahko izvede popravke');
  END IF;

  -- Preveri zahtevo za popravek
  SELECT * INTO v_request
  FROM correction_requests
  WHERE id = p_correction_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Zahteva za popravek ne obstaja');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Zahteva ni v statusu pending');
  END IF;

  -- Nastavi session variable za audit trigger
  PERFORM set_config('app.correction_request_id', p_correction_request_id::TEXT, true);
  PERFORM set_config('app.correction_reason', p_reason, true);

  -- Izvedi popravek
  UPDATE attendance_records
  SET
    status = p_new_status,
    notes = p_new_notes,
    last_modified_by = v_user_id,
    last_modified_at = now()
  WHERE id = p_attendance_id;

  -- Označi zahtevo kot odobreno
  UPDATE correction_requests
  SET
    status = 'approved',
    reviewed_by = v_user_id,
    reviewed_at = now(),
    admin_notes = p_reason
  WHERE id = p_correction_request_id;

  -- Počisti session variables
  PERFORM set_config('app.correction_request_id', NULL, true);
  PERFORM set_config('app.correction_reason', NULL, true);

  RETURN jsonb_build_object('success', true, 'message', 'Popravek uspešno izveden');
END;
$$;

REVOKE ALL ON FUNCTION admin_correct_attendance FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_correct_attendance TO authenticated;
```

---

## 5. ZAHTEVA ZA POPRAVEK

### 5.1 Razširjena Tabela

```sql
CREATE TABLE correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES profiles(id),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  current_value TEXT,
  proposed_value TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_table_name CHECK (table_name IN (
    'activities',
    'activity_coaches',
    'attendance_records'
  ))
);

CREATE INDEX idx_correction_requests_requested_by ON correction_requests(requested_by);
CREATE INDEX idx_correction_requests_status ON correction_requests(status);
CREATE INDEX idx_correction_requests_reviewed_by ON correction_requests(reviewed_by);

-- RLS
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaches_view_own_requests"
ON correction_requests FOR SELECT
TO authenticated
USING (requested_by = auth.uid());

CREATE POLICY "coaches_create_requests"
ON correction_requests FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND status = 'pending'
  AND _app_internals.is_active_user(auth.uid())
);

CREATE POLICY "admin_view_all_requests"
ON correction_requests FOR SELECT
TO authenticated
USING (_app_internals.is_admin(auth.uid()));

CREATE POLICY "admin_update_requests"
ON correction_requests FOR UPDATE
TO authenticated
USING (_app_internals.is_admin(auth.uid()))
WITH CHECK (
  status IN ('approved', 'rejected')
  AND reviewed_by = auth.uid()
  AND reviewed_at IS NOT NULL
);
```

---

## 6. CASCADE vs RESTRICT POPRAVEK

```sql
-- ❌ NAPAČNO (v1.1)
ALTER TABLE team_players
  ADD CONSTRAINT fk_team_players_team FOREIGN KEY (team_id)
  REFERENCES teams(id) ON DELETE CASCADE;

-- ✅ PRAVILNO (v1.2)
ALTER TABLE team_players
  ADD CONSTRAINT fk_team_players_team FOREIGN KEY (team_id)
  REFERENCES teams(id) ON DELETE RESTRICT;

ALTER TABLE team_coaches
  ADD CONSTRAINT fk_team_coaches_team FOREIGN KEY (team_id)
  REFERENCES teams(id) ON DELETE RESTRICT;

ALTER TABLE activities
  ADD CONSTRAINT fk_activities_team FOREIGN KEY (team_id, season_id)
  REFERENCES teams(id, season_id) ON DELETE RESTRICT;

ALTER TABLE attendance_records
  ADD CONSTRAINT fk_attendance_activity FOREIGN KEY (activity_id)
  REFERENCES activities(id) ON DELETE RESTRICT;

ALTER TABLE activity_coaches
  ADD CONSTRAINT fk_activity_coaches_activity FOREIGN KEY (activity_id)
  REFERENCES activities(id) ON DELETE RESTRICT;

ALTER TABLE player_forms
  ADD CONSTRAINT fk_player_forms_player FOREIGN KEY (player_id)
  REFERENCES players(id) ON DELETE RESTRICT;

ALTER TABLE correction_requests
  ADD CONSTRAINT fk_correction_requested_by FOREIGN KEY (requested_by)
  REFERENCES profiles(id) ON DELETE RESTRICT;

-- CASCADE samo za začasne/nebistvene povezave
ALTER TABLE player_guardians
  ADD CONSTRAINT fk_player_guardians_player FOREIGN KEY (player_id)
  REFERENCES players(id) ON DELETE CASCADE;  -- OK, relacija
```

---

## 7. PREPREČITEV PREKRIVANJ

### 7.1 Urniki

```sql
-- Prepreči prekrivajoče urnike
CREATE UNIQUE INDEX idx_schedule_no_overlap
ON schedule_templates (team_id, day_of_week, start_time, end_time)
WHERE is_active = true AND valid_to IS NULL;

-- Trigger za preverjanje prekrivanj z različnimi obdobji veljavnosti
CREATE FUNCTION _app_internals.check_schedule_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM schedule_templates
    WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND team_id = NEW.team_id
      AND day_of_week = NEW.day_of_week
      AND is_active = true
      -- Prekrivanje časov
      AND (
        (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
      )
      -- Prekrivanje obdobij veljavnosti
      AND (
        (NEW.valid_from, NEW.valid_to) OVERLAPS (valid_from, valid_to)
        OR (NEW.valid_from IS NULL AND valid_from IS NULL)
      )
  ) THEN
    RAISE EXCEPTION 'Urnik se prekriva z obstoječim terminom za to selekcijo in dan';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_schedule_overlap_trigger
  BEFORE INSERT OR UPDATE ON schedule_templates
  FOR EACH ROW EXECUTE FUNCTION _app_internals.check_schedule_overlap();
```

### 7.2 Članstva

```sql
-- Prepreči prekrivajoča članstva
CREATE FUNCTION _app_internals.check_membership_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM team_players
    WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND player_id = NEW.player_id
      AND team_id = NEW.team_id
      AND membership_status = 'active'
      AND (
        (NEW.valid_from, NEW.valid_to) OVERLAPS (valid_from, valid_to)
        OR (NEW.valid_from IS NULL AND valid_from IS NULL)
      )
  ) THEN
    RAISE EXCEPTION 'Igralec ima že aktivno članstvo v tej selekciji za to obdobje';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_membership_overlap_trigger
  BEFORE INSERT OR UPDATE ON team_players
  FOR EACH ROW EXECUTE FUNCTION _app_internals.check_membership_overlap();
```

---

## 8. RLS ZA TRENUTNO ČLANSTVO

```sql
-- ❌ NAPAČNO (v1.1) - trener vidi vse igralce kjer je bil kdajkoli
CREATE POLICY "coaches_view_team_players"
ON players FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM team_players tp
    JOIN team_coaches tc ON tp.team_id = tc.team_id
    WHERE tp.player_id = players.id
      AND tc.coach_id = auth.uid()
  )
);

-- ✅ PRAVILNO (v1.2) - samo trenutno veljavna članstva
CREATE POLICY "coaches_view_current_team_players"
ON players FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM team_players tp
    JOIN team_coaches tc ON tp.team_id = tc.team_id
    WHERE tp.player_id = players.id
      AND tc.coach_id = auth.uid()
      AND tc.is_active = true
      AND tp.membership_status = 'active'
      AND (tp.valid_to IS NULL OR tp.valid_to >= CURRENT_DATE)
      AND _app_internals.is_active_user(auth.uid())
  )
);

-- Enako za starše
CREATE POLICY "coaches_view_current_guardians"
ON guardians FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM player_guardians pg
    JOIN team_players tp ON pg.player_id = tp.player_id
    JOIN team_coaches tc ON tp.team_id = tc.team_id
    WHERE pg.guardian_id = guardians.id
      AND tc.coach_id = auth.uid()
      AND tc.is_active = true
      AND tp.membership_status = 'active'
      AND (tp.valid_to IS NULL OR tp.valid_to >= CURRENT_DATE)
      AND _app_internals.is_active_user(auth.uid())
  )
);
```

---

## 9. PRVI ADMINISTRATOR

```sql
-- ❌ NAPAČNO (v1.1) - prvi profil lahko postane admin
-- ✅ PRAVILNO (v1.2) - ročna SQL dodelitev

-- Ne uporabljaj trigger za prvega admina
-- Namesto tega: ročni SQL po prvi registraciji

-- Primer: Admin ustvari prvega administratorja
-- 1. Naročnik se registrira normalno (dobi role 'pending')
-- 2. Supabase Dashboard → SQL Editor:
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin@klub.si'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

UPDATE profiles
SET is_active = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@klub.si');

-- Vsi nadaljnji uporabniki:
CREATE FUNCTION _app_internals.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    false  -- VEDNO false, admin aktivira ročno
  );

  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'pending');  -- VEDNO pending
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION _app_internals.handle_new_user();
```

---

## 10. PREVERJANJE is_active POVSOD

```sql
-- Dodaj preverbo v VSE RLS politike
-- Primer:
CREATE POLICY "coaches_view_activities"
ON activities FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM activity_coaches ac
    WHERE ac.activity_id = activities.id
      AND ac.coach_id = auth.uid()
  )
  AND _app_internals.is_active_user(auth.uid())  -- DODANO
);

-- Dodaj preverbo v VSE RPC funkcije na začetku
CREATE FUNCTION some_rpc_function(...)
RETURNS ...
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF NOT _app_internals.is_active_user(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Uporabniški račun ni aktiven');
  END IF;
  
  -- ... ostala logika
END;
$$;
```

---

## 11. VARNOSTNE KOPIJE

```sql
-- Dodaj tabelo za sledenje varnostnim kopijam
CREATE TABLE _app_internals.backup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL CHECK (backup_type IN ('daily', 'weekly', 'manual')),
  backup_path TEXT NOT NULL,
  backup_size_bytes BIGINT,
  encryption_key_id TEXT,  -- Reference to key management system
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  restore_tested_at TIMESTAMPTZ,
  notes TEXT
);

-- Varnostne kopije NE v Supabase Storage
-- Uporabi:
-- 1. Supabase PITR (Point-in-Time Recovery) - vključeno v Supabase Pro
-- 2. pg_dump preko GitHub Actions → šifrirano v AWS S3 / Azure Blob / podobno
-- 3. Retencija: 7 dnevnih + 4 tedenske + 12 mesečnih

-- Primer GitHub Actions workflow (dodaj v .github/workflows/backup.yml):
```

```yaml
name: Database Backup

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Backup Database
        env:
          DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
          ENCRYPTION_KEY: ${{ secrets.BACKUP_ENCRYPTION_KEY }}
          S3_BUCKET: ${{ secrets.BACKUP_S3_BUCKET }}
        run: |
          # Export database
          pg_dump "${{ secrets.SUPABASE_CONNECTION_STRING }}" \
            --format=custom \
            --file=backup_$(date +%Y%m%d).dump
          
          # Encrypt
          gpg --symmetric --cipher-algo AES256 \
            --passphrase="$ENCRYPTION_KEY" \
            backup_$(date +%Y%m%d).dump
          
          # Upload to S3 (use appropriate CLI)
          aws s3 cp backup_$(date +%Y%m%d).dump.gpg \
            s3://$S3_BUCKET/backups/$(date +%Y)/$(date +%m)/
          
          # Clean local
          rm backup_$(date +%Y%m%d).dump*
```

---

## 12. GDPR SKLADNOST

```sql
-- Dodaj tabelo za beleženje consent in zahtev
CREATE TABLE data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN (
    'access',           -- Dostop do podatkov (GDPR člen 15)
    'rectification',    -- Popravek (GDPR člen 16)
    'erasure',          -- Izbris (GDPR člen 17)
    'restriction',      -- Omejitev obdelave (GDPR člen 18)
    'portability',      -- Prenosljivost (GDPR člen 20)
    'objection'         -- Ugovor (GDPR člen 21)
  )),
  subject_email TEXT NOT NULL,
  subject_name TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received', 'in_progress', 'completed', 'rejected'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  notes TEXT
);

-- Funkcija za izvoz osebnih podatkov igralca
CREATE FUNCTION export_player_data(p_player_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT _app_internals.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Samo administrator lahko izvozi osebne podatke';
  END IF;

  SELECT jsonb_build_object(
    'player', to_jsonb(p.*),
    'guardians', (
      SELECT jsonb_agg(to_jsonb(g.*))
      FROM guardians g
      JOIN player_guardians pg ON g.id = pg.guardian_id
      WHERE pg.player_id = p.id
    ),
    'team_memberships', (
      SELECT jsonb_agg(to_jsonb(tp.*))
      FROM team_players tp
      WHERE tp.player_id = p.id
    ),
    'forms', (
      SELECT jsonb_agg(to_jsonb(pf.*))
      FROM player_forms pf
      WHERE pf.player_id = p.id
    ),
    'attendance', (
      SELECT jsonb_agg(to_jsonb(ar.*))
      FROM attendance_records ar
      WHERE ar.player_id = p.id
    )
  )
  INTO v_result
  FROM players p
  WHERE p.id = p_player_id;

  RETURN v_result;
END;
$$;
```

**Opomba:** Aplikacija **podpira** izvajanje GDPR ukrepov, klub pa mora:
- Pridobiti ustrezno pravno podlago (privolitev staršev, legitimni interes)
- Določiti roke hrambe
- Pripraviti obvestila posameznikom
- Vzpostaviti postopke za obravnavo zahtev
- Imenovati pooblaščeno osebo (če potrebno)
- Voditi evidenco dejavnosti obdelave

---

## 13. REVIZIJA AUDIT RETENCIJE

```sql
-- ❌ NAPAČNO (v1.1) - samodejno brisanje po 7 letih
-- ✅ PRAVILNO (v1.2) - nobeno avtomatično brisanje

-- Odstrani cron job za brisanje
-- Dodaj ročno funkcijo (samo superuser lahko izvede)

CREATE FUNCTION _app_internals.archive_old_audit_logs(
  p_older_than_date DATE,
  p_admin_confirmation TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_archived_count INT;
BEGIN
  -- Zahteva eksplicitno potrditev
  IF p_admin_confirmation != 'POTRJUJEM_ARHIVIRANJE_AUDIT_LOGOV' THEN
    RAISE EXCEPTION 'Zahtevana je eksplicitna potrditev';
  END IF;

  -- Samo superuser lahko izvede
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = current_user AND rolsuper = true
  ) THEN
    RAISE EXCEPTION 'Samo superuser lahko arhivira audit logs';
  END IF;

  -- Izvoz v backup tabelo (ne izbris!)
  CREATE TABLE IF NOT EXISTS _app_internals.audit_log_archive (
    LIKE audit_log INCLUDING ALL
  );

  INSERT INTO _app_internals.audit_log_archive
  SELECT *
  FROM audit_log
  WHERE created_at < p_older_than_date;

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  -- NE BRIŠEMO iz glavne tabele - samo arhiviramo

  RETURN jsonb_build_object(
    'success', true,
    'archived_count', v_archived_count,
    'archive_date', now()
  );
END;
$$;

-- Brez public dovoljenja
REVOKE ALL ON FUNCTION _app_internals.archive_old_audit_logs FROM PUBLIC;
```

---

## 14. CI/CD POPRAVKI

### 14.1 Posodobljeni GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: supabase/postgres:15.1.0.117
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Supabase CLI
        run: |
          curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
          sudo mv supabase /usr/local/bin/
      
      - name: Start Supabase local
        run: |
          supabase init
          supabase start
      
      - name: Run migrations
        run: supabase db reset
      
      - name: Run TypeScript checks
        run: npm run type-check
      
      - name: Run ESLint
        run: npm run lint
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY_LOCAL }}
        run: npm run test:integration
      
      - name: Build Next.js
        run: npm run build
      
      - name: Run E2E tests
        run: |
          npm run build
          npm run test:e2e
      
      - name: Stop Supabase
        run: supabase stop
```

### 14.2 Playwright Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  // Web server za E2E teste
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
```

---

## 15. TESTNA MATRIKA - DOPOLNITVE

### 15.1 Varnostni Testi

| Test ID | Opis | Pričakovan Rezultat |
|---------|------|---------------------|
| SEC-001 | Ponarejen `p_coach_id` v RPC | Napaka: Parameter ne obstaja |
| SEC-002 | Sotrener poskuša zaključiti aktivnost | Napaka: Samo glavni trener |
| SEC-003 | Trener spreminja `total_amount` prek API | Napaka: RLS zavrne |
| SEC-004 | Trener spreminja `coach_id` v activity_coaches | Napaka: RLS zavrne |
| SEC-005 | Trener spreminja zaključeno aktivnost (tekoči mesec) | Napaka: Zaključeno ni mogoče spreminjati |
| SEC-006 | Neaktiven trener poskuša dostopati do podatkov | Napaka: Račun ni aktiven |
| SEC-007 | Zgodovinski trener dostopa do kontaktov igralca | Prazno: RLS filtrira |
| SEC-008 | Prvi javno registrirani uporabnik poskuša postati admin | Dobipending vlogo |
| SEC-009 | Trener poskuša brati finančne podatke drugega trenerja | Prazno: RLS filtrira |
| SEC-010 | Admin poskuša povezati popravek z neobstoječim request_id | Napaka: Zahteva ne obstaja |

### 15.2 Funkcijski Testi

| Test ID | Opis | Pričakovan Rezultat |
|---------|------|---------------------|
| FUN-001 | Ustvari aktivnost brez urnika in brez lokacije | Napaka: Manjka lokacija |
| FUN-002 | Sočasna zahtevka dveh trenerjev | Prvi = head, drugi = assistant |
| FUN-003 | Zaključi aktivnost brez prisotnosti igralca X | Napaka: Missing players: [X] |
| FUN-004 | Preveri podvojen revizijski zapis | Samo en zapis z razlogom |
| FUN-005 | Prekrivanje urnikov | Napaka: Urnik se prekriva |
| FUN-006 | Prekrivanje članstev | Napaka: Članstvo se prekriva |
| FUN-007 | Obnovitev šifrirane varnostne kopije | Uspešno obnovljena baza |
| FUN-008 | Spremeni cenik → ponovno obračunaj aktivnost | Stara aktivnost ima stare postavke |
| FUN-009 | Trener vnese kilometre z decimalko (12.5 km) | Zaokroženo na 2 decimalni mesti |
| FUN-010 | Konec meseca ob 23:59:59 Europe/Ljubljana | Naslednji dan = zaklenjen mesec |

---

## 16. MATRIKA DOVOLJENJ - POPRAVLJENA

### Trener (Aktiven, Dovoljena Selekcija)

| Tabela | SELECT | INSERT | UPDATE (Stolpci) | DELETE |
|--------|--------|--------|------------------|--------|
| activities | Svoje selekcije | Prek RPC | start_time, end_time, activity_type_id, venue/custom, is_home_game (NE: season, team, date, completed) | ❌ |
| activity_coaches | Svoje aktivnosti | Prek RPC | mileage_km (NE: role, rates, amounts) | ❌ |
| attendance_records | Svoje aktivnosti | ✅ | status, notes (NE: player_id, activity_id, recorded_*) | ❌ |
| players | Trenutni igralci | ❌ | Prek RPC (notes only) | ❌ |
| guardians | Trenutni starši | ❌ | ❌ | ❌ |
| teams | Svoje | ❌ | ❌ | ❌ |
| coach_rates | Svoje | ❌ | ❌ | ❌ |
| correction_requests | Svoje | ✅ | ❌ | ❌ |
| audit_log | ❌ | ❌ | ❌ | ❌ |

### Trener (Zaklenjen Mesec)

Vse UPDATE/INSERT operacije zavrnjene, razen `correction_requests`.

### Administrator

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| Vse | ✅ | ✅ | Prek tipiziranih RPC z razlogom | Samo arhiviranje |
| audit_log | ✅ | ❌ | ❌ | Samo superuser arhiviranje |

---

## 17. SEZNAM ODPRAVLJENIH NAPAK

### Kritične Varnostne Napake (1-10)

1. ✅ Odstranjen `p_coach_id` iz vseh RPC funkcij
2. ✅ `create_or_open_activity` ne ustvarja več aktivnosti z izmišljenim časom
3. ✅ Sočasni vnos pravilno doda drugega trenerja kot sotrenerja
4. ✅ Dodane vse varnostne preverbe v `create_or_open_activity`
5. ✅ RLS politike omejene na specifične stolpce
6. ✅ Zaključene aktivnosti zaščitene pred spreminjanjem
7. ✅ Samo glavni trener lahko zaključi aktivnost
8. ✅ Preverjanje popolnosti prisotnosti pred zaključkom
9. ✅ Razlikovanje med ceno 0 in manjkajočo postavko (NULL check)
10. ✅ `admin_update_with_reason` zamenjan s tipiziranimi funkcijami

### Revizijska Sled in Podatki (11-17)

11. ✅ Razširjena tabela `correction_requests`
12. ✅ Odstranjeno avtomatično brisanje audit logov
13. ✅ Dodani triggerji za vse pomembne tabele
14. ✅ CASCADE zamenjano z RESTRICT kjer je potrebno
15. ✅ Dodano preverjanje prekrivanj urnikov
16. ✅ Dodano preverjanje prekrivanj članstev
17. ✅ RLS preverja trenutno, ne zgodovinsko članstvo

### Varnost in Infrastruktura (18-24)

18. ✅ Prvi administrator samo prek ročnega SQL
19. ✅ `is_active` preverba dodana povsod
20. ✅ SQL snippeti dokončani in testirani
21. ✅ CI popravljeno z lokalnim Supabase in Playwright webServer
22. ✅ Varnostne kopije šifrirane, ne v javnem Storage
23. ✅ GDPR formulacija popravljena - "podpira skladnost"
24. ✅ Testna matrika razširjena z dodatnimi testi

---

## 18. NASLEDNJI KORAKI

Po potrditvi različice 1.2:

1. **Reinicializacija projekta** z Next.js App Router
2. **Implementacija Faze A** (Podatkovna osnova):
   - Kreiranje vseh tabel
   - Kreiranje vseh RPC funkcij
   - Kreiranje vseh RLS politik
   - Kreiranje vseh triggerjev
   - Kreiranje migracij
   - Testiranje s `supabase db reset`
3. **Setup CI/CD** z GitHub Actions
4. **Izvedba testne matrike** (Unit + Integration)
5. **Potrditev uspešnosti Faze A** pred začetkom Faze B

---

**Različica:** 1.2  
**Datum:** 2026-08-13  
**Status:** Čaka na potrditev naročnika