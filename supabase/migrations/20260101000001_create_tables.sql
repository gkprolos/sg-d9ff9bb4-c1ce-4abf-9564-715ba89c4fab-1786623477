-- Migracija 1: Kreiranje vseh tabel
-- Datum: 2026-08-13
-- Opis: Kreiranje kompletne podatkovne sheme za športni klub

-- ============================================================================
-- TABELA: profiles
-- Opis: Profil uporabnika, povezan z auth.users
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);

COMMENT ON TABLE profiles IS 'User profiles linked to auth.users';

-- ============================================================================
-- TABELA: user_roles
-- Opis: Uporabniške vloge (admin, coach, parent, pending)
-- ============================================================================
CREATE TABLE user_roles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'coach', 'parent', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_roles_role ON user_roles(role);

COMMENT ON TABLE user_roles IS 'User roles: admin, coach, parent, pending';

-- ============================================================================
-- TABELA: seasons
-- Opis: Sezone (npr. 2026/2027)
-- ============================================================================
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_season_dates CHECK (end_date > start_date),
  CONSTRAINT only_one_active EXCLUDE (is_active WITH =) WHERE (is_active = true AND is_archived = false)
);

CREATE INDEX idx_seasons_is_active ON seasons(is_active) WHERE is_active = true;
CREATE INDEX idx_seasons_is_archived ON seasons(is_archived);

COMMENT ON TABLE seasons IS 'Sports seasons (e.g., 2026/2027)';

-- ============================================================================
-- TABELA: teams
-- Opis: Selekcije (npr. Kadetinje 1)
-- ============================================================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  short_name TEXT,
  age_category TEXT,
  gender TEXT CHECK (gender IN ('M', 'F', 'Mixed')),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (season_id, name)
);

CREATE INDEX idx_teams_season ON teams(season_id);
CREATE INDEX idx_teams_is_archived ON teams(is_archived);

COMMENT ON TABLE teams IS 'Teams/selections within a season';

-- ============================================================================
-- TABELA: venues
-- Opis: Dvorane
-- ============================================================================
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  room_designation TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_venues_is_active ON venues(is_active);

COMMENT ON TABLE venues IS 'Sports venues/gyms';

-- ============================================================================
-- TABELA: players
-- Opis: Igralci
-- ============================================================================
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  player_phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_date DATE,
  left_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_is_active ON players(is_active);
CREATE INDEX idx_players_last_name ON players(last_name);

COMMENT ON TABLE players IS 'Players in the sports club';

-- ============================================================================
-- TABELA: guardians
-- Opis: Starši/skrbniki
-- ============================================================================
CREATE TABLE guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guardians_email ON guardians(email);
CREATE INDEX idx_guardians_profile_id ON guardians(profile_id);

COMMENT ON TABLE guardians IS 'Parents/guardians of players';
COMMENT ON COLUMN guardians.profile_id IS 'Linked auth profile for future parent portal';

-- ============================================================================
-- TABELA: player_guardians
-- Opis: Povezava igralec-starš (M:N)
-- ============================================================================
CREATE TABLE player_guardians (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  relationship TEXT CHECK (relationship IN ('mother', 'father', 'guardian', 'other')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  PRIMARY KEY (player_id, guardian_id)
);

CREATE INDEX idx_player_guardians_guardian ON player_guardians(guardian_id);
CREATE INDEX idx_player_guardians_primary ON player_guardians(is_primary) WHERE is_primary = true;

COMMENT ON TABLE player_guardians IS 'Player-guardian relationships';

-- ============================================================================
-- TABELA: team_players
-- Opis: Povezava igralec-selekcija z veljavnim obdobjem
-- ============================================================================
CREATE TABLE team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,
  membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'inactive', 'transferred')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_membership_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX idx_team_players_team ON team_players(team_id);
CREATE INDEX idx_team_players_player ON team_players(player_id);
CREATE INDEX idx_team_players_status ON team_players(membership_status);
CREATE INDEX idx_team_players_valid ON team_players(valid_from, valid_to);

COMMENT ON TABLE team_players IS 'Player memberships in teams with validity period';

-- ============================================================================
-- TABELA: team_coaches
-- Opis: Povezava trener-selekcija
-- ============================================================================
CREATE TABLE team_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  can_be_head_coach BOOLEAN NOT NULL DEFAULT false,
  can_be_assistant BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (team_id, coach_id),
  CONSTRAINT at_least_one_role CHECK (can_be_head_coach = true OR can_be_assistant = true)
);

CREATE INDEX idx_team_coaches_team ON team_coaches(team_id);
CREATE INDEX idx_team_coaches_coach ON team_coaches(coach_id);
CREATE INDEX idx_team_coaches_is_active ON team_coaches(is_active);

COMMENT ON TABLE team_coaches IS 'Coach assignments to teams';

-- ============================================================================
-- TABELA: schedule_templates
-- Opis: Redni urniki
-- ============================================================================
CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  custom_venue TEXT,
  default_activity_type_id INT NOT NULL CHECK (default_activity_type_id IN (1, 2, 3)),
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_schedule_dates CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT valid_times CHECK (end_time > start_time),
  CONSTRAINT venue_xor_custom CHECK (
    (venue_id IS NOT NULL AND custom_venue IS NULL) OR
    (venue_id IS NULL AND custom_venue IS NOT NULL)
  )
);

CREATE INDEX idx_schedule_team ON schedule_templates(team_id);
CREATE INDEX idx_schedule_day ON schedule_templates(day_of_week);
CREATE INDEX idx_schedule_is_active ON schedule_templates(is_active);

COMMENT ON TABLE schedule_templates IS 'Regular training schedules';
COMMENT ON COLUMN schedule_templates.day_of_week IS '1=Monday, 7=Sunday (ISO 8601)';

-- ============================================================================
-- TABELA: activities
-- Opis: Aktivnosti (treningi, tekme)
-- ============================================================================
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL,
  team_id UUID NOT NULL,
  activity_date DATE NOT NULL,
  activity_type_id INT NOT NULL CHECK (activity_type_id IN (1, 2, 3)),
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  custom_venue TEXT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_home_game BOOLEAN,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  FOREIGN KEY (team_id, season_id) REFERENCES teams(id, season_id) ON DELETE RESTRICT,
  CONSTRAINT valid_times CHECK (end_time > start_time),
  CONSTRAINT venue_xor_custom CHECK (
    (venue_id IS NOT NULL AND custom_venue IS NULL) OR
    (venue_id IS NULL AND custom_venue IS NOT NULL) OR
    (venue_id IS NULL AND custom_venue IS NULL AND activity_type_id IN (2, 3))
  ),
  CONSTRAINT home_game_only_for_type3 CHECK (
    (activity_type_id = 3 AND is_home_game IS NOT NULL) OR
    (activity_type_id IN (1, 2) AND is_home_game IS NULL)
  ),
  UNIQUE (season_id, team_id, activity_date)
);

CREATE INDEX idx_activities_team ON activities(team_id);
CREATE INDEX idx_activities_season ON activities(season_id);
CREATE INDEX idx_activities_date ON activities(activity_date);
CREATE INDEX idx_activities_is_completed ON activities(is_completed);
CREATE INDEX idx_activities_created_by ON activities(created_by);

COMMENT ON TABLE activities IS 'Training sessions and matches';
COMMENT ON COLUMN activities.activity_type_id IS '1=Training in gym, 2=Training/prep match outside, 3=Official match';

-- ============================================================================
-- TABELA: activity_coaches
-- Opis: Trenerji na aktivnosti
-- ============================================================================
CREATE TABLE activity_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('head', 'assistant')),
  mileage_km NUMERIC(10, 2) DEFAULT 0 CHECK (mileage_km >= 0),
  
  -- Rate snapshot (from coach_rates at completion time)
  rate_type1_per_hour NUMERIC(10, 2),
  rate_type2_per_hour NUMERIC(10, 2),
  rate_type3_fixed NUMERIC(10, 2),
  rate_per_km NUMERIC(10, 2),
  
  -- Calculated amounts (set at completion)
  hours_worked NUMERIC(10, 2),
  activity_amount NUMERIC(10, 2),
  mileage_amount NUMERIC(10, 2),
  total_amount NUMERIC(10, 2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (activity_id, coach_id)
);

CREATE INDEX idx_activity_coaches_activity ON activity_coaches(activity_id);
CREATE INDEX idx_activity_coaches_coach ON activity_coaches(coach_id);
CREATE INDEX idx_activity_coaches_role ON activity_coaches(role);

-- Partial unique index: only one head coach per activity
CREATE UNIQUE INDEX idx_activity_one_head_coach 
  ON activity_coaches(activity_id) 
  WHERE role = 'head';

COMMENT ON TABLE activity_coaches IS 'Coaches assigned to activities with financial data';

-- ============================================================================
-- TABELA: attendance_records
-- Opis: Prisotnost igralcev
-- ============================================================================
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  status INT NOT NULL CHECK (status IN (0, 1, 2)),
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified_by UUID REFERENCES profiles(id),
  last_modified_at TIMESTAMPTZ,
  
  UNIQUE (activity_id, player_id)
);

CREATE INDEX idx_attendance_activity ON attendance_records(activity_id);
CREATE INDEX idx_attendance_player ON attendance_records(player_id);
CREATE INDEX idx_attendance_status ON attendance_records(status);

COMMENT ON TABLE attendance_records IS 'Player attendance: 0=Absent, 1=Present, 2=Notified absence';

-- ============================================================================
-- TABELA: form_types
-- Opis: Vrste obrazcev
-- ============================================================================
CREATE TABLE form_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_types_is_active ON form_types(is_active);

COMMENT ON TABLE form_types IS 'Types of forms required from players';

-- ============================================================================
-- TABELA: player_forms
-- Opis: Status obrazcev igralcev
-- ============================================================================
CREATE TABLE player_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  form_type_id UUID NOT NULL REFERENCES form_types(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'not_received' CHECK (status IN ('received', 'not_received')),
  received_date DATE,
  notes TEXT,
  recorded_by UUID REFERENCES profiles(id),
  recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (player_id, form_type_id)
);

CREATE INDEX idx_player_forms_player ON player_forms(player_id);
CREATE INDEX idx_player_forms_form_type ON player_forms(form_type_id);
CREATE INDEX idx_player_forms_status ON player_forms(status);

COMMENT ON TABLE player_forms IS 'Form statuses for each player';

-- ============================================================================
-- TABELA: coach_rates
-- Opis: Finančne postavke trenerjev
-- ============================================================================
CREATE TABLE coach_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  
  -- Head coach rates
  head_type1_per_hour NUMERIC(10, 2) CHECK (head_type1_per_hour >= 0),
  head_type2_per_hour NUMERIC(10, 2) CHECK (head_type2_per_hour >= 0),
  head_type3_fixed NUMERIC(10, 2) CHECK (head_type3_fixed >= 0),
  
  -- Assistant coach rates
  assistant_type1_per_hour NUMERIC(10, 2) CHECK (assistant_type1_per_hour >= 0),
  assistant_type2_per_hour NUMERIC(10, 2) CHECK (assistant_type2_per_hour >= 0),
  assistant_type3_fixed NUMERIC(10, 2) CHECK (assistant_type3_fixed >= 0),
  
  -- Mileage
  rate_per_km NUMERIC(10, 2) CHECK (rate_per_km >= 0),
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (coach_id, season_id)
);

CREATE INDEX idx_coach_rates_coach ON coach_rates(coach_id);
CREATE INDEX idx_coach_rates_season ON coach_rates(season_id);
CREATE INDEX idx_coach_rates_is_active ON coach_rates(is_active);

COMMENT ON TABLE coach_rates IS 'Coach payment rates per season';

-- ============================================================================
-- TABELA: correction_requests
-- Opis: Zahteve za popravek
-- ============================================================================
CREATE TABLE correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
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

COMMENT ON TABLE correction_requests IS 'Coach correction requests for locked months';

-- ============================================================================
-- TABELA: audit_log
-- Opis: Nespremenljiva revizijska sled
-- ============================================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  user_id UUID,
  user_name TEXT,
  correction_request_id UUID REFERENCES correction_requests(id),
  correction_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_operation ON audit_log(operation);

COMMENT ON TABLE audit_log IS 'Immutable audit trail - DO NOT modify or delete';

-- ============================================================================
-- TABELA: data_subject_requests
-- Opis: GDPR zahteve posameznikov
-- ============================================================================
CREATE TABLE data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN (
    'access', 'rectification', 'erasure', 'restriction', 'portability', 'objection'
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

CREATE INDEX idx_data_subject_requests_email ON data_subject_requests(subject_email);
CREATE INDEX idx_data_subject_requests_status ON data_subject_requests(status);

COMMENT ON TABLE data_subject_requests IS 'GDPR data subject requests';