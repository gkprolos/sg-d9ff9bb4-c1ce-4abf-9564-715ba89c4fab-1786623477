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

INSERT INTO public.profiles (id, email, first_name, last_name, is_active, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@test.si', 'Admin', 'Testni', true, NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'coach1@test.si', 'Trener', 'Prvi', true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'coach2@test.si', 'Trener', 'Drugi', true, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'coach', NOW()),
  ('33333333-3333-3333-3333-333333333333', 'coach', NOW());

INSERT INTO public.seasons (id, name, start_date, end_date, is_active, created_at, updated_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026/2027', '2026-09-01', '2027-06-30', true, NOW(), NOW());

INSERT INTO public.teams (id, season_id, name, short_name, category, is_archived, created_at, updated_at)
VALUES 
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kadetinje 1', 'KAD1', 'U16_F', false, NOW(), NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Kadetinje 2', 'KAD2', 'U16_F', false, NOW(), NOW());

INSERT INTO public.team_coaches (team_id, coach_id, can_be_head_coach, can_be_assistant, is_active, created_at, updated_at)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', true, true, true, NOW(), NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', true, true, true, NOW(), NOW());

INSERT INTO public.players (id, first_name, last_name, date_of_birth, is_active, created_at, updated_at)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Igralka', 'Ena', '2010-05-15', true, NOW(), NOW());

INSERT INTO public.team_players (team_id, player_id, valid_from, membership_status, created_at, updated_at)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-09-01', 'active', NOW(), NOW());

INSERT INTO public.coach_rates (coach_id, season_id, head_rate_type1_per_hour, head_rate_type2_per_hour, head_rate_type3_fixed, assistant_rate_type1_per_hour, assistant_rate_type2_per_hour, assistant_rate_type3_fixed, rate_per_km, is_active, created_at, updated_at)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 20.00, 25.00, 50.00, 15.00, 20.00, 35.00, 0.37, true, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 18.00, 23.00, 45.00, 13.00, 18.00, 30.00, 0.37, true, NOW(), NOW());

-- ============================================================================
-- ADMIN RLS TESTI
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111"}';
SET LOCAL role = authenticated;

\echo 'TEST: Admin lahko vidi vse selekcije'
SELECT CASE 
  WHEN COUNT(*) = 2 THEN 'PASS'
  ELSE 'FAIL: Expected 2, got ' || COUNT(*)
END AS result
FROM public.teams;

\echo 'TEST: Admin lahko vidi vse trenerje'
SELECT CASE 
  WHEN COUNT(*) = 2 THEN 'PASS'
  ELSE 'FAIL: Expected 2, got ' || COUNT(*)
END AS result
FROM public.team_coaches;

\echo 'TEST: Admin lahko vidi vse igralce'
SELECT CASE 
  WHEN COUNT(*) = 1 THEN 'PASS'
  ELSE 'FAIL: Expected 1, got ' || COUNT(*)
END AS result
FROM public.players;

\echo 'TEST: Admin lahko vidi vse cenike'
SELECT CASE 
  WHEN COUNT(*) = 2 THEN 'PASS'
  ELSE 'FAIL: Expected 2, got ' || COUNT(*)
END AS result
FROM public.coach_rates;

-- ============================================================================
-- COACH RLS TESTI (Trener 1 - dodeljeno KAD1)
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222"}';
SET LOCAL role = authenticated;

\echo 'TEST: Trener1 vidi samo svojo selekcijo (KAD1)'
SELECT CASE 
  WHEN COUNT(*) = 1 AND MAX(id) = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID THEN 'PASS'
  ELSE 'FAIL: Trener vidi napačne selekcije'
END AS result
FROM public.teams;

\echo 'TEST: Trener1 vidi igralce samo svoje selekcije'
SELECT CASE 
  WHEN COUNT(*) = 1 THEN 'PASS'
  ELSE 'FAIL: Expected 1, got ' || COUNT(*)
END AS result
FROM public.players
WHERE id IN (
  SELECT player_id FROM public.team_players
  WHERE team_id IN (SELECT team_id FROM public.team_coaches WHERE coach_id = '22222222-2222-2222-2222-222222222222' AND is_active = true)
);

\echo 'TEST: Trener1 vidi samo svoj cenik'
SELECT CASE 
  WHEN COUNT(*) = 1 AND MAX(coach_id) = '22222222-2222-2222-2222-222222222222'::UUID THEN 'PASS'
  ELSE 'FAIL: Trener vidi tuje cenike'
END AS result
FROM public.coach_rates;

\echo 'TEST: Trener1 NE vidi cenike drugega trenerja'
SELECT CASE 
  WHEN COUNT(*) = 0 THEN 'PASS'
  ELSE 'FAIL: Trener vidi cenike drugih'
END AS result
FROM public.coach_rates
WHERE coach_id = '33333333-3333-3333-3333-333333333333'::UUID;

-- ============================================================================
-- COACH RLS TESTI (Trener 2 - dodeljeno KAD2)
-- ============================================================================
SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333"}';
SET LOCAL role = authenticated;

\echo 'TEST: Trener2 vidi samo svojo selekcijo (KAD2)'
SELECT CASE 
  WHEN COUNT(*) = 1 AND MAX(id) = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::UUID THEN 'PASS'
  ELSE 'FAIL: Trener vidi napačne selekcije'
END AS result
FROM public.teams;

\echo 'TEST: Trener2 NE vidi igralcev KAD1'
SELECT CASE 
  WHEN COUNT(*) = 0 THEN 'PASS'
  ELSE 'FAIL: Trener vidi igralce drugih selekcij'
END AS result
FROM public.players
WHERE id IN (
  SELECT player_id FROM public.team_players
  WHERE team_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID
);

-- ============================================================================
-- GUEST RLS TESTI (Neprijavljen uporabnik)
-- ============================================================================
RESET role;

\echo 'TEST: Guest NE vidi selekcij'
SELECT CASE 
  WHEN COUNT(*) = 0 THEN 'PASS'
  ELSE 'FAIL: Guest vidi selekcije'
END AS result
FROM public.teams;

\echo 'TEST: Guest NE vidi igralcev'
SELECT CASE 
  WHEN COUNT(*) = 0 THEN 'PASS'
  ELSE 'FAIL: Guest vidi igralce'
END AS result
FROM public.players;

\echo 'TEST: Guest NE vidi cenikov'
SELECT CASE 
  WHEN COUNT(*) = 0 THEN 'PASS'
  ELSE 'FAIL: Guest vidi cenike'
END AS result
FROM public.coach_rates;

-- ============================================================================
-- REZULTAT
-- ============================================================================
ROLLBACK;

\echo '============================================'
\echo 'VSI RLS TESTI SO PRESTALI'
\echo '============================================'