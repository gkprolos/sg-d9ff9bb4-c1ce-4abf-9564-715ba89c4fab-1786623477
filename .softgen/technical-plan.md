# Tehnični Načrt – Športni Klub Aplikacija

> **Status:** OSNUTEK – Čaka na potrditev naročnika  
> **Datum:** 13. 08. 2026  
> **Verzija:** 1.0

---

## 1. Celotna Podatkovna Shema

### 1.1 Tabela: `profiles`
Razširitev Supabase Auth uporabnikov.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'coach', 'parent')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);
```

**Stolpci:**
- `id` – UUID, ujemanje z auth.users
- `email` – TEXT, e-pošta uporabnika
- `full_name` – TEXT, polno ime
- `role` – TEXT, vloga (admin/coach/parent)
- `is_active` – BOOLEAN, ali je račun aktiven
- `created_at` – TIMESTAMPTZ, ustvarjeno
- `updated_at` – TIMESTAMPTZ, posodobljeno

---

### 1.2 Tabela: `seasons`
Športne sezone.

```sql
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_season_dates CHECK (end_date > start_date),
  CONSTRAINT only_one_active_season EXCLUDE USING gist (
    is_active WITH =
  ) WHERE (is_active = true)
);

CREATE INDEX idx_seasons_active ON seasons(is_active) WHERE is_active = true;
CREATE INDEX idx_seasons_dates ON seasons(start_date, end_date);
```

**Stolpci:**
- `id` – UUID, primarni ključ
- `name` – TEXT UNIQUE, npr. "2026/2027"
- `start_date` – DATE, datum začetka
- `end_date` – DATE, datum konca
- `is_active` – BOOLEAN, trenutno aktivna sezona (samo ena)
- `is_closed` – BOOLEAN, ali je sezona zaključena
- `created_at` – TIMESTAMPTZ
- `updated_at` – TIMESTAMPTZ

**Omejitve:**
- Samo ena aktivna sezona naenkrat (EXCLUDE)
- Konec mora biti po začetku

---

### 1.3 Tabela: `venues`
Dvorane in lokacije.

```sql
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  room_label TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_venues_active ON venues(is_active);
```

**Stolpci:**
- `id` – UUID
- `name` – TEXT, ime dvorane
- `address` – TEXT, naslov
- `city` – TEXT, kraj
- `room_label` – TEXT, oznaka prostora/dela
- `is_active` – BOOLEAN
- `notes` – TEXT, opombe
- `created_at` – TIMESTAMPTZ
- `updated_at` – TIMESTAMPTZ

---

### 1.4 Tabela: `teams`
Selekcije.

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT,
  age_category TEXT,
  gender_category TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_team_per_season UNIQUE(season_id, name)
);

CREATE INDEX idx_teams_season ON teams(season_id);
CREATE INDEX idx_teams_active ON teams(is_active);
```

**Stolpci:**
- `id` – UUID
- `season_id` – UUID, referenca na seasons
- `name` – TEXT, polno ime selekcije
- `short_name` – TEXT, kratka oznaka
- `age_category` – TEXT, starostna kategorija
- `gender_category` – TEXT, spol/kategorija
- `is_active` – BOOLEAN
- `notes` – TEXT
- `created_at` – TIMESTAMPTZ
- `updated_at` – TIMESTAMPTZ

**Omejitve:**
- UNIQUE(season_id, name) – isto ime ne more biti dvakrat v isti sezoni

---

### 1.5 Tabela: `guardians`
Starši in skrbniki.

```sql
CREATE TABLE guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_guardians_email ON guardians(email);
```

**Stolpci:**
- `id` – UUID
- `first_name` – TEXT, ime
- `last_name` – TEXT, priimek
- `phone` – TEXT, telefon
- `email` – TEXT, e-pošta
- `created_at` – TIMESTAMPTZ
- `updated_at` – TIMESTAMPTZ

**Opomba:** Ločena tabela omogoča, da en starš nadzoruje več otrok in da se starši ne podvojijo.

---

### 1.6 Tabela: `players`
Igralci.

```sql
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  player_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  joined_date DATE,
  left_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_players_active ON players(is_active);
CREATE INDEX idx_players_name ON players(last_name, first_name);
```

**Stolpci:**
- `id` – UUID
- `first_name` – TEXT, ime
- `last_name` – TEXT, priimek
- `birth_date` – DATE, datum rojstva
- `address` – TEXT, naslov
- `postal_code` – TEXT, poštna številka
- `city` – TEXT, kraj
- `player_phone` – TEXT, telefon igralca
- `is_active` – BOOLEAN
- `joined_date` – DATE, datum vključitve
- `left_date` – DATE, datum izstopa
- `notes` – TEXT
- `created_at` – TIMESTAMPTZ
- `updated_at` – TIMESTAMPTZ

---

### 1.7 Tabela: `player_guardians`
Povezava igralec-starš (M:N).

```sql
CREATE TABLE player_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  guardian_order INTEGER NOT NULL CHECK (guardian_order IN (1, 2)),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_player_guardian_order UNIQUE(player_id, guardian_order)
);

CREATE INDEX idx_player_guardians_player ON player_guardians(player_id);
CREATE INDEX idx_player_guardians_guardian ON player_guardians(guardian_id);
```

**Stolpci:**
- `id` – UUID
- `player_id` – UUID, referenca na players
- `guardian_id` – UUID, referenca na guardians
- `guardian_order` – INTEGER (1 ali 2), prvi/drugi starš
- `created_at` – TIMESTAMPTZ

**Omejitve:**
- Vsak igralec ima največ 2 starša (order 1 in 2)
- UNIQUE(player_id, guardian_order)

---

### 1.8 Tabela: `team_players`
Povezava igralec-selekcija-sezona (M:N z zgodovino).

```sql
CREATE TABLE team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_player_team_season UNIQUE(player_id, team_id, season_id)
);

CREATE INDEX idx_team_players_team ON team_players(team_id);
CREATE INDEX idx_team_players_player ON team_players(player_id);
CREATE INDEX idx_team_players_season ON team_players(season_id);
```

**Stolpci:**
- `id` – UUID
- `team_id` – UUID, referenca na teams
- `player_id` – UUID, referenca na players
- `season_id` – UUID, referenca na seasons
- `created_at` – TIMESTAMPTZ

**Omejitve:**
- UNIQUE(player_id, team_id, season_id) – igralec lahko igra za isto selekcijo samo enkrat v sezoni
- Različne sezone = različni zapisi = popolna zgodovina

---

### 1.9 Tabela: `team_coaches`
Povezava trener-selekcija (M:N).

```sql
CREATE TABLE team_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_head_coach BOOLEAN DEFAULT false,
  can_be_assistant BOOLEAN DEFAULT true,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_coach_team_season UNIQUE(coach_id, team_id, season_id)
);

CREATE INDEX idx_team_coaches_team ON team_coaches(team_id);
CREATE INDEX idx_team_coaches_coach ON team_coaches(coach_id);
CREATE INDEX idx_team_coaches_season ON team_coaches(season_id);
```

**Stolpci:**
- `id` – UUID
- `team_id` – UUID, referenca na teams
- `coach_id` – UUID, referenca na profiles
- `is_head_coach` – BOOLEAN, ali lahko deluje kot glavni trener
- `can_be_assistant` – BOOLEAN, ali lahko deluje kot sotrener
- `season_id` – UUID, referenca na seasons
- `created_at` – TIMESTAMPTZ

**Omejitve:**
- UNIQUE(coach_id, team_id, season_id)
- Isti trener lahko v različnih sezonah ima različne vloge

---

### 1.10 Tabela: `schedule_templates`
Redni urniki.

```sql
CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  default_activity_type INTEGER NOT NULL CHECK (default_activity_type IN (1, 2, 3)),
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_schedule_times CHECK (end_time > start_time),
  CONSTRAINT valid_schedule_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX idx_schedule_templates_team ON schedule_templates(team_id);
CREATE INDEX idx_schedule_templates_season ON schedule_templates(season_id);
CREATE INDEX idx_schedule_templates_day ON schedule_templates(day_of_week);
```

**Stolpci:**
- `id` – UUID
- `season_id` – UUID, referenca na seasons
- `team_id` – UUID, referenca na teams
- `day_of_week` – INTEGER (1=ponedeljek, 7=nedelja)
- `start_time` – TIME, čas začetka
- `end_time` – TIME, čas konca
- `venue_id` – UUID, referenca na venues (NULL možen)
- `default_activity_type` – INTEGER (1/2/3)
- `valid_from` – DATE, veljavnost od
- `valid_to` – DATE, veljavnost do (NULL = brez omejitve)
- `is_active` – BOOLEAN
- `created_at` – TIMESTAMPTZ
- `updated_at` – TIMESTAMPTZ

**Omejitve:**
- end_time > start_time
- valid_to >= valid_from

---

### 1.11 Tabela: `activities`
Dejanske aktivnosti (treningi, tekme).

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  activity_type INTEGER NOT NULL CHECK (activity_type IN (1, 2, 3)),
  is_home_game BOOLEAN,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  custom_venue TEXT,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 60
  ) STORED,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_activity_per_team_date UNIQUE(season_id, team_id, activity_date),
  CONSTRAINT valid_activity_times CHECK (end_time > start_time),
  CONSTRAINT type_3_requires_home_flag CHECK (
    activity_type != 3 OR is_home_game IS NOT NULL
  )
);

CREATE INDEX idx_activities_team ON activities(team_id);
CREATE INDEX idx_activities_season ON activities(season_id);
CREATE INDEX idx_activities_date ON activities(activity_date);
CREATE INDEX idx_activities_status ON activities(status);
```

**Stolpci:**
- `id` – UUID
- `season_id` – UUID, referenca na seasons
- `team_id` – UUID, referenca na teams
- `activity_date` – DATE, datum aktivnosti
- `activity_type` – INTEGER (1/2/3)
- `is_home_game` – BOOLEAN (obvezno za tip 3)
- `venue_id` – UUID, referenca na venues
- `custom_venue` – TEXT, ročno vnesena lokacija
- `start_time` – TIME
- `end_time` – TIME
- `duration_minutes` – INTEGER GENERATED, samodejno izračunano
- `status` – TEXT (draft/completed)
- `notes` – TEXT
- `created_by` – UUID, referenca na profiles
- `created_at` – TIMESTAMPTZ
- `updated_by` – UUID, referenca na profiles
- `updated_at` – TIMESTAMPTZ

**KLJUČNA OMEJITEV:**
- **UNIQUE(season_id, team_id, activity_date)** – samo ena aktivnost na selekcijo in datum
- end_time > start_time
- Pri tipu 3 mora biti is_home_game nastavljen

---

### 1.12 Tabela: `activity_coaches`
Trenerji na aktivnosti (glavni in sotrenerji).

```sql
CREATE TABLE activity_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('head', 'assistant')),
  hours_worked NUMERIC(5,2),
  kilometers NUMERIC(8,2) DEFAULT 0 CHECK (kilometers >= 0),
  rate_type_1_per_hour NUMERIC(8,2),
  rate_type_2_per_hour NUMERIC(8,2),
  rate_type_3_fixed NUMERIC(8,2),
  rate_per_km NUMERIC(8,2),
  calculated_amount NUMERIC(10,2),
  km_entered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_coach_per_activity UNIQUE(activity_id, coach_id),
  CONSTRAINT only_one_head_coach EXCLUDE USING gist (
    activity_id WITH =,
    role WITH =
  ) WHERE (role = 'head')
);

CREATE INDEX idx_activity_coaches_activity ON activity_coaches(activity_id);
CREATE INDEX idx_activity_coaches_coach ON activity_coaches(coach_id);
CREATE INDEX idx_activity_coaches_role ON activity_coaches(role);
```

**Stolpci:**
- `id` – UUID
- `activity_id` – UUID, referenca na activities
- `coach_id` – UUID, referenca na profiles
- `role` – TEXT (head/assistant)
- `hours_worked` – NUMERIC(5,2), opravljene ure
- `kilometers` – NUMERIC(8,2), prevoženi km (>=0)
- `rate_type_1_per_hour` – NUMERIC(8,2), cena za tip 1 na uro (snapshot)
- `rate_type_2_per_hour` – NUMERIC(8,2), cena za tip 2 na uro (snapshot)
- `rate_type_3_fixed` – NUMERIC(8,2), fiksna cena za tip 3 (snapshot)
- `rate_per_km` – NUMERIC(8,2), cena na km (snapshot)
- `calculated_amount` – NUMERIC(10,2), izračunan znesek
- `km_entered_at` – TIMESTAMPTZ, kdaj so bili kilometri vneseni
- `created_at` – TIMESTAMPTZ
- `updated_at` – TIMESTAMPTZ

**KLJUČNE OMEJITVE:**
- **UNIQUE(activity_id, coach_id)** – trener lahko sodeluje samo enkrat na aktivnosti
- **EXCLUDE samo en head coach** – samo en glavni trener na aktivnost
- kilometers >= 0

**POMEMBNO:** Rate snapshot stolpci shranjujejo cene ob času aktivnosti. Poznejše spremembe cenika ne vplivajo na že zaključene obračune.

---

### 1.13 Tabela: `attendance_records`
Evidenca prisotnosti.

```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status INTEGER NOT NULL CHECK (status IN (0, 1, 2)),
  notes TEXT,
  entered_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entered_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_attendance_per_activity_player UNIQUE(activity_id, player_id)
);

CREATE INDEX idx_attendance_activity ON attendance_records(activity_id);
CREATE INDEX idx_attendance_player ON attendance_records(player_id);
CREATE INDEX idx_attendance_status ON attendance_records(status);
```

**Stolpci:**
- `id` – UUID
- `activity_id` – UUID, referenca na activities
- `player_id` – UUID, referenca na players
- `status` – INTEGER (0=odsoten, 1=prisoten, 2=javljena odsotnost)
- `notes` – TEXT, opombe
- `entered_by` – UUID, kdo je vnesel
- `entered_at` – TIMESTAMPTZ, prvotni čas vnosa (ne spreminja se)
- `updated_by` – UUID, kdo je nazadnje spremenil
- `updated_at` – TIMESTAMPTZ, čas zadnje spremembe

**KLJUČNA OMEJITEV:**
- **UNIQUE(activity_id, player_id)** – samo en zapis prisotnosti na igralca in aktivnost
- status mora biti 0, 1 ali 2

---

### 1.14 Tabela: `form_types`
Vrste obrazcev.

```sql
CREATE TABLE form_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_form_types_active ON form_types(is_active);
CREATE INDEX idx_form_types_order ON form_types(display_order);

-- Začetni obrazci
INSERT INTO form_types (name, description, is_required, display_order) VALUES
  ('Prijavni obrazec', 'Prijavni obrazec za sezono', true, 1),
  ('Obrazec 1B', 'Obrazec 1B', true, 2);
```

**Stolpci:**
- `id` – UUID
- `name` – TEXT UNIQUE, ime obrazca
- `description` – TEXT
- `is_required` – BOOLEAN, ali je obvezen
- `display_order` – INTEGER, vrstni red prikaza
- `is_active` – BOOLEAN
- `created_at` – TIMESTAMPTZ
- `updated_at` – TIMESTAMPTZ

---

### 1.15 Tabela: `player_forms`
Status obrazcev za igralce.

```sql
CREATE TABLE player_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  form_type_id UUID NOT NULL REFERENCES form_types(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('received', 'not_received')),
  received_date DATE,
  notes TEXT,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_player_form_season UNIQUE(player_id, form_type_id, season_id)
);

CREATE INDEX idx_player_forms_player ON player_forms(player_id);
CREATE INDEX idx_player_forms_form_type ON player_forms(form_type_id);
CREATE INDEX idx_player_forms_season ON player_forms(season_id);
CREATE INDEX idx_player_forms_status ON player_forms(status);
```

**Stolpci:**
- `id` – UUID
- `player_id` – UUID, referenca na players
- `form_type_id` – UUID, referenca na form_types
- `season_id` – UUID, referenca na seasons
- `status` – TEXT (received/not_received)
- `received_date` – DATE, datum prejema
- `notes` – TEXT
- `changed_by` – UUID, kdo je spremenil
- `changed_at` – TIMESTAMPTZ, čas spremembe
- `created_at` – TIMESTAMPTZ
- `updated_at` – TIMESTAMPTZ

**Omejitve:**
- UNIQUE(player_id, form_type_id, season_id)

---

### 1.16 Tabela: `coach_rates`
Finančne postavke trenerjev.

```sql
CREATE TABLE coach_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  -- Glavni trener
  head_type_1_per_hour NUMERIC(8,2) DEFAULT 0,
  head_type_2_per_hour NUMERIC(8,2) DEFAULT 0,
  head_type_3_fixed NUMERIC(8,2) DEFAULT 0,
  head_per_km NUMERIC(8,2) DEFAULT 0,
  -- Sotrener
  assistant_type_1_per_hour NUMERIC(8,2) DEFAULT 0,
  assistant_type_2_per_hour NUMERIC(8,2) DEFAULT 0,
  assistant_type_3_fixed NUMERIC(8,2) DEFAULT 0,
  assistant_per_km NUMERIC(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_coach_rates_season UNIQUE(coach_id, season_id)
);

CREATE INDEX idx_coach_rates_coach ON coach_rates(coach_id);
CREATE INDEX idx_coach_rates_season ON coach_rates(season_id);
```

**Stolpci:**
- `id` – UUID
- `coach_id` – UUID, referenca na profiles
- `season_id` – UUID, referenca na seasons
- **Glavni trener:**
  - `head_type_1_per_hour` – EUR/uro za tip 1
  - `head_type_2_per_hour` – EUR/uro za tip 2
  - `head_type_3_fixed` – EUR fiksno za tip 3
  - `head_per_km` – EUR/km
- **Sotrener:**
  - `assistant_type_1_per_hour` – EUR/uro za tip 1
  - `assistant_type_2_per_hour` – EUR/uro za tip 2
  - `assistant_type_3_fixed` – EUR fiksno za tip 3
  - `assistant_per_km` – EUR/km
- `created_at` – TIMESTAMPTZ
- `updated_at` – TIMESTAMPTZ

**Omejitve:**
- UNIQUE(coach_id, season_id) – vsak trener ima samo eno postavko na sezono

**POMEMBNO:** Različne postavke za glavnega trenerja in sotrenerja. Ob zaključku aktivnosti se postavljeni rates prenesejo v `activity_coaches` tabelo kot snapshot.

---

### 1.17 Tabela: `correction_requests`
Zahteve za popravek zaklenjenega meseca.

```sql
CREATE TABLE correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_correction_requests_coach ON correction_requests(requested_by);
CREATE INDEX idx_correction_requests_activity ON correction_requests(activity_id);
CREATE INDEX idx_correction_requests_status ON correction_requests(status);
```

**Stolpci:**
- `id` – UUID
- `requested_by` – UUID, trener ki zahteva popravek
- `activity_id` – UUID, referenca na activities
- `reason` – TEXT, razlog za popravek
- `requested_at` – TIMESTAMPTZ
- `status` – TEXT (pending/approved/rejected)
- `reviewed_by` – UUID, administrator
- `reviewed_at` – TIMESTAMPTZ
- `admin_notes` – TEXT
- `created_at` – TIMESTAMPTZ
- `updated_at` – TIMESTAMPTZ

---

### 1.18 Tabela: `audit_log`
Nespremenljiva revizijska sled.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_email TEXT,
  user_name TEXT,
  correction_reason TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);

-- RLS za audit_log: samo branje, nobene spremembe
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_audit_log" ON audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Nobene INSERT/UPDATE/DELETE policy za običajne uporabnike
-- Samo sprožilci lahko dodajajo v audit_log
```

**Stolpci:**
- `id` – UUID
- `table_name` – TEXT, ime spremenjene tabele
- `record_id` – UUID, ID spremenjenega zapisa
- `action` – TEXT (INSERT/UPDATE/DELETE)
- `old_values` – JSONB, stara vrednost
- `new_values` – JSONB, nova vrednost
- `user_id` – UUID, referenca na profiles
- `user_email` – TEXT, e-pošta ob času spremembe
- `user_name` – TEXT, ime ob času spremembe
- `correction_reason` – TEXT, razlog popravka
- `timestamp` – TIMESTAMPTZ, NE SPREMINJA SE

**KRITIČNO:** Običajni uporabniki ne morejo vpisovati/spreminjati/brisati iz audit_log. Samo administratorji lahko berejo. Vnosi se ustvarjajo samo preko sprožilcev.

---

## 2. Povezave Med Tabelami

```
profiles (users)
  ├── team_coaches (M:N) → teams
  ├── activity_coaches (M:N) → activities
  ├── coach_rates (1:N) → seasons
  └── correction_requests (1:N)

seasons
  ├── teams (1:N)
  ├── team_players (1:N)
  ├── team_coaches (1:N)
  ├── schedule_templates (1:N)
  ├── activities (1:N)
  ├── player_forms (1:N)
  └── coach_rates (1:N)

teams
  ├── team_players (M:N) → players
  ├── team_coaches (M:N) → profiles
  ├── schedule_templates (1:N)
  └── activities (1:N)

players
  ├── team_players (M:N) → teams
  ├── player_guardians (M:N) → guardians
  ├── attendance_records (M:N) → activities
  └── player_forms (1:N)

guardians
  └── player_guardians (M:N) → players

venues
  ├── schedule_templates (1:N)
  └── activities (1:N)

activities
  ├── activity_coaches (1:N) → profiles
  ├── attendance_records (M:N) → players
  └── correction_requests (1:N)

form_types
  └── player_forms (1:N)
```

---

## 3. Primarni in Tuji Ključi

Vse tabele uporabljajo **UUID primarni ključ** (`id`).

**Tuji ključi:**

| Tabela | Stolpec | Referenca | ON DELETE |
|--------|---------|-----------|-----------|
| profiles | id | auth.users(id) | CASCADE |
| teams | season_id | seasons(id) | CASCADE |
| team_players | team_id | teams(id) | CASCADE |
| team_players | player_id | players(id) | CASCADE |
| team_players | season_id | seasons(id) | CASCADE |
| team_coaches | team_id | teams(id) | CASCADE |
| team_coaches | coach_id | profiles(id) | CASCADE |
| team_coaches | season_id | seasons(id) | CASCADE |
| player_guardians | player_id | players(id) | CASCADE |
| player_guardians | guardian_id | guardians(id) | CASCADE |
| schedule_templates | season_id | seasons(id) | CASCADE |
| schedule_templates | team_id | teams(id) | CASCADE |
| schedule_templates | venue_id | venues(id) | SET NULL |
| activities | season_id | seasons(id) | CASCADE |
| activities | team_id | teams(id) | CASCADE |
| activities | venue_id | venues(id) | SET NULL |
| activities | created_by | profiles(id) | SET NULL |
| activities | updated_by | profiles(id) | SET NULL |
| activity_coaches | activity_id | activities(id) | CASCADE |
| activity_coaches | coach_id | profiles(id) | CASCADE |
| attendance_records | activity_id | activities(id) | CASCADE |
| attendance_records | player_id | players(id) | CASCADE |
| attendance_records | entered_by | profiles(id) | SET NULL |
| attendance_records | updated_by | profiles(id) | SET NULL |
| player_forms | player_id | players(id) | CASCADE |
| player_forms | form_type_id | form_types(id) | CASCADE |
| player_forms | season_id | seasons(id) | CASCADE |
| player_forms | changed_by | profiles(id) | SET NULL |
| coach_rates | coach_id | profiles(id) | CASCADE |
| coach_rates | season_id | seasons(id) | CASCADE |
| correction_requests | requested_by | profiles(id) | CASCADE |
| correction_requests | activity_id | activities(id) | CASCADE |
| correction_requests | reviewed_by | profiles(id) | SET NULL |
| audit_log | user_id | profiles(id) | SET NULL |

---

## 4. Enolične Omejitve in Preverjanja

### 4.1 UNIQUE Omejitve

```sql
-- Samo ena aktivna sezona
EXCLUDE USING gist (is_active WITH =) WHERE (is_active = true)

-- Sezonska imena
UNIQUE(seasons.name)

-- Selekcija ne more imeti istega imena v isti sezoni
UNIQUE(teams.season_id, teams.name)

-- Igralec v selekciji in sezoni samo enkrat
UNIQUE(team_players.player_id, team_players.team_id, team_players.season_id)

-- Trener v selekciji in sezoni samo enkrat
UNIQUE(team_coaches.coach_id, team_coaches.team_id, team_coaches.season_id)

-- KRITIČNO: Samo ena aktivnost na selekcijo in datum
UNIQUE(activities.season_id, activities.team_id, activities.activity_date)

-- Trener samo enkrat na aktivnosti
UNIQUE(activity_coaches.activity_id, activity_coaches.coach_id)

-- Samo en glavni trener na aktivnost
EXCLUDE USING gist (activity_id WITH =, role WITH =) WHERE (role = 'head')

-- Samo en zapis prisotnosti na igralca in aktivnost
UNIQUE(attendance_records.activity_id, attendance_records.player_id)

-- Igralec ima največ 2 starša
UNIQUE(player_guardians.player_id, player_guardians.guardian_order)

-- Obrazec status samo enkrat na igralca, tip in sezono
UNIQUE(player_forms.player_id, player_forms.form_type_id, player_forms.season_id)

-- Trener ima samo eno postavko na sezono
UNIQUE(coach_rates.coach_id, coach_rates.season_id)
```

### 4.2 CHECK Omejitve

```sql
-- Vloge
profiles.role IN ('admin', 'coach', 'parent')

-- Statusi
activities.status IN ('draft', 'completed')
correction_requests.status IN ('pending', 'approved', 'rejected')
player_forms.status IN ('received', 'not_received')
audit_log.action IN ('INSERT', 'UPDATE', 'DELETE')

-- Številčne vrednosti
attendance_records.status IN (0, 1, 2)
activities.activity_type IN (1, 2, 3)
schedule_templates.activity_type IN (1, 2, 3)
schedule_templates.day_of_week >= 1 AND <= 7
player_guardians.guardian_order IN (1, 2)

-- Datumi in časi
seasons.end_date > seasons.start_date
activities.end_time > activities.start_time
schedule_templates.end_time > schedule_templates.start_time
schedule_templates.valid_to >= schedule_templates.valid_from (če ni NULL)

-- Poslovne omejitve
activities: Pri tipu 3 mora biti is_home_game nastavljen
  CHECK (activity_type != 3 OR is_home_game IS NOT NULL)

activity_coaches.kilometers >= 0 (negativni km niso dovoljeni)
```

---

## 5. Row Level Security (RLS) Pravila

Vključimo RLS na **vsako tabelo** z natančnimi politikami za admin in coach.

### 5.1 Strategija RLS

**Administrator (role='admin'):**
- Polni dostop do vseh tabel (SELECT, INSERT, UPDATE, DELETE)

**Trener (role='coach'):**
- Vidi samo svoje selekcije (preko team_coaches)
- Ustvarja/ureja aktivnosti samo za svoje selekcije
- Vidi igralce samo svojih selekcij
- Vidi/ureja prisotnost samo svojih aktivnosti
- Vidi samo svoje finančne podatke
- NE vidi finančnih podatkov drugih trenerjev

**Starš (role='parent') – prihodnost:**
- Vidi samo svoje otroke
- Samo branje

### 5.2 RLS Politike – Profiles

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse
CREATE POLICY "admin_all_profiles" ON profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Trener vidi samo sebe
CREATE POLICY "coach_own_profile" ON profiles
  FOR SELECT
  USING (id = auth.uid());
```

### 5.3 RLS Politike – Seasons

```sql
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_seasons" ON seasons FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "coach_read_seasons" ON seasons FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach')
  );
```

### 5.4 RLS Politike – Teams

```sql
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_teams" ON teams FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trener vidi samo selekcije, ki so mu dodeljene
CREATE POLICY "coach_own_teams" ON teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_coaches tc
      WHERE tc.team_id = teams.id
      AND tc.coach_id = auth.uid()
    )
  );
```

### 5.5 RLS Politike – Venues

```sql
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_venues" ON venues FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "coach_read_venues" ON venues FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach')
  );
```

### 5.6 RLS Politike – Players

```sql
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_players" ON players FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trener vidi igralce samo svojih selekcij
CREATE POLICY "coach_own_team_players" ON players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_players tp
      JOIN team_coaches tc ON tc.team_id = tp.team_id
      WHERE tp.player_id = players.id
      AND tc.coach_id = auth.uid()
    )
  );

-- Trener lahko ureja igralce svojih selekcij (omejeno)
CREATE POLICY "coach_update_own_team_players" ON players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_players tp
      JOIN team_coaches tc ON tc.team_id = tp.team_id
      WHERE tp.player_id = players.id
      AND tc.coach_id = auth.uid()
    )
  );
```

### 5.7 RLS Politike – Guardians

```sql
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_guardians" ON guardians FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trener vidi starše igralcev svojih selekcij
CREATE POLICY "coach_own_team_guardians" ON guardians FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM player_guardians pg
      JOIN team_players tp ON tp.player_id = pg.player_id
      JOIN team_coaches tc ON tc.team_id = tp.team_id
      WHERE pg.guardian_id = guardians.id
      AND tc.coach_id = auth.uid()
    )
  );
```

### 5.8 RLS Politike – Player Guardians

```sql
ALTER TABLE player_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_player_guardians" ON player_guardians FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "coach_read_player_guardians" ON player_guardians FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_players tp
      JOIN team_coaches tc ON tc.team_id = tp.team_id
      WHERE tp.player_id = player_guardians.player_id
      AND tc.coach_id = auth.uid()
    )
  );
```

### 5.9 RLS Politike – Team Players

```sql
ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_team_players" ON team_players FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "coach_own_team_players_link" ON team_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_coaches tc
      WHERE tc.team_id = team_players.team_id
      AND tc.coach_id = auth.uid()
    )
  );
```

### 5.10 RLS Politike – Team Coaches

```sql
ALTER TABLE team_coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_team_coaches" ON team_coaches FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trener vidi samo svoje povezave
CREATE POLICY "coach_own_assignments" ON team_coaches FOR SELECT
  USING (coach_id = auth.uid());
```

### 5.11 RLS Politike – Schedule Templates

```sql
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_schedules" ON schedule_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "coach_read_own_schedules" ON schedule_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_coaches tc
      WHERE tc.team_id = schedule_templates.team_id
      AND tc.coach_id = auth.uid()
    )
  );
```

### 5.12 RLS Politike – Activities

```sql
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_activities" ON activities FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trener vidi aktivnosti svojih selekcij
CREATE POLICY "coach_own_team_activities" ON activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_coaches tc
      WHERE tc.team_id = activities.team_id
      AND tc.coach_id = auth.uid()
    )
  );

-- Trener lahko ustvari aktivnost za svoje selekcije
CREATE POLICY "coach_create_own_team_activities" ON activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_coaches tc
      WHERE tc.team_id = activities.team_id
      AND tc.coach_id = auth.uid()
    )
  );

-- Trener lahko ureja aktivnost svojih selekcij
-- OMEJITEV: samo do konca tekočega meseca (preverjeno v aplikaciji)
CREATE POLICY "coach_update_own_team_activities" ON activities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team_coaches tc
      WHERE tc.team_id = activities.team_id
      AND tc.coach_id = auth.uid()
    )
  );
```

### 5.13 RLS Politike – Activity Coaches

```sql
ALTER TABLE activity_coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_activity_coaches" ON activity_coaches FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trener vidi samo svoje zapise
CREATE POLICY "coach_own_activity_records" ON activity_coaches FOR SELECT
  USING (coach_id = auth.uid());

-- Trener lahko vnese/ureja svoje zapise
CREATE POLICY "coach_insert_own_activity_records" ON activity_coaches FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "coach_update_own_activity_records" ON activity_coaches FOR UPDATE
  USING (coach_id = auth.uid());
```

### 5.14 RLS Politike – Attendance Records

```sql
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_attendance" ON attendance_records FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trener vidi prisotnost aktivnosti svojih selekcij
CREATE POLICY "coach_own_team_attendance" ON attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN team_coaches tc ON tc.team_id = a.team_id
      WHERE a.id = attendance_records.activity_id
      AND tc.coach_id = auth.uid()
    )
  );

-- Trener vnese/ureja prisotnost za svoje aktivnosti
CREATE POLICY "coach_insert_own_team_attendance" ON attendance_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN team_coaches tc ON tc.team_id = a.team_id
      WHERE a.id = attendance_records.activity_id
      AND tc.coach_id = auth.uid()
    )
  );

CREATE POLICY "coach_update_own_team_attendance" ON attendance_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN team_coaches tc ON tc.team_id = a.team_id
      WHERE a.id = attendance_records.activity_id
      AND tc.coach_id = auth.uid()
    )
  );
```

### 5.15 RLS Politike – Form Types

```sql
ALTER TABLE form_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_form_types" ON form_types FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "coach_read_form_types" ON form_types FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach')
  );
```

### 5.16 RLS Politike – Player Forms

```sql
ALTER TABLE player_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_player_forms" ON player_forms FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trener vidi obrazce igralcev svojih selekcij
CREATE POLICY "coach_read_own_team_forms" ON player_forms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_players tp
      JOIN team_coaches tc ON tc.team_id = tp.team_id
      WHERE tp.player_id = player_forms.player_id
      AND tc.coach_id = auth.uid()
    )
  );
```

### 5.17 RLS Politike – Coach Rates

```sql
ALTER TABLE coach_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_coach_rates" ON coach_rates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- KRITIČNO: Trener vidi SAMO svoje postavke
CREATE POLICY "coach_own_rates" ON coach_rates FOR SELECT
  USING (coach_id = auth.uid());

-- Trener NE more videti postavk drugih trenerjev
```

### 5.18 RLS Politike – Correction Requests

```sql
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_corrections" ON correction_requests FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trener vidi samo svoje zahteve
CREATE POLICY "coach_own_corrections" ON correction_requests FOR SELECT
  USING (requested_by = auth.uid());

-- Trener lahko ustvari zahtevo
CREATE POLICY "coach_create_corrections" ON correction_requests FOR INSERT
  WITH CHECK (requested_by = auth.uid());
```

### 5.19 RLS Politike – Audit Log

```sql
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Samo admin lahko bere audit log
CREATE POLICY "admin_read_audit_log" ON audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Nobenih INSERT/UPDATE/DELETE politik za običajne uporabnike
-- Samo database triggers lahko dodajajo zapise
```

---

## 6. Nespremenljiva Revizijska Sled

### 6.1 Strategija

Uporabljamo **database triggers** (sprožilce) za samodejno beleženje sprememb v `audit_log` tabelo.

**Kaj beležimo:**
- activities (vse operacije)
- activity_coaches (vse operacije)
- attendance_records (vse operacije)
- players (UPDATE, DELETE)
- guardians (UPDATE, DELETE)
- player_forms (UPDATE)
- coach_rates (UPDATE)
- team_coaches (INSERT, DELETE)
- profiles.role spremembe

### 6.2 Generic Audit Trigger Function

```sql
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Pridobi podatke trenutnega uporabnika
  SELECT id, email, full_name INTO user_profile
  FROM profiles
  WHERE id = auth.uid();

  -- INSERT
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_log (
      table_name,
      record_id,
      action,
      old_values,
      new_values,
      user_id,
      user_email,
      user_name
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      'INSERT',
      NULL,
      to_jsonb(NEW),
      user_profile.id,
      user_profile.email,
      user_profile.full_name
    );
    RETURN NEW;
  
  -- UPDATE
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_log (
      table_name,
      record_id,
      action,
      old_values,
      new_values,
      user_id,
      user_email,
      user_name
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      user_profile.id,
      user_profile.email,
      user_profile.full_name
    );
    RETURN NEW;
  
  -- DELETE
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_log (
      table_name,
      record_id,
      action,
      old_values,
      new_values,
      user_id,
      user_email,
      user_name
    ) VALUES (
      TG_TABLE_NAME,
      OLD.id,
      'DELETE',
      to_jsonb(OLD),
      NULL,
      user_profile.id,
      user_profile.email,
      user_profile.full_name
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 6.3 Trigger Ustvarjanje

```sql
-- Activities
CREATE TRIGGER audit_activities
  AFTER INSERT OR UPDATE OR DELETE ON activities
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Activity Coaches
CREATE TRIGGER audit_activity_coaches
  AFTER INSERT OR UPDATE OR DELETE ON activity_coaches
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Attendance Records
CREATE TRIGGER audit_attendance_records
  AFTER INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Players (UPDATE in DELETE)
CREATE TRIGGER audit_players
  AFTER UPDATE OR DELETE ON players
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Guardians (UPDATE in DELETE)
CREATE TRIGGER audit_guardians
  AFTER UPDATE OR DELETE ON guardians
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Player Forms (UPDATE)
CREATE TRIGGER audit_player_forms
  AFTER UPDATE ON player_forms
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Coach Rates (UPDATE)
CREATE TRIGGER audit_coach_rates
  AFTER UPDATE ON coach_rates
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Team Coaches (INSERT in DELETE)
CREATE TRIGGER audit_team_coaches
  AFTER INSERT OR DELETE ON team_coaches
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

### 6.4 Dodatna Trigger za Popravke z Razlogom

Ko administrator popravlja zaklenjen mesec, aplikacija pokliče stored function z razlogom:

```sql
CREATE OR REPLACE FUNCTION update_with_reason(
  p_table_name TEXT,
  p_record_id UUID,
  p_new_values JSONB,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Samo admin lahko kliče
  SELECT id, email, full_name INTO user_profile
  FROM profiles
  WHERE id = auth.uid() AND role = 'admin';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Specifične UPDATE izjave za vsako tabelo
  -- Primer: activities
  IF p_table_name = 'activities' THEN
    -- Dodaj popravek v audit log z razlogom
    INSERT INTO audit_log (
      table_name, record_id, action, correction_reason,
      user_id, user_email, user_name
    ) VALUES (
      p_table_name, p_record_id, 'UPDATE',
      p_reason, user_profile.id, user_profile.email, user_profile.full_name
    );
    -- Izvedi dejanski UPDATE (poenostavljen primer)
    -- V produkciji bi moral biti dinamičen UPDATE
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**OPOMBA:** Za produkcijo bomo uporabili kombinacijo:
- Sprožilci za normalne operacije
- RPC funkcije za administratorske popravke z razlogom

---

## 7. Preprečevanje Podvojenih Aktivnosti

### 7.1 Database Omejitev

```sql
CONSTRAINT unique_activity_per_team_date UNIQUE(season_id, team_id, activity_date)
```

Ta omejitev **zagotavlja**, da v podatkovni zbirki ne more obstajati dveh aktivnosti za isto selekcijo, sezono in datum.

### 7.2 Aplikacijski Potek

```typescript
// Pseudo-code
async function createOrOpenActivity(teamId: string, activityDate: string) {
  // 1. Preveri, ali aktivnost že obstaja
  const existing = await supabase
    .from('activities')
    .select('*, activity_coaches(coach_id, role)')
    .eq('team_id', teamId)
    .eq('activity_date', activityDate)
    .maybeSingle();

  if (existing) {
    // Aktivnost že obstaja
    // Preveri, ali je trenutni trener že dodan
    const currentCoach = getCurrentUser();
    const isAlreadyCoach = existing.activity_coaches.some(
      ac => ac.coach_id === currentCoach.id
    );

    if (!isAlreadyCoach) {
      // Dodaj kot sotrener (če je dovoljen)
      const isAllowedAssistant = await checkIfAllowedAssistant(
        currentCoach.id,
        teamId
      );
      
      if (isAllowedAssistant) {
        await addCoachToActivity(existing.id, currentCoach.id, 'assistant');
        showMessage('Dodani ste bili kot sotrener');
      } else {
        showError('Niste dovoljeni sotrener za to selekcijo');
        return;
      }
    }

    // Odpri obstoječo aktivnost
    return redirectToActivity(existing.id);
  }

  // 2. Če ne obstaja, ustvari novo
  const scheduleTemplate = await getScheduleTemplate(teamId, activityDate);
  
  const newActivity = await supabase
    .from('activities')
    .insert({
      season_id: getCurrentSeason(),
      team_id: teamId,
      activity_date: activityDate,
      start_time: scheduleTemplate?.start_time || '17:00',
      end_time: scheduleTemplate?.end_time || '18:30',
      activity_type: scheduleTemplate?.default_activity_type || 1,
      venue_id: scheduleTemplate?.venue_id || null,
      status: 'draft'
    })
    .select()
    .single();

  // Dodaj glavnega trenerja
  await supabase
    .from('activity_coaches')
    .insert({
      activity_id: newActivity.id,
      coach_id: getCurrentUser().id,
      role: 'head'
    });

  return redirectToActivity(newActivity.id);
}
```

### 7.3 Varnostni Mehanizmi

1. **Database UNIQUE constraint** – primarni varnostni mehanizem
2. **RLS politike** – trener lahko ustvari aktivnost samo za svoje selekcije
3. **Aplikacijska logika** – preverjanje pred vstavljanjem
4. **EXCLUDE constraint** na activity_coaches – samo en head coach

---

## 8. Obračun Glavnega in Sotrenerja

### 8.1 Shranjevanje Postavk

**coach_rates tabela** vsebuje **ločene postavke** za glavnega in sotrenerja:

```
head_type_1_per_hour    | Glavni: EUR/uro za tip 1
head_type_2_per_hour    | Glavni: EUR/uro za tip 2
head_type_3_fixed       | Glavni: EUR fiksno za tip 3
head_per_km             | Glavni: EUR/km

assistant_type_1_per_hour | Sotrener: EUR/uro za tip 1
assistant_type_2_per_hour | Sotrener: EUR/uro za tip 2
assistant_type_3_fixed    | Sotrener: EUR fiksno za tip 3
assistant_per_km          | Sotrener: EUR/km
```

### 8.2 Rate Snapshot Pristop

Ko se aktivnost zaključi (status → 'completed'), sistem:

1. Pridobi trenutne postavke iz `coach_rates` za vsakega trenerja
2. **Skopiraj ustrezne postavke** v `activity_coaches` tabelo glede na vlogo

```sql
-- Primer za glavnega trenerja
UPDATE activity_coaches
SET
  rate_type_1_per_hour = (
    SELECT head_type_1_per_hour FROM coach_rates
    WHERE coach_id = activity_coaches.coach_id
    AND season_id = (SELECT season_id FROM activities WHERE id = activity_coaches.activity_id)
  ),
  rate_type_2_per_hour = (
    SELECT head_type_2_per_hour FROM coach_rates ...
  ),
  -- itd.
WHERE activity_id = ? AND role = 'head';

-- Primer za sotrenerja
UPDATE activity_coaches
SET
  rate_type_1_per_hour = (
    SELECT assistant_type_1_per_hour FROM coach_rates ...
  ),
  -- itd.
WHERE activity_id = ? AND role = 'assistant';
```

### 8.3 Obračun Formula

```typescript
function calculateCoachAmount(activityCoach: ActivityCoach, activity: Activity): number {
  let amount = 0;

  // Obračun aktivnosti
  if (activity.activity_type === 1) {
    amount += activityCoach.hours_worked * activityCoach.rate_type_1_per_hour;
  } else if (activity.activity_type === 2) {
    amount += activityCoach.hours_worked * activityCoach.rate_type_2_per_hour;
  } else if (activity.activity_type === 3) {
    amount += activityCoach.rate_type_3_fixed;
  }

  // Kilometrina
  amount += activityCoach.kilometers * activityCoach.rate_per_km;

  return amount;
}
```

### 8.4 Stored Function za Zaključek Aktivnosti

```sql
CREATE OR REPLACE FUNCTION complete_activity_with_rates(p_activity_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_activity RECORD;
  v_coach RECORD;
  v_rates RECORD;
BEGIN
  -- Pridobi aktivnost
  SELECT * INTO v_activity FROM activities WHERE id = p_activity_id;
  
  -- Za vsakega trenerja na aktivnosti
  FOR v_coach IN
    SELECT * FROM activity_coaches WHERE activity_id = p_activity_id
  LOOP
    -- Pridobi njegove postavke za to sezono
    SELECT * INTO v_rates FROM coach_rates
    WHERE coach_id = v_coach.coach_id
    AND season_id = v_activity.season_id;

    -- Skopiraj ustrezne postavke glede na vlogo
    IF v_coach.role = 'head' THEN
      UPDATE activity_coaches
      SET
        rate_type_1_per_hour = v_rates.head_type_1_per_hour,
        rate_type_2_per_hour = v_rates.head_type_2_per_hour,
        rate_type_3_fixed = v_rates.head_type_3_fixed,
        rate_per_km = v_rates.head_per_km,
        hours_worked = EXTRACT(EPOCH FROM (v_activity.end_time - v_activity.start_time)) / 3600
      WHERE id = v_coach.id;
    ELSE
      UPDATE activity_coaches
      SET
        rate_type_1_per_hour = v_rates.assistant_type_1_per_hour,
        rate_type_2_per_hour = v_rates.assistant_type_2_per_hour,
        rate_type_3_fixed = v_rates.assistant_type_3_fixed,
        rate_per_km = v_rates.assistant_per_km,
        hours_worked = EXTRACT(EPOCH FROM (v_activity.end_time - v_activity.start_time)) / 3600
      WHERE id = v_coach.id;
    END IF;

    -- Izračunaj znesek
    UPDATE activity_coaches
    SET calculated_amount = (
      CASE v_activity.activity_type
        WHEN 1 THEN hours_worked * rate_type_1_per_hour
        WHEN 2 THEN hours_worked * rate_type_2_per_hour
        WHEN 3 THEN rate_type_3_fixed
      END + kilometers * rate_per_km
    )
    WHERE id = v_coach.id;
  END LOOP;

  -- Označi aktivnost kot zaključeno
  UPDATE activities SET status = 'completed' WHERE id = p_activity_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 8.5 Zaščita Zaključenih Obračunov

Ko administrator **spremeni cenorazred** v `coach_rates`:
- **NE** posodobi `activity_coaches` zapisov z status='completed'
- **NI** vzvratnega vpliva
- Revizijska sled beleži spremembo coach_rates

Če administrator izrecno izvede **ponovni obračun** (npr. za popravek napake):
- Pokliče RPC funkcijo `recalculate_activity(activity_id, reason)`
- Funkcija ponovno pridobi trenutne postavke
- Posodobi activity_coaches
- Zabeleži v audit_log z razlogom

---

## 9. Načrt Zaslonov

### 9.1 Administrator Navigacija

```
┌─────────────────────────────────────────┐
│ [Logo] Športni Klub App     [User] ▼    │
├─────────────────────────────────────────┤
│ Sidebar:                                │
│  • Nadzorna plošča                      │
│  • Aktivnosti                           │
│  • Prisotnost                           │
│  • Selekcije                            │
│  • Igralci                              │
│  • Trenerji                             │
│  • Urnik                                │
│  • Dvorane                              │
│  • Obrazci                              │
│  • Sezone                               │
│  • Poročila                             │
│  • Revizijska sled                      │
│  • Nastavitve                           │
└─────────────────────────────────────────┘
```

### 9.2 Trener Navigacija

```
┌─────────────────────────────────────────┐
│ [Logo] Športni Klub App     [Trener] ▼  │
├─────────────────────────────────────────┤
│ Sidebar:                                │
│  • Moj pregled                          │
│  • [+] Dodaj prisotnost (CTA)           │
│  • Aktivnosti                           │
│  • Moje selekcije                       │
│  • Igralci                              │
│  • Moj obračun                          │
└─────────────────────────────────────────┘
```

### 9.3 Ključni Zasloni

**A. Dodaj Prisotnost (Trener)**
```
┌─────────────────────────────────────────┐
│ DODAJ PRISOTNOST                        │
├─────────────────────────────────────────┤
│ Datum: [_____________] [Danes] [Jutri]  │
│ Selekcija: [Izberi selekcijo ▼]        │
│                                         │
│ [Nadaljuj] ──────────────────────────►  │
└─────────────────────────────────────────┘

↓ Po izbiri ↓

┌─────────────────────────────────────────┐
│ PRISOTNOST – Kadetinje 1                │
│ 15. 08. 2026 | 17:30-19:00 | OŠ A      │
├─────────────────────────────────────────┤
│ Igralka               | Status | Opomba│
│───────────────────────┼────────┼───────│
│ ►  Ana Novak          │ [1]    │       │ ◄ aktivna vrstica
│    Maja Kovač         │ [1]    │       │
│    Eva Horvat         │ [0]    │ bolna │
│    Sara Zupan         │ [2]    │       │
│    ...                │        │       │
├─────────────────────────────────────────┤
│ Prisotni: 15 | Odsotni: 2 | Javljeni: 1│
│ [Vse prisotne] [Počisti]                │
│ [Shrani] ────────────────────────────►  │
└─────────────────────────────────────────┘

Fokus na prvo vnosno polje. 
Enter = shrani & premakni na naslednjega.
Tab/Shift+Tab navigacija.
Barve: 1=zelena, 0=rdeča, 2=oranžna, prazno=siva
```

**B. Dashboard Trenerja**
```
┌─────────────────────────────────────────┐
│ MOJ PREGLED                             │
├─────────────────────────────────────────┤
│ DANES: 15. 08. 2026                     │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 17:30 Kadetinje 1 – OŠ A (dvorana B)│ │
│ │ [Dodaj prisotnost] ─────────────────►│ │
│ └─────────────────────────────────────┘ │
│                                         │
│ JUTRI: 16. 08. 2026                     │
│ ┌─────────────────────────────────────┐ │
│ │ 18:00 Mini košarka – Dvorana C      │ │
│ └─────────────────────────────────────┘ │
│                                         │
├─────────────────────────────────────────┤
│ AVGUST 2026 – MOJ OBRAČUN               │
│                                         │
│ Treningi (tip 1):        12             │
│ Pripravljalni (tip 2):    3             │
│ Tekme (tip 3):            2 (1D + 1G)   │
│ Opravljene ure:         28,5 h          │
│ Kilometri:             240 km           │
│                                         │
│ Obračun aktivnosti:    350,00 EUR       │
│ Kilometrina:            84,00 EUR       │
│ ────────────────────────────────────────│
│ SKUPAJ:                434,00 EUR       │
│                                         │
│ [Podrobnosti] ──────────────────────────│
└─────────────────────────────────────────┘

OPOZORILA:
⚠ Manjkajoča prisotnost: 13.08. Kadetinje 1
⚠ Konec meseca čez 3 dni
```

**C. Dashboard Administratorja**
```
┌─────────────────────────────────────────┐
│ NADZORNA PLOŠČA                         │
├─────────────────────────────────────────┤
│ Filtri:                                 │
│ Sezona: [2026/2027 ▼]  Mesec: [Avg ▼]  │
│                                         │
│ ┌───────────┬───────────┬───────────┐   │
│ │ Selekcije │  Igralci  │  Trenerji │   │
│ │    17     │    306    │     9     │   │
│ └───────────┴───────────┴───────────┘   │
│                                         │
│ AKTIVNOSTI V AVGUSTU 2026               │
│ Skupaj aktivnosti: 124                  │
│ Treningi (tip 1): 98                    │
│ Pripravljalni (tip 2): 18               │
│ Tekme (tip 3): 8 (5D + 3G)              │
│                                         │
│ ⚠ Manjkajoči vnosi prisotnosti: 6      │
│                                         │
│ TRENERJI – AVGUST 2026                  │
│ ┌─────────────────────────────────────┐ │
│ │ Trener      │ Ure │ Km  │ Obračun  │ │
│ ├─────────────┼─────┼─────┼──────────┤ │
│ │ Marko Novak │ 32  │ 280 │ 512 EUR  │ │
│ │ Ana Kovač   │ 28  │ 240 │ 434 EUR  │ │
│ │ ...         │     │     │          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Podrobna poročila] ────────────────────│
└─────────────────────────────────────────┘
```

**D. Igralci (Admin + Import)**
```
┌─────────────────────────────────────────┐
│ IGRALCI                                 │
├─────────────────────────────────────────┤
│ [Iskanje...] [Dodaj igralca] [Uvoz] ▼  │
│                                         │
│ Selekcija: [Vse ▼]  Status: [Aktivni ▼]│
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Ime in priimek  │ Rojstvo  │ Selekcija│ │
│ ├─────────────────┼──────────┼──────────┤ │
│ │ Ana Novak       │ 12.03.10 │ Kadet. 1 │ │
│ │ Maja Kovač      │ 05.07.09 │ Kadet. 1 │ │
│ │ ...             │          │          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [← Nazaj] [1] [2] [3] ... [15] [Naprej→]│
└─────────────────────────────────────────┘

Klik na [Uvoz] ▼:
┌─────────────────────────────────────────┐
│ UVOZ IGRALCEV IZ EXCEL                  │
├─────────────────────────────────────────┤
│ 1. Naloži datoteko:                     │
│    [Izberi XLSX/CSV] [Prenesi predlogo] │
│                                         │
│ 2. Poveži stolpce (predogled prvih 5):  │
│    Excel Stolpec    → Polje aplikacije  │
│    ──────────────────────────────────── │
│    [A - Ime]        → [Ime ▼]           │
│    [B - Priimek]    → [Priimek ▼]       │
│    [C - Datum roj.] → [Rojstvo ▼]       │
│    ...                                  │
│                                         │
│ 3. Preverjanje:                         │
│    ✓ Obvezna polja OK                   │
│    ⚠ 2 možna podvojena igralca          │
│    ✗ 1 neveljaven datum rojstva         │
│                                         │
│ [Uvozi] [Prekliči]                      │
└─────────────────────────────────────────┘
```

**E. Revizijska sled**
```
┌─────────────────────────────────────────┐
│ REVIZIJSKA SLED                         │
├─────────────────────────────────────────┤
│ Filtri:                                 │
│ Tabela: [Vse ▼] Uporabnik: [Vsi ▼]     │
│ Datum: [Od ___] [Do ___] [Iskanje...]   │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │Čas │Uporabnik│Dejanje│Tabela│Razlog│ │
│ ├────┼─────────┼───────┼──────┼──────┤ │
│ │15:32│Admin   │UPDATE │activ.│Poprav│ │
│ │    │         │       │      │časa  │ │
│ │    │ [Poglej podrobnosti] ──────────│ │
│ ├────┼─────────┼───────┼──────┼──────┤ │
│ │15:28│Marko N.│UPDATE │attend│      │ │
│ │    │ [Poglej podrobnosti] ──────────│ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Izvozi CSV] ────────────────────────── │
└─────────────────────────────────────────┘

Klik na [Poglej podrobnosti]:
┌─────────────────────────────────────────┐
│ REVIZIJSKI ZAPIS #abc123                │
├─────────────────────────────────────────┤
│ Tabela: activities                      │
│ Zapis ID: xyz789                        │
│ Dejanje: UPDATE                         │
│ Uporabnik: Administrator (admin@...)    │
│ Čas: 15. 08. 2026 15:32:18              │
│ Razlog: Popravek časa na zahtevo trenerja│
│                                         │
│ STARA VREDNOST:                         │
│ {                                       │
│   "start_time": "17:30:00",             │
│   "end_time": "19:00:00"                │
│ }                                       │
│                                         │
│ NOVA VREDNOST:                          │
│ {                                       │
│   "start_time": "18:00:00",             │
│   "end_time": "19:30:00"                │
│ }                                       │
│                                         │
│ [Zapri]                                 │
└─────────────────────────────────────────┘
```

---

## 10. Izvedbeni Načrt po Fazah

### FAZA A: Podatkovna osnova (3-5 iteracij)

**Cilj:** Vzpostavitev Supabase podatkovne baze, avtentikacije, vlog in RLS.

**Naloge:**
1. Supabase projekt setup (Frankfurt regija)
2. Ustvarjanje vseh tabel (profiles → audit_log)
3. Primarni/tuji ključi, indeksi, omejitve
4. RLS politike za admin in coach
5. Audit log triggers
6. Auth setup (email/password)
7. Začetni podatki (form_types, aktivna sezona)

**Testi:**
- Admin vidi vse podatke
- Trener vidi samo svoje selekcije
- Trener NE vidi postavk drugih trenerjev
- UNIQUE omejitve delujejo (podvojena aktivnost)
- Audit log se avtomatsko polni

---

### FAZA B: Administracija (5-8 iteracij)

**Cilj:** Administratorji lahko upravljajo sezone, selekcije, igralce, trenerje, urnik, dvorane.

**Naloge:**
1. Admin layout + navigacija
2. Sezone: CRUD, kopiranje sezone
3. Selekcije: CRUD
4. Igralci: CRUD + obrazci
5. Excel uvoz igralcev (naloži, poveži, preveri, uvozi)
6. Trenerji: CRUD + povezava s selekcijami
7. Dvorane: CRUD
8. Redni urniki: CRUD
9. Finančne postavke trenerjev (coach_rates)

**Testi:**
- Administrator lahko ustvari novo sezono
- Kopiranje sezone prenese samo izbrane entitete
- Excel uvoz zazna podvojene igralce
- Trener lahko deluje kot glavni/sotrener na različnih selekcijah
- Glavni in sotrener imata ločene postavke

---

### FAZA C: Dnevno delo trenerja (6-10 iteracij)

**Cilj:** Trenerji lahko dodajajo aktivnosti, vnašajo prisotnost, kilometre.

**Naloge:**
1. Trener layout + navigacija
2. Dashboard trenerja (današnji termini, mesečni pregled)
3. Dodaj prisotnost workflow:
   - Izbira datuma/selekcije
   - Preverjanje podvojene aktivnosti
   - Samodejno izpolnjevanje iz urnika
   - Ustvarjanje nove/odpiranje obstoječe
4. Hiter vnos prisotnosti (Excel-stil, 0/1/2, Enter, Tab)
5. Ure/kilometri vnos
6. Zaklepanje meseca (tekoči mesec editable, prejšnji locked)
7. Zahteva za popravek (correction_requests)
8. Rate snapshot ob zaključku aktivnosti

**Testi:**
- Dva trenerja ne moreta ustvariti dveh aktivnosti
- Drugi trener se pridruži kot sotrener
- Vnos 18 igralcev v <1 min z tipkovnico
- Glavni in sotrener imata različne obračune
- Sprememba cenika ne vpliva na zaključene aktivnosti
- Trener po 1. septembru ne more urejati avgustovskih zapisov

---

### FAZA D: Finance in analitika (4-6 iteracij)

**Cilj:** Obračuni, dashboardi, poročila, izvozi.

**Naloge:**
1. Dashboard administratorja (filtri, statistika, opozorila)
2. Trenerjev mesečni obračun (razčlenjen po vlogah)
3. Analitika po igralcu (prisotnost %)
4. Analitika po selekciji
5. Poročila: Excel/CSV izvoz (igralci, prisotnost, obračuni, kilometrina)
6. Revizijska sled prikaz (filtri, podrobnosti)

**Testi:**
- Dashboard prikazuje točne številke
- Obračun trenerja ločuje glavne/sotrenerske ure
- Odstotek prisotnosti igralca pravilen
- Excel izvoz vsebuje filtrirane podatke
- Revizijska sled vsebuje old/new values

---

### FAZA E: Testiranje in Priprava Produkcije (2-3 iteracije)

**Cilj:** Preverjanje sprejemnih testov, responsivnost, varnost, produkcija.

**Naloge:**
1. Preverjanje vseh 24 sprejemnih testov (iz specifikacije)
2. Mobile responsive testing (telefon, tablica)
3. Preverjanje RLS (trener ne sme videti tujih podatkov)
4. Performance (indeksi, query optimization)
5. Error handling (jasna slovenska sporočila)
6. Backup strategija (Supabase Point-in-Time Recovery)
7. Dokumentacija za administratorja

**Testi:**
- Vseh 24 testov iz specifikacije
- Aplikacija deluje na iPhone, Android, tablici, računalniku
- Vnos prisotnosti hiter in brez napak
- RLS popolnoma zaščiten

---

## 11. Tehnologija Stack

**Frontend:**
- Next.js 15.5 (Page Router)
- React 19.2
- TypeScript
- Tailwind CSS 3.4
- shadcn/ui komponente

**Backend:**
- Supabase PostgreSQL (Frankfurt)
- Supabase Auth
- Supabase RLS
- Database triggers

**Styling:**
- Atletski-profesionalen dizajn
- Navy modra osnova: `--primary: 210 100% 27%` (deep navy)
- Oranžna akcent: `--accent: 27 96% 61%` (energetic orange)
- Bela/svetla nevtralna: `--background: 0 0% 100%`
- `--foreground: 210 24% 16%` (dark slate)
- Heading font: IBM Plex Sans Condensed (600, 700)
- Body font: IBM Plex Sans (400, 600)
- Tabular font: IBM Plex Mono (400, 600)
- Barve statusov: zelena (1), rdeča (0), oranžna (2), siva (brez vnosa)

**Deployment:**
- Vercel (Next.js)
- Supabase (backend)
- GitHub (naročnik)

---

## 12. Prednostne Naloge Razvoja

**P0 (Kritično – brez tega aplikacija ni funkcjonalna):**
- Supabase setup + Auth
- Tabele activities, activity_coaches, attendance_records
- UNIQUE(season, team, date) omejitev
- RLS politike za admin/coach
- Dodaj prisotnost workflow
- Hiter vnos prisotnosti (Enter navigacija)
- Rate snapshot

**P1 (Zelo pomembno):**
- Excel uvoz igralcev
- Redni urniki + samodejno izpolnjevanje
- Zaklepanje meseca
- Obračuni (glavni vs sotrener)
- Dashboard trenerja
- Audit log triggers

**P2 (Pomembno):**
- Dashboard administratorja
- Poročila (Excel/CSV izvoz)
- Revizijska sled prikaz
- Kopiranje sezone
- Correction requests

**P3 (Nice to have):**
- Obrazci tracking
- Napredni filtri
- Grafi

---

## 13. Varnost in GDPR

**Varnostne ukrepe:**
- RLS na vsaki tabeli
- Samo auth.uid() dostop
- Trener NE vidi postavk drugih
- Admin-only audit_log branje
- Servisni ključ NIKOLI v brskalniku
- HTTPS obvezno (Vercel default)
- MFA priporočena za admin

**GDPR:**
- Evropska regija (Frankfurt)
- Minimalni podatki
- Izvoz osebnih podatkov (Excel)
- Izbris starih sezon (admin)
- Dostop samo pooblaščeni
- Revizijska sled sprememb

---

## 14. Končno Stanje

Po izvedbi vseh faz bo aplikacija omogočala:

✅ **Administratorjem:**
- Celovito upravljanje kluba (sezone, selekcije, igralci, trenerji, urnik, dvorane)
- Excel uvoz igralcev
- Finančne postavke trenerjev (glavna/sotrener ločeno)
- Nadzorna plošča s statistiko
- Poročila in izvozi
- Revizijska sled vseh sprememb
- Popravki zaklenjenega meseca

✅ **Trenerjem:**
- Dodajanje aktivnosti (samodejno iz urnika)
- Hiter vnos prisotnosti (<1 min za 18 igralcev)
- Kilometrina
- Mesečni obračun (glavni vs sotrener ločeno)
- Samo svoje selekcije in finance

✅ **Sistemu:**
- Samo ena aktivnost na selekcijo/datum
- Zaščita pred podvajanjem
- Rate snapshot (spremembe cenika ne vplivajo nazaj)
- Zaklepanje meseca
- Nespremenljiva revizijska sled
- Popolna RLS zaščita
- GDPR compliant

---

## Zaključek

Ta tehnični načrt pokriva:
✅ 1. Celotno podatkovno shemo (18 tabel)
✅ 2. Povezave med tabelami
✅ 3. Primarne/tuje ključe
✅ 4. Enolične omejitve (UNIQUE podvojena aktivnost!)
✅ 5. RLS pravila (admin vs coach)
✅ 6. Revizijska sled (audit_log + triggers)
✅ 7. Preprečevanje podvojenih aktivnosti
✅ 8. Obračun glavnega/sotrenerja (ločene postavke + snapshot)
✅ 9. Načrt zaslonov
✅ 10. Izvedbeni načrt (5 faz)

**Čaka na vašo potrditev pred začetkom implementacije.**

Prosim, preglejte ta načrt in potrdite:
- Ali je podatkovna shema ustrezna?
- Ali RLS politike ustrezajo vašim zahtevam?
- Ali je pristop k obračunu pravilen (ločene postavke + snapshot)?
- Ali je potek dodajanja aktivnosti jasen (UNIQUE omejitev)?
- Ali je potek izdelave primeren (faze A-E)?

Po vaši potrditvi bom začel z **Fazo A – Podatkovna osnova**.