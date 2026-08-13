-- RLS testna matrika
-- Preveri dovoljenja za admin/coach/guest

\set ON_ERROR_STOP on

BEGIN;

-- Priprava testnih podatkov (isto kot v integration testih)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'admin@test.si', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'coach1@test.si', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'coach2@test.si', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW());

-- Profili (full_name, ne first_name/last_name)
INSERT INTO public.profiles (id, email, full_name, is_active, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@test.si', 'Admin Testni', true, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'coach1@test.si', 'Trener Prvi', true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'coach2@test.si', 'Trener Drugi', true, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'coach', NOW()),
  ('33333333-3333-3333-3333-333333333333', 'coach', NOW());

INSERT INTO public.seasons (id, name, start_date, end_date, is_active, created_at, updated_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026/2027', '2026-09-01', '2027-06-30', true, NOW(), NOW());

-- Selekcije (brez category, uporablja age_category)
INSERT INTO public.teams (id, season_id, name, short_name, age_category, gender, is_archived, created_at, updated_at)
VALUES 
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kadetinje 1', 'KAD1', 'U16', 'F', false, NOW(), NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kadetinje 2', 'KAD2', 'U16', 'F', false, NOW(), NOW());

INSERT INTO public.team_coaches (team_id, coach_id, can_be_head_coach, can_be_assistant, is_active, created_at, updated_at)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', true, true, true, NOW(), NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', true, true, true, NOW(), NOW());

INSERT INTO public.players (id, first_name, last_name, date_of_birth, is_active, created_at, updated_at)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Igralka', 'Ena', '2010-05-15', true, NOW(), NOW());

INSERT INTO public.team_players (team_id, player_id, valid_from, membership_status, created_at, updated_at)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-09-01', 'active', NOW(), NOW());

-- Ceniki (pravilna imena stolpcev)
INSERT INTO public.coach_rates (
  coach_id, season_id,
  head_type1_per_hour, head_type2_per_hour, head_type3_fixed,
  assistant_type1_per_hour, assistant_type2_per_hour, assistant_type3_fixed,
  rate_per_km, is_active, created_at, updated_at
)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   20.00, 25.00, 50.00, 15.00, 20.00, 35.00, 0.37, true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   18.00, 23.00, 45.00, 13.00, 18.00, 30.00, 0.37, true, NOW(), NOW());

-- ============================================================================
-- ADMIN RLS TESTI
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111"}';
SET LOCAL role = authenticated;

\echo 'TEST: Admin lahko vidi vse selekcije'
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.teams) != 2 THEN
    RAISE EXCEPTION 'TEST FAILED: Admin should see 2 teams, got %', (SELECT COUNT(*) FROM public.teams);
  END IF;
  RAISE NOTICE 'PASS: Admin vidi vse selekcije';
END $$;

\echo 'TEST: Admin lahko vidi vse trenerje'
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.team_coaches) != 2 THEN
    RAISE EXCEPTION 'TEST FAILED: Admin should see 2 coach assignments, got %', (SELECT COUNT(*) FROM public.team_coaches);
  END IF;
  RAISE NOTICE 'PASS: Admin vidi vse trenerje';
END $$;

\echo 'TEST: Admin lahko vidi vse igralce'
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.players) != 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Admin should see 1 player, got %', (SELECT COUNT(*) FROM public.players);
  END IF;
  RAISE NOTICE 'PASS: Admin vidi vse igralce';
END $$;

\echo 'TEST: Admin lahko vidi vse cenike'
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.coach_rates) != 2 THEN
    RAISE EXCEPTION 'TEST FAILED: Admin should see 2 rates, got %', (SELECT COUNT(*) FROM public.coach_rates);
  END IF;
  RAISE NOTICE 'PASS: Admin vidi vse cenike';
END $$;

-- ============================================================================
-- COACH RLS TESTI (Trener 1 - dodeljeno KAD1)
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222"}';
SET LOCAL role = authenticated;

\echo 'TEST: Trener1 vidi samo svojo selekcijo (KAD1)'
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.teams) != 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Coach1 should see 1 team, got %', (SELECT COUNT(*) FROM public.teams);
  END IF;
  IF (SELECT id FROM public.teams LIMIT 1) != 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID THEN
    RAISE EXCEPTION 'TEST FAILED: Coach1 should see KAD1';
  END IF;
  RAISE NOTICE 'PASS: Trener1 vidi samo svojo selekcijo';
END $$;

\echo 'TEST: Trener1 vidi igralce samo svoje selekcije'
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.players) != 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Coach1 should see 1 player, got %', (SELECT COUNT(*) FROM public.players);
  END IF;
  RAISE NOTICE 'PASS: Trener1 vidi igralce samo svoje selekcije';
END $$;

\echo 'TEST: Trener1 vidi samo svoj cenik'
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.coach_rates) != 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Coach1 should see 1 rate, got %', (SELECT COUNT(*) FROM public.coach_rates);
  END IF;
  IF (SELECT coach_id FROM public.coach_rates LIMIT 1) != '22222222-2222-2222-2222-222222222222'::UUID THEN
    RAISE EXCEPTION 'TEST FAILED: Coach1 should see own rates only';
  END IF;
  RAISE NOTICE 'PASS: Trener1 vidi samo svoj cenik';
END $$;

\echo 'TEST: Trener1 NE vidi cenike drugega trenerja'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.coach_rates WHERE coach_id = '33333333-3333-3333-3333-333333333333'::UUID) THEN
    RAISE EXCEPTION 'TEST FAILED: Coach1 should not see other coach rates';
  END IF;
  RAISE NOTICE 'PASS: Trener1 NE vidi cenike drugih';
END $$;

-- ============================================================================
-- COACH RLS TESTI (Trener 2 - dodeljeno KAD2)
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333"}';
SET LOCAL role = authenticated;

\echo 'TEST: Trener2 vidi samo svojo selekcijo (KAD2)'
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.teams) != 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Coach2 should see 1 team, got %', (SELECT COUNT(*) FROM public.teams);
  END IF;
  IF (SELECT id FROM public.teams LIMIT 1) != 'cccccccc-cccc-cccc-cccc-cccccccccccc'::UUID THEN
    RAISE EXCEPTION 'TEST FAILED: Coach2 should see KAD2';
  END IF;
  RAISE NOTICE 'PASS: Trener2 vidi samo svojo selekcijo';
END $$;

\echo 'TEST: Trener2 NE vidi igralcev KAD1'
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.players) != 0 THEN
    RAISE EXCEPTION 'TEST FAILED: Coach2 should not see KAD1 players, got %', (SELECT COUNT(*) FROM public.players);
  END IF;
  RAISE NOTICE 'PASS: Trener2 NE vidi igralcev drugih selekcij';
END $$;

-- ============================================================================
-- GUEST RLS TESTI (Neprijavljen uporabnik)
-- ============================================================================
RESET role;

\echo 'TEST: Guest NE vidi selekcij'
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.teams) != 0 THEN
    RAISE EXCEPTION 'TEST FAILED: Guest should not see teams, got %', (SELECT COUNT(*) FROM public.teams);
  END IF;
  RAISE NOTICE 'PASS: Guest NE vidi selekcij';
END $$;

\echo 'TEST: Guest NE vidi igralcev'
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.players) != 0 THEN
    RAISE EXCEPTION 'TEST FAILED: Guest should not see players, got %', (SELECT COUNT(*) FROM public.players);
  END IF;
  RAISE NOTICE 'PASS: Guest NE vidi igralcev';
END $$;

\echo 'TEST: Guest NE vidi cenikov'
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.coach_rates) != 0 THEN
    RAISE EXCEPTION 'TEST FAILED: Guest should not see rates, got %', (SELECT COUNT(*) FROM public.coach_rates);
  END IF;
  RAISE NOTICE 'PASS: Guest NE vidi cenikov';
END $$;

-- ============================================================================
-- REZULTAT
-- ============================================================================
ROLLBACK;

\echo '============================================'
\echo 'VSI RLS TESTI SO PRESTALI'
\echo '============================================'