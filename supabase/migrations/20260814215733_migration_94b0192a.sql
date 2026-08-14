-- Drop old function and create new one with correct signature
DROP FUNCTION IF EXISTS create_or_open_activity(uuid,date,integer,uuid,text,time,time,boolean);

-- Create new simplified function
CREATE OR REPLACE FUNCTION create_or_open_activity(
  p_team_id uuid,
  p_activity_date date,
  p_activity_type_id integer,
  p_venue_id uuid DEFAULT NULL,
  p_custom_venue text DEFAULT NULL,
  p_start_time time DEFAULT NULL,
  p_end_time time DEFAULT NULL,
  p_is_home_game boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_id uuid;
  v_season_id uuid;
  v_coach_id uuid;
  v_existing_activity record;
  v_coach_count int;
  v_profile_active boolean;
  v_user_role text;
BEGIN
  v_coach_id := auth.uid();
  
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Uporabnik ni prijavljen';
  END IF;

  SELECT is_active INTO v_profile_active
  FROM profiles
  WHERE id = v_coach_id;

  IF NOT FOUND OR v_profile_active IS FALSE THEN
    RAISE EXCEPTION 'Profil ni aktiven';
  END IF;

  SELECT role INTO v_user_role
  FROM user_roles
  WHERE user_id = v_coach_id
    AND role IN ('coach', 'admin');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nimaš pravic trenerja ali administratorja';
  END IF;

  SELECT season_id INTO v_season_id
  FROM teams
  WHERE id = p_team_id
    AND is_archived = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selekcija ne obstaja ali je arhivirana';
  END IF;

  IF EXISTS (
    SELECT 1 FROM seasons
    WHERE id = v_season_id AND is_archived = true
  ) THEN
    RAISE EXCEPTION 'Sezona je arhivirana';
  END IF;

  SELECT * INTO v_existing_activity
  FROM activities
  WHERE team_id = p_team_id
    AND activity_date = p_activity_date
    AND season_id = v_season_id;

  IF FOUND THEN
    v_activity_id := v_existing_activity.id;

    SELECT COUNT(*) INTO v_coach_count
    FROM activity_coaches
    WHERE activity_id = v_activity_id;

    IF EXISTS (
      SELECT 1 FROM activity_coaches
      WHERE activity_id = v_activity_id
        AND coach_id = v_coach_id
    ) THEN
      RETURN json_build_object(
        'activity_id', v_activity_id,
        'is_new', false,
        'role', (
          SELECT role FROM activity_coaches
          WHERE activity_id = v_activity_id AND coach_id = v_coach_id
        )
      );
    END IF;

    IF v_coach_count >= 2 THEN
      RAISE EXCEPTION 'Za to aktivnost sta že dodeljena dva trenerja. Tretji trener ni dovoljen.';
    END IF;

    INSERT INTO activity_coaches (activity_id, coach_id, role)
    VALUES (v_activity_id, v_coach_id, 'assistant');

    RETURN json_build_object(
      'activity_id', v_activity_id,
      'is_new', false,
      'role', 'assistant'
    );
  ELSE
    BEGIN
      INSERT INTO activities (
        team_id,
        season_id,
        activity_date,
        activity_type_id,
        venue_id,
        custom_venue,
        start_time,
        end_time,
        is_home_game,
        created_by
      ) VALUES (
        p_team_id,
        v_season_id,
        p_activity_date,
        p_activity_type_id,
        p_venue_id,
        p_custom_venue,
        p_start_time,
        p_end_time,
        p_is_home_game,
        v_coach_id
      )
      RETURNING id INTO v_activity_id;

      INSERT INTO activity_coaches (activity_id, coach_id, role)
      VALUES (v_activity_id, v_coach_id, 'head');

      RETURN json_build_object(
        'activity_id', v_activity_id,
        'is_new', true,
        'role', 'head'
      );

    EXCEPTION
      WHEN unique_violation THEN
        SELECT id INTO v_activity_id
        FROM activities
        WHERE team_id = p_team_id
          AND activity_date = p_activity_date
          AND season_id = v_season_id;

        SELECT COUNT(*) INTO v_coach_count
        FROM activity_coaches
        WHERE activity_id = v_activity_id;

        IF v_coach_count >= 2 THEN
          RAISE EXCEPTION 'Za to aktivnost sta že dodeljena dva trenerja. Tretji trener ni dovoljen.';
        END IF;

        INSERT INTO activity_coaches (activity_id, coach_id, role)
        VALUES (v_activity_id, v_coach_id, 'assistant')
        ON CONFLICT (activity_id, coach_id) DO NOTHING;

        RETURN json_build_object(
          'activity_id', v_activity_id,
          'is_new', false,
          'role', 'assistant'
        );
    END;
  END IF;
END;
$$;

-- Verify function exists
SELECT 'RPC function created successfully' as status;