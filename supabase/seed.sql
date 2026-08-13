-- Seed podatki za razvojno in testno okolje
-- OPOZORILO: Ne vsebuje pravih osebnih podatkov
-- Datum: 2026-08-13

-- Počisti obstoječe podatke (če obstajajo)
TRUNCATE TABLE 
  public.audit_log,
  public.data_subject_requests,
  public.correction_requests,
  public.coach_rates,
  public.player_forms,
  public.form_types,
  public.attendance_records,
  public.activity_coaches,
  public.activities,
  public.schedule_templates,
  public.team_coaches,
  public.team_players,
  public.player_guardians,
  public.guardians,
  public.players,
  public.venues,
  public.teams,
  public.seasons,
  public.user_roles,
  public.profiles
CASCADE;

-- ============================================================================
-- UPORABNIKI (preko auth.users)
-- ============================================================================
-- OPOMBA: V produkciji se uporabniki ustvarijo preko Supabase Auth
-- Tu dodamo samo profile za testiranje

-- Admin uporabnik
INSERT INTO public.profiles (id, email, full_name, phone, is_active)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'admin@test.local', 'Testni Administrator', '+386 31 123 456', true);

INSERT INTO public.user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin');

-- Trenerji
INSERT INTO public.profiles (id, email, full_name, phone, is_active)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'trener1@test.local', 'Marko Novak', '+386 31 234 567', true),
  ('00000000-0000-0000-0000-000000000003', 'trener2@test.local', 'Ana Horvat', '+386 31 345 678', true),
  ('00000000-0000-0000-0000-000000000004', 'trener3@test.local', 'Peter Kovač', '+386 31 456 789', true);

INSERT INTO public.user_roles (user_id, role)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'coach'),
  ('00000000-0000-0000-0000-000000000003', 'coach'),
  ('00000000-0000-0000-0000-000000000004', 'coach');

-- ============================================================================
-- SEZONE
-- ============================================================================
INSERT INTO public.seasons (id, name, start_date, end_date, is_active, is_archived)
VALUES 
  ('10000000-0000-0000-0000-000000000001', '2025/2026', '2025-09-01', '2026-06-30', false, true),
  ('10000000-0000-0000-0000-000000000002', '2026/2027', '2026-09-01', '2027-06-30', true, false);

-- ============================================================================
-- SELEKCIJE
-- ============================================================================
INSERT INTO public.teams (id, season_id, name, short_name, age_category, gender, is_archived)
VALUES 
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Kadetinje 1', 'U17-Ž1', 'U17', 'F', false),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Mladinke', 'U19-Ž', 'U19', 'F', false),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Kadeti 1', 'U17-M1', 'U17', 'M', false);

-- ============================================================================
-- DVORANE
-- ============================================================================
INSERT INTO public.venues (id, name, address, city, room_designation, is_active)
VALUES 
  ('30000000-0000-0000-0000-000000000001', 'OŠ Prežihovega Voranca', 'Ulica bratov Učakar 98', 'Ljubljana', 'Velika dvorana', true),
  ('30000000-0000-0000-0000-000000000002', 'OŠ Ledina', 'Zaloška cesta 49', 'Ljubljana', 'Športna dvorana', true),
  ('30000000-0000-0000-0000-000000000003', 'Športna dvorana Tivoli', 'Celovška cesta 25', 'Ljubljana', 'Glavna dvorana', true);

-- ============================================================================
-- IGRALCI
-- ============================================================================
INSERT INTO public.players (id, first_name, last_name, date_of_birth, address, postal_code, city, is_active)
VALUES 
  ('40000000-0000-0000-0000-000000000001', 'Eva', 'Novak', '2009-03-15', 'Slovenska cesta 10', '1000', 'Ljubljana', true),
  ('40000000-0000-0000-0000-000000000002', 'Maja', 'Kovačič', '2009-07-22', 'Dunajska cesta 20', '1000', 'Ljubljana', true),
  ('40000000-0000-0000-0000-000000000003', 'Lara', 'Horvat', '2008-11-05', 'Tržaška cesta 30', '1000', 'Ljubljana', true),
  ('40000000-0000-0000-0000-000000000004', 'Nina', 'Zupan', '2009-01-18', 'Celovška cesta 40', '1000', 'Ljubljana', true),
  ('40000000-0000-0000-0000-000000000005', 'Sara', 'Krajnc', '2009-09-30', 'Dolenjska cesta 50', '1000', 'Ljubljana', true);

-- ============================================================================
-- STARŠI
-- ============================================================================
INSERT INTO public.guardians (id, first_name, last_name, phone, email)
VALUES 
  ('50000000-0000-0000-0000-000000000001', 'Janez', 'Novak', '+386 41 111 111', 'janez.novak@example.com'),
  ('50000000-0000-0000-0000-000000000002', 'Marija', 'Novak', '+386 41 222 222', 'marija.novak@example.com'),
  ('50000000-0000-0000-0000-000000000003', 'Tomaž', 'Kovačič', '+386 41 333 333', 'tomaz.kovacic@example.com'),
  ('50000000-0000-0000-0000-000000000004', 'Petra', 'Kovačič', '+386 41 444 444', 'petra.kovacic@example.com');

-- ============================================================================
-- POVEZAVE IGRALEC-STARŠ
-- ============================================================================
INSERT INTO public.player_guardians (player_id, guardian_id, relationship, is_primary)
VALUES 
  ('40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'father', true),
  ('40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', 'mother', false),
  ('40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', 'father', true),
  ('40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000004', 'mother', false);

-- ============================================================================
-- ČLANSTVA IGRALCEV V SELEKCIJAH
-- ============================================================================
INSERT INTO public.team_players (team_id, player_id, valid_from, valid_to, membership_status)
VALUES 
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '2026-09-01', NULL, 'active'),
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '2026-09-01', NULL, 'active'),
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '2026-09-01', NULL, 'active'),
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', '2026-09-01', NULL, 'active'),
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005', '2026-09-01', NULL, 'active');

-- ============================================================================
-- DODELITVE TRENERJEV SELEKCIJAM
-- ============================================================================
INSERT INTO public.team_coaches (team_id, coach_id, can_be_head_coach, can_be_assistant, is_active)
VALUES 
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', true, false, true),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', false, true, true),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', true, false, true),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', true, true, true);

-- ============================================================================
-- REDNI URNIKI
-- ============================================================================
INSERT INTO public.schedule_templates (
  team_id, day_of_week, start_time, end_time, venue_id, default_activity_type_id, valid_from, valid_to, is_active
)
VALUES 
  -- Kadetinje 1: Ponedeljek, Sreda
  ('20000000-0000-0000-0000-000000000001', 1, '17:30', '19:00', '30000000-0000-0000-0000-000000000001', 1, '2026-09-01', NULL, true),
  ('20000000-0000-0000-0000-000000000001', 3, '17:30', '19:00', '30000000-0000-0000-0000-000000000001', 1, '2026-09-01', NULL, true),
  -- Mladinke: Torek, Četrtek
  ('20000000-0000-0000-0000-000000000002', 2, '18:00', '19:30', '30000000-0000-0000-0000-000000000002', 1, '2026-09-01', NULL, true),
  ('20000000-0000-0000-0000-000000000002', 4, '18:00', '19:30', '30000000-0000-0000-0000-000000000002', 1, '2026-09-01', NULL, true),
  -- Kadeti 1: Ponedeljek, Petek
  ('20000000-0000-0000-0000-000000000003', 1, '19:00', '20:30', '30000000-0000-0000-0000-000000000003', 1, '2026-09-01', NULL, true),
  ('20000000-0000-0000-0000-000000000003', 5, '17:00', '18:30', '30000000-0000-0000-0000-000000000003', 1, '2026-09-01', NULL, true);

-- ============================================================================
-- VRSTE OBRAZCEV
-- ============================================================================
INSERT INTO public.form_types (id, name, description, is_required, is_active, display_order)
VALUES 
  ('60000000-0000-0000-0000-000000000001', 'Prijavni obrazec', 'Prijavni obrazec za klub', true, true, 1),
  ('60000000-0000-0000-0000-000000000002', 'Obrazec 1B', 'Zdravstveno potrdilo 1B', true, true, 2),
  ('60000000-0000-0000-0000-000000000003', 'Strinjanje s fotografiranjem', 'Soglasje za objavo fotografij', false, true, 3);

-- ============================================================================
-- STATUSI OBRAZCEV IGRALCEV
-- ============================================================================
INSERT INTO public.player_forms (player_id, form_type_id, status, received_date, recorded_by)
VALUES 
  ('40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'received', '2026-09-05', '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 'received', '2026-09-10', '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'received', '2026-09-06', '00000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', 'not_received', NULL, NULL);

-- ============================================================================
-- FINANČNE POSTAVKE TRENERJEV
-- ============================================================================
INSERT INTO public.coach_rates (
  coach_id, season_id,
  head_type1_per_hour, head_type2_per_hour, head_type3_fixed,
  assistant_type1_per_hour, assistant_type2_per_hour, assistant_type3_fixed,
  rate_per_km, is_active
)
VALUES 
  -- Marko Novak (Trener 1)
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
   25.00, 30.00, 50.00,
   15.00, 18.00, 30.00,
   0.37, true),
  -- Ana Horvat (Trener 2)
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002',
   28.00, 33.00, 55.00,
   16.00, 19.00, 32.00,
   0.37, true),
  -- Peter Kovač (Trener 3)
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002',
   30.00, 35.00, 60.00,
   18.00, 20.00, 35.00,
   0.37, true);

COMMENT ON TABLE public.profiles IS 'Seed data: Test users and coaches';