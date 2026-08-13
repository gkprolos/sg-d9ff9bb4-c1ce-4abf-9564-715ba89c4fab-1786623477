-- Integracijski testi za RPC funkcije
-- Zaganja se v CI in lokalnem okolju

\set ON_ERROR_STOP on

BEGIN;

-- Helper funkcija za testiranje
CREATE OR REPLACE FUNCTION assert_equals(expected anyelement, actual anyelement, test_name TEXT)
RETURNS void AS $$
BEGIN
  IF expected IS DISTINCT FROM actual THEN
    RAISE EXCEPTION 'Test failed: % (Expected: %, Got: %)', test_name, expected, actual;
  ELSE
    RAISE NOTICE 'PASS: %', test_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PRIPRAVA TESTNIH PODATKOV
-- ============================================================================

-- Test uporabniki
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'admin@test.si', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'coach1@test.si', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'coach2@test.si', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', 'inactive@test.si', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW());

-- Profili
INSERT INTO public.profiles (id, email, first_name, last_name, is_active, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@test.si', 'Admin', 'Testni', true, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'coach1@test.si', 'Trener', 'Prvi', true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'coach2@test.si', 'Trener', 'Drugi', true, NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', 'inactive@test.si', 'Neaktiven', 'Uporabnik', false, NOW(), NOW());

-- Vloge
INSERT INTO public.user_roles (user_id, role, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'coach', NOW()),
  ('33333333-3333-3333-3333-333333333333', 'coach', NOW()),
  ('44444444-4444-4444-4444-444444444444', 'coach', NOW());

-- Sezona
INSERT INTO public.seasons (id, name, start_date, end_date, is_active, created_at, updated_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026/2027', '2026-09-01', '2027-06-30', true, NOW(), NOW());

-- Selekcija
INSERT INTO public.teams (id, season_id, name, short_name, category, is_archived, created_at, updated_at)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kadetinje 1', 'KAD1', 'U16_F', false, NOW(), NOW());

-- Dodeljeni trenerji
INSERT INTO public.team_coaches (team_id, coach_id, can_be_head_coach, can_be_assistant, is_active, created_at, updated_at)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', true, true, true, NOW(), NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', false, true, true, NOW(), NOW());

-- Igralci
INSERT INTO public.players (id, first_name, last_name, date_of_birth, is_active, created_at, updated_at)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Igralka', 'Ena', '2010-05-15', true, NOW(), NOW()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Igralka', 'Dva', '2010-08-22', true, NOW(), NOW());

-- Članstvo igralcev
INSERT INTO public.team_players (team_id, player_id, valid_from, valid_to, membership_status, created_at, updated_at)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-09-01', NULL, 'active', NOW(), NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-09-01', NULL, 'active', NOW(), NOW());

-- Urnik
INSERT INTO public.schedule_templates (team_id, day_of_week, start_time, end_time, default_activity_type, is_active, valid_from, created_at, updated_at)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, '17:30', '19:00', 1, true, '2026-09-01', NOW(), NOW());

-- Ceniki
INSERT INTO public.coach_rates (coach_id, season_id, head_rate_type1_per_hour, head_rate_type2_per_hour, head_rate_type3_fixed, assistant_rate_type1_per_hour, assistant_rate_type2_per_hour, assistant_rate_type3_fixed, rate_per_km, is_active, created_at, updated_at)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 20.00, 25.00, 50.00, 15.00, 20.00, 35.00, 0.37, true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 18.00, 23.00, 45.00, 13.00, 18.00, 30.00, 0.37, true, NOW(), NOW());

-- ============================================================================
-- TEST 1: create_or_open_activity - Nova aktivnost (glavni trener)
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222"}';
SET LOCAL role = authenticated;

SELECT public.create_or_open_activity(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
  '2026-12-15'::DATE,
  1,
  NULL::UUID,
  NULL::TEXT,
  '17:30'::TIME,
  '19:00'::TIME,
  NULL::BOOLEAN
);

SELECT assert_equals(
  1::BIGINT,
  (SELECT COUNT(*) FROM public.activities WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15'),
  'create_or_open_activity: Nova aktivnost ustvarjena'
);

SELECT assert_equals(
  'head'::TEXT,
  (SELECT role FROM public.activity_coaches WHERE activity_id = (SELECT id FROM public.activities WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15') AND coach_id = '22222222-2222-2222-2222-222222222222'),
  'create_or_open_activity: Trener je glavni trener'
);

-- ============================================================================
-- TEST 2: create_or_open_activity - Obstoječa aktivnost (dodaj sotrenerja)
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333"}';
SET LOCAL role = authenticated;

SELECT public.create_or_open_activity(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
  '2026-12-15'::DATE,
  1,
  NULL::UUID,
  NULL::TEXT,
  '17:30'::TIME,
  '19:00'::TIME,
  NULL::BOOLEAN
);

SELECT assert_equals(
  1::BIGINT,
  (SELECT COUNT(*) FROM public.activities WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15'),
  'create_or_open_activity: Samo ena aktivnost obstaja'
);

SELECT assert_equals(
  2::BIGINT,
  (SELECT COUNT(*) FROM public.activity_coaches WHERE activity_id = (SELECT id FROM public.activities WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15')),
  'create_or_open_activity: Dva trenerja na aktivnosti'
);

SELECT assert_equals(
  'assistant'::TEXT,
  (SELECT role FROM public.activity_coaches WHERE activity_id = (SELECT id FROM public.activities WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15') AND coach_id = '33333333-3333-3333-3333-333333333333'),
  'create_or_open_activity: Drugi trener je sotrener'
);

-- ============================================================================
-- TEST 3: Prepreči nepooblaščenega trenerja
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "44444444-4444-4444-4444-444444444444"}';
SET LOCAL role = authenticated;

DO $$
BEGIN
  PERFORM public.create_or_open_activity(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
    '2026-12-16'::DATE,
    1,
    NULL::UUID,
    NULL::TEXT,
    '17:30'::TIME,
    '19:00'::TIME,
    NULL::BOOLEAN
  );
  RAISE EXCEPTION 'Test should have failed: unauthorized coach';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%niste dodeljeni%' THEN
      RAISE EXCEPTION 'Wrong error: %', SQLERRM;
    END IF;
    RAISE NOTICE 'PASS: Nepooblaščen trener zavrnjen';
END;
$$;

-- ============================================================================
-- TEST 4: complete_activity_with_rates
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222"}';
SET LOCAL role = authenticated;

-- Dodaj prisotnost
INSERT INTO public.attendance_records (activity_id, player_id, status, recorded_by, created_at, updated_at)
SELECT 
  a.id,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::UUID,
  1,
  '22222222-2222-2222-2222-222222222222'::UUID,
  NOW(),
  NOW()
FROM public.activities a
WHERE a.team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND a.activity_date = '2026-12-15';

INSERT INTO public.attendance_records (activity_id, player_id, status, recorded_by, created_at, updated_at)
SELECT 
  a.id,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::UUID,
  1,
  '22222222-2222-2222-2222-222222222222'::UUID,
  NOW(),
  NOW()
FROM public.activities a
WHERE a.team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND a.activity_date = '2026-12-15';

-- Dodaj kilometre
UPDATE public.activity_coaches
SET mileage_km = 25
WHERE activity_id = (SELECT id FROM public.activities WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15')
  AND coach_id = '22222222-2222-2222-2222-222222222222';

-- Zaključi aktivnost
SELECT public.complete_activity_with_rates(
  (SELECT id FROM public.activities WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15')
);

SELECT assert_equals(
  true,
  (SELECT is_completed FROM public.activities WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15'),
  'complete_activity: Aktivnost zaključena'
);

-- Preveri obračun (1.5 ure * 20 EUR = 30 EUR + 25 km * 0.37 = 9.25 EUR = 39.25 EUR skupaj)
SELECT assert_equals(
  30.00,
  (SELECT activity_amount FROM public.activity_coaches WHERE activity_id = (SELECT id FROM public.activities WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15') AND coach_id = '22222222-2222-2222-2222-222222222222'),
  'complete_activity: Pravilni obračun aktivnosti'
);

SELECT assert_equals(
  9.25,
  (SELECT mileage_amount FROM public.activity_coaches WHERE activity_id = (SELECT id FROM public.activities WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15') AND coach_id = '22222222-2222-2222-2222-222222222222'),
  'complete_activity: Pravilni obračun kilometrine'
);

SELECT assert_equals(
  39.25,
  (SELECT total_amount FROM public.activity_coaches WHERE activity_id = (SELECT id FROM public.activities WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15') AND coach_id = '22222222-2222-2222-2222-222222222222'),
  'complete_activity: Pravilni skupni obračun'
);

-- ============================================================================
-- TEST 5: Prepreči spreminjanje zaključene aktivnosti
-- ============================================================================
DO $$
BEGIN
  UPDATE public.activities
  SET start_time = '18:00'
  WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15';
  RAISE EXCEPTION 'Test should have failed: cannot modify completed activity';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%zaključene aktivnosti%' THEN
      RAISE EXCEPTION 'Wrong error: %', SQLERRM;
    END IF;
    RAISE NOTICE 'PASS: Zaključena aktivnost zaščitena';
END;
$$;

-- ============================================================================
-- TEST 6: Prepreči spreminjanje finančnih snapshots
-- ============================================================================
DO $$
BEGIN
  UPDATE public.activity_coaches
  SET total_amount = 100.00
  WHERE activity_id = (SELECT id FROM public.activities WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND activity_date = '2026-12-15')
    AND coach_id = '22222222-2222-2222-2222-222222222222';
  RAISE EXCEPTION 'Test should have failed: cannot modify financial snapshots';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%finančnih podatkov%' THEN
      RAISE EXCEPTION 'Wrong error: %', SQLERRM;
    END IF;
    RAISE NOTICE 'PASS: Finančni snapshoti zaščiteni';
END;
$$;

-- ============================================================================
-- TEST 7: Revizijska sled nespremenljiva
-- ============================================================================
DO $$
BEGIN
  UPDATE public.audit_log SET old_values = '{}' WHERE id = (SELECT id FROM public.audit_log LIMIT 1);
  RAISE EXCEPTION 'Test should have failed: audit log immutable';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%nespremenljiva%' THEN
      RAISE EXCEPTION 'Wrong error: %', SQLERRM;
    END IF;
    RAISE NOTICE 'PASS: Revizijska sled nespremenljiva';
END;
$$;

-- ============================================================================
-- REZULTAT
-- ============================================================================
ROLLBACK;

\echo '============================================'
\echo 'VSI INTEGRACIJSKI TESTI SO PRESTALI'
\echo '============================================'