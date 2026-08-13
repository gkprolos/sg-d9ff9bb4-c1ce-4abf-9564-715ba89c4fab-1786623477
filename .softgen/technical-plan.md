# Tehnični Načrt – Športni Klub Aplikacija

> **Status:** RAZLIČICA 1.1 – Čaka na potrditev  
> **Datum:** 13. 08. 2026  
> **Različica:** 1.1  
> **Spremembe:** Vseh 20 kritičnih popravkov implementiranih

---

## KAZALO VSEBINE

1. [Spremembe v različici 1.1](#spremembe-v-razlicici-11)
2. [Celotna Podatkovna Shema](#celotna-podatkovna-shema)
3. [Povezave Med Tabelami](#povezave-med-tabelami)
4. [Varne SECURITY DEFINER Funkcije](#varne-security-definer-funkcije)
5. [Row Level Security (RLS) Pravila](#row-level-security-rls-pravila)
6. [Atomske RPC Funkcije](#atomske-rpc-funkcije)
7. [Mesečno Zaklepanje v Podatkovni Zbirki](#mesecno-zaklepanje-v-podatkovni-zbirki)
8. [Dokončana Revizijska Sled](#dokoncana-revizijska-sled)
9. [Matrika Dovoljenj](#matrika-dovoljenj)
10. [Matrika Avtomatiziranih Testov](#matrika-avtomatiziranih-testov)
11. [Načrt Zaslonov](#nacrt-zaslonov)
12. [Izvedbeni Načrt](#izvedbeni-nacrt)
13. [DevOps Strategija](#devops-strategija)
14. [Prvi Administrator](#prvi-administrator)

---

## SPREMEMBE V RAZLIČICI 1.1

### 1. ✅ Odpravljene Rekurzivne RLS Politike

**Problem v1.0:** Politike na `profiles` so preverjale `profiles.role` z `auth.uid()`, kar povzroča rekurzijo.

**Rešitev v1.1:**
- Varne `SECURITY DEFINER` funkcije v shemi `_app_internals`
- Prazen `search_path`
- Popolnoma kvalificirana imena tabel
- Eksplicitna `REVOKE/GRANT` dovoljenja
- Funkcije: `is_admin()`, `is_coach()`, `get_coach_teams()`

---

### 2. ✅ Strožje Politike na activity_coaches

**Problem v1.0:** Trener se lahko sam doda z `coach_id = auth.uid()` brez preverjanja.

**Rešitev v1.1:**
- INSERT politika uporablja `can_coach_insert_activity_coach()` funkcijo
- Preveri: dodeljen selekciji, dovoljenje za vlogo, mesec ni zaklenjen, ni duplikata
- UPDATE samo prek RPC funkcij
- Podrobnosti v [§6.3](#63-activity_coaches-politike)

---

### 3. ✅ Mesečno Zaklepanje v Podatkovni Zbirki

**Problem v1.0:** Zaklepanje samo v UI.

**Rešitev v1.1:**
- Funkcija `is_month_locked(activity_date DATE)` v DB
- Preverjanje v `activities`, `activity_coaches`, `attendance_records` politikah
- Trener NE more UPDATE/DELETE po koncu meseca
- Administrator popravlja prek `admin_update_with_reason()` RPC
- Podrobnosti v [§7](#mesecno-zaklepanje-v-podatkovni-zbirki)

---

### 4. ✅ Atomska RPC Funkcija create_or_open_activity

**Problem v1.0:** Dve ločeni operaciji iz brskalnika.

**Rešitev v1.1:**
- `create_or_open_activity(p_team_id, p_activity_date, p_coach_id)` RPC
- Eno transakcijo: preveri → ustvari/odpri → dodaj trenerja
- UPSERT semantika za sočasne zahtevke
- Podrobnosti v [§6.1](#61-create_or_open_activity)

---

### 5. ✅ Izboljšana complete_activity_with_rates

**Problem v1.0:** Nezadostno preverjanje, ni transakcijska, ni ločenih zneskov.

**Rešitev v1.1:**
- Preveri klicatelja, dovoljenje, glavnega trenerja, cenike
- Transakcijska (ROLLBACK ob napaki)
- Shrani `activity_amount`, `mileage_amount`, `total_amount` ločeno
- Zaokroževanje: `ROUND(amount, 2)`
- Varen `search_path`
- Podrobnosti v [§6.2](#62-complete_activity_with_rates)

---

### 6. ✅ Odpravljeno Neskladje season_id

**Problem v1.0:** `season_id` v `team_players`, `team_coaches`, `activities` se lahko razlikuje od sezone selekcije.

**Rešitev v1.1:**
- Odstranjen `season_id` iz `team_players` in `team_coaches` (sezona pride prek `teams.season_id`)
- Ohranjen `season_id` v `activities` za hitrejše poizvedbe
- **Sestavljeni tuji ključ** `FOREIGN KEY (team_id, season_id) REFERENCES teams(id, season_id)`
- Dodana `season_id` v `teams` za sestavljeni ključ
- Podrobnosti v [§2.4, §2.8, §2.9, §2.11](#celotna-podatkovna-shema)

---

### 7. ✅ Varno Brisanje Zgodovinskih Evidenc

**Problem v1.0:** `ON DELETE CASCADE` bi izbrisal zgodovino.

**Rešitev v1.1:**
- `seasons`: `archived_at TIMESTAMPTZ`, `ON DELETE RESTRICT`
- `teams`, `players`, `activities`: `is_active/archived_at`, `ON DELETE RESTRICT`
- `attendance_records`, `activity_coaches`: `ON DELETE RESTRICT` (ohrani zgodovino)
- CASCADE samo kjer je varno: `player_guardians`, `team_players` (M:N povezave)
- Podrobnosti v [§2 – Vsaka tabela](#celotna-podatkovna-shema)

---

### 8. ✅ Validacija Članstva Igralca na Datum

**Problem v1.0:** Ni preverjanja, ali je igralec član na datum aktivnosti.

**Rešitev v1.1:**
- Funkcija `is_player_in_team_on_date(player_id, team_id, activity_date)`
- INSERT politika na `attendance_records` uporablja to funkcijo
- Podrobnosti v [§4.4](#44-is_player_in_team_on_date)

---

### 9. ✅ team_players z Veljavnostjo Članstva

**Problem v1.0:** Ni `valid_from/valid_to`, ne podpira prestopov sredi sezone.

**Rešitev v1.1:**
```sql
CREATE TABLE team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  membership_status TEXT DEFAULT 'active' CHECK (membership_status IN ('active', 'transferred', 'left')),
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_membership_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
```
- Igralec lahko ima več `team_players` zapisov (različne selekcije, prekrivanja)
- Prisotnost upošteva aktivno članstvo na datum
- Podrobnosti v [§2.8](#28-tabela-team_players)

---

### 10. ✅ Omejeno Urejanje Igralcev s Strani Trenerjev

**Problem v1.0:** Trener lahko z UPDATE spreminja vse stolpce.

**Rešitev v1.1:**
- RPC funkcija `coach_update_player_notes(player_id, notes)`
- Trener lahko ureja SAMO `notes`
- Administrator upravlja vse ostale podatke
- UPDATE politika na `players` uporablja `_app_internals.is_admin()`
- Podrobnosti v [§5.6](#56-rls-politike--players)

---

### 11. ✅ Guardians z profile_id za Starševski Portal

**Problem v1.0:** Ni povezave z `auth.users`.

**Rešitev v1.1:**
```sql
CREATE TABLE guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
- `profile_id` = opcijska povezava z registriranim starševskim računom
- `email` UNIQUE za kasnejšo registracijo
- RLS pripravljen za `role='parent'`
- Podrobnosti v [§2.5](#25-tabela-guardians)

---

### 12. ✅ Dokončana Revizijska Sled

**Problem v1.0:** Psevdokoda, ni razloga v istem zapisu.

**Rešitev v1.1:**
- Kompletni triggers za: `activities`, `activity_coaches`, `attendance_records`, `players`, `guardians`, `player_forms`, `coach_rates`, `team_coaches`, `profiles` (role spremembe)
- `correction_reason` IN `correction_request_id` v `audit_log`
- `admin_update_with_reason()` RPC vstavi dejanske old/new vrednosti + razlog v EN zapis
- Preprečen UPDATE/DELETE na `audit_log` (RLS + missing politike)
- Retencijska politika: 7 let
- Podrobnosti v [§8](#dokoncana-revizijska-sled)

---

### 13. ✅ Preprečeni Neveljavni Urniki

**Problem v1.0:** Več prekrivajočih aktivnih predlog.

**Rešitev v1.1:**
- `get_schedule_template(team_id, activity_date, day_of_week)` vrne MAX 1 predlogo
- Logika: `WHERE is_active AND (valid_from IS NULL OR valid_from <= date) AND (valid_to IS NULL OR valid_to >= date) LIMIT 1`
- UI opozorilo, če administrator ustvarja prekrivajočo predlogo
- Podrobnosti v [§6.4](#64-get_schedule_template)

---

### 14. ✅ Zahtevana Lokacija pri Aktivnosti

**Problem v1.0:** Ni jasnih pravil.

**Rešitev v1.1:**
```sql
CREATE TABLE activities (
  ...
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  custom_venue TEXT,
  ...
  CONSTRAINT location_required CHECK (
    venue_id IS NOT NULL OR custom_venue IS NOT NULL
  ),
  CONSTRAINT location_exclusive CHECK (
    (venue_id IS NULL AND custom_venue IS NOT NULL) OR
    (venue_id IS NOT NULL AND custom_venue IS NULL)
  ),
  CONSTRAINT home_game_for_type_3 CHECK (
    activity_type != 3 OR is_home_game IS NOT NULL
  ),
  CONSTRAINT no_home_flag_for_types_1_2 CHECK (
    activity_type = 3 OR is_home_game IS NULL
  )
);
```
- Ena in samo ena lokacija mora biti nastavljena
- Tip 3 obvezno doma/gostovanje
- Tipi 1,2 brez doma/gostovanje
- Podrobnosti v [§2.11](#211-tabela-activities)

---

### 15. ✅ Preproste Omejitve Namesto EXCLUDE

**Problem v1.0:** Zapleteni `EXCLUDE USING gist`.

**Rešitev v1.1:**
- **Ena aktivna sezona:** Delni enolični indeks
  ```sql
  CREATE UNIQUE INDEX idx_one_active_season 
  ON seasons(is_active) WHERE is_active = true;
  ```
- **En glavni trener:** Delni enolični indeks
  ```sql
  CREATE UNIQUE INDEX idx_one_head_coach_per_activity 
  ON activity_coaches(activity_id) 
  WHERE role = 'head';
  ```
- Brez potrebe po PostgreSQL `btree_gist` razširitvi
- Podrobnosti v [§2.2, §2.12](#celotna-podatkovna-shema)

---

### 16. ✅ Varen Prvi Administrator

**Problem v1.0:** Uporabnik si lahko sam določi vlogo.

**Rešitev v1.1:**
- Trigger `prevent_self_assigned_admin` na `profiles`
- Prvi uporabnik (`SELECT COUNT(*) FROM profiles = 0`) lahko postane admin
- Vsi ostali: vloga `coach` ali `parent`, razen če jo dodeli obstoječi admin
- Način: Administrator prek Supabase dashboard SQL ročno spremeni `role='admin'` za prvega uporabnika
- Podrobnosti v [§14](#prvi-administrator)

---

### 17. ✅ Next.js App Router

**Problem v1.0:** Pages Router.

**Rešitev v1.1:**
- Next.js 15.x (najnovejša stabilna)
- App Router v `src/app/`
- React Server Components
- `layout.tsx`, `page.tsx` konvencije
- Projekt bo reinitiailiziran po potrditvi načrta
- Podrobnosti v [§13.1](#131-tehnologija-stack)

---

### 18. ✅ Migracije in Avtomatizirani Testi

**Problem v1.0:** Ni migracij, ni testov.

**Rešitev v1.1:**
- **Migracije:** Supabase CLI migrations (`.sql` datoteke v `supabase/migrations/`)
- **Enotni testi:** Vitest za finančne formule, validacije
- **Integracijski testi:** Supabase lokaln DB + testi RPC funkcij
- **RLS matrika:** Admin/Coach/Drugi/Neprijavljen za vse tabele
- **E2E testi:** Playwright za vnos prisotnosti
- Matrika testov v [§10](#matrika-avtomatiziranih-testov)

---

### 19. ✅ DevOps Načrt

**Problem v1.0:** Ni strategije za dev/prod, varnostne kopije, CI.

**Rešitev v1.1:**
- **Okolja:** Dev Supabase projekt + Prod Supabase projekt
- **Migracije:** GitHub repo → `supabase/migrations/` → Supabase CLI deploy
- **CI:** GitHub Actions (TypeScript, ESLint, testi, migracije)
- **Varnostne kopije:** Supabase Point-in-Time Recovery (7 dni), tedenski dump
- **Monitoring:** Sentry (backend errors samo), brez GA/tretjih storitev za osebne podatke
- Podrobnosti v [§13](#devops-strategija)

---

### 20. ✅ Obrazci in Revizijska Sled Obvezni

**Problem v1.0:** Označeni kot P3.

**Rešitev v1.1:**
- **Obrazci:** P0 (Faza B) – `form_types`, `player_forms`, tracking
- **Revizijska sled:** P0 (Faza A) – `audit_log`, triggers, admin prikaz
- Premaknjenji v obvezne funkcije prve različice
- Podrobnosti v [§12 – Izvedbeni načrt](#izvedbeni-nacrt)

---

---

## CELOTNA PODATKOVNA SHEMA

### 2.1 Zasebna Shema _app_internals

Vse pomožne funkcije so v ločeni shemi, ki NI v `search_path`.

```sql
CREATE SCHEMA IF NOT EXISTS _app_internals;
REVOKE ALL ON SCHEMA _app_internals FROM PUBLIC;
GRANT USAGE ON SCHEMA _app_internals TO authenticated;
```

---

### 2.2 Tabela: seasons

```sql
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_season_dates CHECK (end_date > start_date)
);

CREATE UNIQUE INDEX idx_one_active_season ON seasons(is_active) WHERE is_active = true;
CREATE INDEX idx_seasons_active ON seasons(is_active) WHERE is_active = true;
CREATE INDEX idx_seasons_dates ON seasons(start_date, end_date);
```

**Stolpci:**
- `id` – UUID
- `name` – TEXT UNIQUE, "2026/2027"
- `start_date` – DATE
- `end_date` – DATE
- `is_active` – BOOLEAN (samo ena aktivna hkrati)
- `archived_at` – TIMESTAMPTZ (arhivirane sezone, ne brisanje)
- `created_at`, `updated_at` – TIMESTAMPTZ

**Omejitve:**
- Delni enolični indeks za samo eno aktivno sezono
- `ON DELETE RESTRICT` iz vseh tabel, ki referenčirajo

---

### 2.3 Tabela: profiles

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'coach', 'parent')) DEFAULT 'coach',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);
```

**Stolpci:**
- `id` – UUID, ujemanje z auth.users
- `email` – TEXT
- `full_name` – TEXT
- `role` – TEXT (admin/coach/parent), DEFAULT 'coach'
- `is_active` – BOOLEAN
- `created_at`, `updated_at` – TIMESTAMPTZ

**Trigger:**
```sql
CREATE TRIGGER prevent_self_assigned_admin
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION _app_internals.check_first_admin();
```

---

### 2.4 Tabela: teams

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  short_name TEXT,
  age_category TEXT,
  gender_category TEXT,
  is_active BOOLEAN DEFAULT true,
  archived_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_team_per_season UNIQUE(season_id, name),
  -- Dodano za sestavljeni tuji ključ
  UNIQUE(id, season_id)
);

CREATE INDEX idx_teams_season ON teams(season_id);
CREATE INDEX idx_teams_active ON teams(is_active);
```

**Sprememba:** Dodan `UNIQUE(id, season_id)` za sestavljeni tuji ključ v `activities`.

---

### 2.5 Tabela: guardians

```sql
CREATE TABLE guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_guardians_profile ON guardians(profile_id);
CREATE INDEX idx_guardians_email ON guardians(email);
```

**Sprememba:** Dodan `profile_id` za prihodnji starševski portal, `email UNIQUE`.

---

### 2.6 Tabela: players

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

**ON DELETE:** RESTRICT (ohrani zgodovino).

---

### 2.7 Tabela: player_guardians

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

**ON DELETE:** CASCADE (M:N povezava, varna za izbris).

---

### 2.8 Tabela: team_players

```sql
CREATE TABLE team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  membership_status TEXT DEFAULT 'active' CHECK (membership_status IN ('active', 'transferred', 'left')),
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_membership_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX idx_team_players_team ON team_players(team_id);
CREATE INDEX idx_team_players_player ON team_players(player_id);
CREATE INDEX idx_team_players_dates ON team_players(valid_from, valid_to);
```

**Spremembe:**
- **Odstranjen** `season_id` (sezona pride prek `teams.season_id`)
- **Dodani** `valid_from`, `valid_to`, `membership_status`
- Igralec lahko ima več zapisov (različne selekcije, prekrivanja)
- ON DELETE player: RESTRICT (ohrani zgodovino)

---

### 2.9 Tabela: team_coaches

```sql
CREATE TABLE team_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  can_be_head_coach BOOLEAN DEFAULT false,
  can_be_assistant BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_coach_per_team UNIQUE(coach_id, team_id)
);

CREATE INDEX idx_team_coaches_team ON team_coaches(team_id);
CREATE INDEX idx_team_coaches_coach ON team_coaches(coach_id);
```

**Spremembe:**
- **Odstranjen** `season_id` (sezona pride prek `teams.season_id`)
- ON DELETE coach: RESTRICT (ohrani zgodovino)
- Dovoljenja za vlogo: `can_be_head_coach`, `can_be_assistant`

---

### 2.10 Tabela: venues

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

---

### 2.11 Tabela: activities

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL,
  team_id UUID NOT NULL,
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
  
  -- Tuji ključi
  FOREIGN KEY (team_id, season_id) REFERENCES teams(id, season_id) ON DELETE RESTRICT,
  
  -- Omejitve
  CONSTRAINT unique_activity_per_team_date UNIQUE(season_id, team_id, activity_date),
  CONSTRAINT valid_activity_times CHECK (end_time > start_time),
  CONSTRAINT location_required CHECK (venue_id IS NOT NULL OR custom_venue IS NOT NULL),
  CONSTRAINT location_exclusive CHECK (
    (venue_id IS NULL AND custom_venue IS NOT NULL) OR
    (venue_id IS NOT NULL AND custom_venue IS NULL)
  ),
  CONSTRAINT home_game_for_type_3 CHECK (activity_type != 3 OR is_home_game IS NOT NULL),
  CONSTRAINT no_home_flag_for_types_1_2 CHECK (activity_type = 3 OR is_home_game IS NULL)
);

CREATE INDEX idx_activities_team ON activities(team_id);
CREATE INDEX idx_activities_season ON activities(season_id);
CREATE INDEX idx_activities_date ON activities(activity_date);
CREATE INDEX idx_activities_status ON activities(status);
```

**Spremembe:**
- **Sestavljeni tuji ključ** `FOREIGN KEY (team_id, season_id)` zagotavlja skladnost sezone
- Lokacija: ena in samo ena (venue_id XOR custom_venue)
- Tip 3: obvezno is_home_game
- Tipi 1,2: is_home_game mora biti NULL
- ON DELETE: RESTRICT (ohrani zgodovino)

---

### 2.12 Tabela: activity_coaches

```sql
CREATE TABLE activity_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('head', 'assistant')),
  hours_worked NUMERIC(5,2),
  kilometers NUMERIC(8,2) DEFAULT 0 CHECK (kilometers >= 0),
  
  -- Rate snapshot (posnetki postavk ob zaključku)
  rate_type_1_per_hour NUMERIC(8,2),
  rate_type_2_per_hour NUMERIC(8,2),
  rate_type_3_fixed NUMERIC(8,2),
  rate_per_km NUMERIC(8,2),
  
  -- Ločeni zneski
  activity_amount NUMERIC(10,2),
  mileage_amount NUMERIC(10,2),
  total_amount NUMERIC(10,2),
  
  km_entered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_coach_per_activity UNIQUE(activity_id, coach_id)
);

CREATE UNIQUE INDEX idx_one_head_coach_per_activity 
  ON activity_coaches(activity_id) 
  WHERE role = 'head';

CREATE INDEX idx_activity_coaches_activity ON activity_coaches(activity_id);
CREATE INDEX idx_activity_coaches_coach ON activity_coaches(coach_id);
CREATE INDEX idx_activity_coaches_role ON activity_coaches(role);
```

**Spremembe:**
- Delni enolični indeks namesto EXCLUDE za glavnega trenerja
- Ločeni zneski: `activity_amount`, `mileage_amount`, `total_amount`
- ON DELETE: RESTRICT (ohrani zgodovino)

---

### 2.13 Tabela: attendance_records

```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
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

**Sprememba:** ON DELETE RESTRICT (ohrani zgodovino).

---

### 2.14 Tabela: schedule_templates

```sql
CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX idx_schedule_templates_day ON schedule_templates(day_of_week);
CREATE INDEX idx_schedule_templates_active ON schedule_templates(is_active) WHERE is_active = true;
```

**Opomba:** Funkcija `get_schedule_template()` vrne max 1 veljavno predlogo.

---

### 2.15 Tabela: form_types

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
```

**Začetni podatki:**
```sql
INSERT INTO form_types (name, description, is_required, display_order) VALUES
  ('Prijavni obrazec', 'Prijavni obrazec za sezono', true, 1),
  ('Obrazec 1B', 'Obrazec 1B', true, 2);
```

---

### 2.16 Tabela: player_forms

```sql
CREATE TABLE player_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  form_type_id UUID NOT NULL REFERENCES form_types(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('received', 'not_received')) DEFAULT 'not_received',
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

---

### 2.17 Tabela: coach_rates

```sql
CREATE TABLE coach_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  
  -- Glavni trener
  head_type_1_per_hour NUMERIC(8,2) DEFAULT 0 CHECK (head_type_1_per_hour >= 0),
  head_type_2_per_hour NUMERIC(8,2) DEFAULT 0 CHECK (head_type_2_per_hour >= 0),
  head_type_3_fixed NUMERIC(8,2) DEFAULT 0 CHECK (head_type_3_fixed >= 0),
  head_per_km NUMERIC(8,2) DEFAULT 0 CHECK (head_per_km >= 0),
  
  -- Sotrener
  assistant_type_1_per_hour NUMERIC(8,2) DEFAULT 0 CHECK (assistant_type_1_per_hour >= 0),
  assistant_type_2_per_hour NUMERIC(8,2) DEFAULT 0 CHECK (assistant_type_2_per_hour >= 0),
  assistant_type_3_fixed NUMERIC(8,2) DEFAULT 0 CHECK (assistant_type_3_fixed >= 0),
  assistant_per_km NUMERIC(8,2) DEFAULT 0 CHECK (assistant_per_km >= 0),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_coach_rates_season UNIQUE(coach_id, season_id)
);

CREATE INDEX idx_coach_rates_coach ON coach_rates(coach_id);
CREATE INDEX idx_coach_rates_season ON coach_rates(season_id);
```

**Sprememba:** ON DELETE RESTRICT, dodane CHECK omejitve (>=0).

---

### 2.18 Tabela: correction_requests

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

---

### 2.19 Tabela: audit_log

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
  correction_request_id UUID REFERENCES correction_requests(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_correction_request ON audit_log(correction_request_id);
```

**Spremembe:**
- Dodan `correction_request_id` za povezavo z odobreno zahtevo
- `timestamp` NOT NULL
- RLS: samo admin branje, INSERT/UPDATE/DELETE brez politik (samo triggers)

---

---

## POVEZAVE MED TABELAMI

```
profiles (users)
  ├── guardians.profile_id (1:1, optional) – prihodnji starševski računi
  ├── team_coaches (M:N) → teams
  ├── activity_coaches (M:N) → activities
  ├── coach_rates (1:N per season)
  └── correction_requests (1:N)

seasons
  ├── teams (1:N)
  ├── activities (1:N)
  ├── player_forms (1:N)
  └── coach_rates (1:N)

teams
  ├── team_players (M:N with validity) → players
  ├── team_coaches (M:N) → profiles
  ├── schedule_templates (1:N)
  └── activities (1:N with season consistency)

players
  ├── team_players (M:N with validity) → teams
  ├── player_guardians (M:N) → guardians
  ├── attendance_records (M:N) → activities
  └── player_forms (1:N)

guardians
  ├── profiles.id (optional for parent portal)
  └── player_guardians (M:N) → players

venues
  ├── schedule_templates (1:N)
  └── activities (1:N, optional)

activities
  ├── teams (N:1 with composite FK ensuring season consistency)
  ├── activity_coaches (1:N) → profiles
  ├── attendance_records (M:N) → players
  └── correction_requests (1:N)

form_types
  └── player_forms (1:N)
```

**Ključne Razlike od v1.0:**
- `team_players` in `team_coaches` **brez** `season_id` (pride prek teams)
- `activities` ima **sestavljeni FK** `(team_id, season_id) → teams(id, season_id)`
- `guardians.profile_id` za prihodnji starševski portal
- ON DELETE RESTRICT za zgodovinske evidence

---

---

## VARNE SECURITY DEFINER FUNKCIJE

Vse funkcije v shemi `_app_internals` z `SECURITY DEFINER`, praznim `search_path`, popolnoma kvalificiranimi imeni.

### 4.1 is_admin()

```sql
CREATE OR REPLACE FUNCTION _app_internals.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
    AND public.profiles.role = 'admin'
    AND public.profiles.is_active = true
  );
END;
$$;

REVOKE ALL ON FUNCTION _app_internals.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _app_internals.is_admin() TO authenticated;
```

---

### 4.2 is_coach()

```sql
CREATE OR REPLACE FUNCTION _app_internals.is_coach()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
    AND public.profiles.role = 'coach'
    AND public.profiles.is_active = true
  );
END;
$$;

REVOKE ALL ON FUNCTION _app_internals.is_coach() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _app_internals.is_coach() TO authenticated;
```

---

### 4.3 get_coach_teams(coach_uuid UUID)

```sql
CREATE OR REPLACE FUNCTION _app_internals.get_coach_teams(coach_uuid UUID)
RETURNS TABLE(team_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT public.team_coaches.team_id
  FROM public.team_coaches
  WHERE public.team_coaches.coach_id = coach_uuid;
END;
$$;

REVOKE ALL ON FUNCTION _app_internals.get_coach_teams(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _app_internals.get_coach_teams(UUID) TO authenticated;
```

---

### 4.4 is_player_in_team_on_date()

```sql
CREATE OR REPLACE FUNCTION _app_internals.is_player_in_team_on_date(
  p_player_id UUID,
  p_team_id UUID,
  p_date DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.team_players tp
    WHERE tp.player_id = p_player_id
    AND tp.team_id = p_team_id
    AND tp.membership_status = 'active'
    AND tp.valid_from <= p_date
    AND (tp.valid_to IS NULL OR tp.valid_to >= p_date)
  );
END;
$$;

REVOKE ALL ON FUNCTION _app_internals.is_player_in_team_on_date(UUID, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _app_internals.is_player_in_team_on_date(UUID, UUID, DATE) TO authenticated;
```

---

### 4.5 can_coach_insert_activity_coach()

```sql
CREATE OR REPLACE FUNCTION _app_internals.can_coach_insert_activity_coach(
  p_activity_id UUID,
  p_coach_id UUID,
  p_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_activity RECORD;
  v_team_coach RECORD;
BEGIN
  -- Pridobi aktivnost
  SELECT a.team_id, a.activity_date, a.status
  INTO v_activity
  FROM public.activities a
  WHERE a.id = p_activity_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Preveri, ali je mesec zaklenjen
  IF _app_internals.is_month_locked(v_activity.activity_date) THEN
    RETURN false;
  END IF;

  -- Preveri, ali je trener dodeljen tej selekciji
  SELECT tc.can_be_head_coach, tc.can_be_assistant
  INTO v_team_coach
  FROM public.team_coaches tc
  WHERE tc.team_id = v_activity.team_id
  AND tc.coach_id = p_coach_id;

  IF NOT FOUND THEN
    RETURN false; -- Trener ni dodeljen selekciji
  END IF;

  -- Preveri dovoljenje za vlogo
  IF p_role = 'head' AND NOT v_team_coach.can_be_head_coach THEN
    RETURN false;
  END IF;

  IF p_role = 'assistant' AND NOT v_team_coach.can_be_assistant THEN
    RETURN false;
  END IF;

  -- Preveri, ali ta trener že ni na aktivnosti
  IF EXISTS (
    SELECT 1 FROM public.activity_coaches ac
    WHERE ac.activity_id = p_activity_id
    AND ac.coach_id = p_coach_id
  ) THEN
    RETURN false; -- Duplikat
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION _app_internals.can_coach_insert_activity_coach(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _app_internals.can_coach_insert_activity_coach(UUID, UUID, TEXT) TO authenticated;
```

---

### 4.6 check_first_admin()

```sql
CREATE OR REPLACE FUNCTION _app_internals.check_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_count INTEGER;
BEGIN
  -- Če je vloga 'admin'
  IF NEW.role = 'admin' THEN
    -- Preveri število obstoječih profilov
    SELECT COUNT(*) INTO profile_count FROM public.profiles;
    
    -- Prvi uporabnik lahko postane admin
    IF profile_count = 0 THEN
      RETURN NEW;
    END IF;
    
    -- Vsi ostali: samo obstoječi admin lahko dodeli vlogo admin
    IF NOT _app_internals.is_admin() THEN
      RAISE EXCEPTION 'Samo administrator lahko dodeli vlogo admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION _app_internals.check_first_admin() FROM PUBLIC;
```

**Trigger:**
```sql
CREATE TRIGGER prevent_self_assigned_admin
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION _app_internals.check_first_admin();
```

---

---

## ROW LEVEL SECURITY (RLS) PRAVILA

Vse tabele imajo RLS enabled. Politike uporabljajo varne `_app_internals` funkcije.

### 5.1 Splošna Pravila

**Administrator:**
- Polni dostop (SELECT, INSERT, UPDATE, DELETE) na vse tabele

**Trener:**
- Vidi samo svoje selekcije (prek `_app_internals.get_coach_teams()`)
- Ustvarja/ureja aktivnosti samo svojih selekcij
- Vidi igralce samo svojih selekcij
- Vidi/ureja prisotnost samo svojih aktivnosti
- Vidi samo svoje finančne podatke
- NE vidi postavk drugih trenerjev

**Starš (prihodnost):**
- Vidi samo svoje otroke
- Samo branje

---

### 5.2 RLS Politike – profiles

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse
CREATE POLICY "admin_all_profiles" ON profiles
  FOR ALL
  USING (_app_internals.is_admin());

-- Trener vidi samo sebe
CREATE POLICY "coach_own_profile" ON profiles
  FOR SELECT
  USING (id = auth.uid() AND _app_internals.is_coach());
```

**Rešitev rekurzije:** Funkcija `is_admin()` direktno bere iz `profiles` brez RLS preverjanja (SECURITY DEFINER).

---

### 5.3 RLS Politike – seasons

```sql
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_seasons" ON seasons
  FOR ALL
  USING (_app_internals.is_admin());

CREATE POLICY "coach_read_seasons" ON seasons
  FOR SELECT
  USING (_app_internals.is_coach());
```

---

### 5.4 RLS Politike – teams

```sql
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_teams" ON teams
  FOR ALL
  USING (_app_internals.is_admin());

-- Trener vidi samo svoje selekcije
CREATE POLICY "coach_own_teams" ON teams
  FOR SELECT
  USING (
    id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
  );
```

---

### 5.5 RLS Politike – venues

```sql
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_venues" ON venues
  FOR ALL
  USING (_app_internals.is_admin());

CREATE POLICY "coach_read_venues" ON venues
  FOR SELECT
  USING (_app_internals.is_coach());
```

---

### 5.6 RLS Politike – players

```sql
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_players" ON players
  FOR ALL
  USING (_app_internals.is_admin());

-- Trener vidi igralce svojih selekcij
CREATE POLICY "coach_own_team_players" ON players
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM team_players tp
      WHERE tp.player_id = players.id
      AND tp.team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
    )
  );

-- Trener NE more UPDATE (razen prek RPC funkcije za notes)
-- UPDATE politika SAMO za admin
CREATE POLICY "admin_update_players" ON players
  FOR UPDATE
  USING (_app_internals.is_admin());
```

**Trener ureja notes prek:**
```sql
CREATE OR REPLACE FUNCTION coach_update_player_notes(
  p_player_id UUID,
  p_notes TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Preveri, ali je trener pooblaščen videti tega igralca
  IF NOT EXISTS (
    SELECT 1
    FROM public.team_players tp
    WHERE tp.player_id = p_player_id
    AND tp.team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Nepooblaščen dostop';
  END IF;

  UPDATE public.players
  SET notes = p_notes, updated_at = now()
  WHERE id = p_player_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION coach_update_player_notes(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION coach_update_player_notes(UUID, TEXT) TO authenticated;
```

---

### 5.7 RLS Politike – guardians

```sql
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_guardians" ON guardians
  FOR ALL
  USING (_app_internals.is_admin());

-- Trener vidi starše igralcev svojih selekcij
CREATE POLICY "coach_own_team_guardians" ON guardians
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM player_guardians pg
      JOIN team_players tp ON tp.player_id = pg.player_id
      WHERE pg.guardian_id = guardians.id
      AND tp.team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
    )
  );

-- Prihodnost: starš vidi samo sebe
CREATE POLICY "parent_own_profile" ON guardians
  FOR SELECT
  USING (profile_id = auth.uid());
```

---

### 5.8 RLS Politike – player_guardians

```sql
ALTER TABLE player_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_player_guardians" ON player_guardians
  FOR ALL
  USING (_app_internals.is_admin());

CREATE POLICY "coach_read_player_guardians" ON player_guardians
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM team_players tp
      WHERE tp.player_id = player_guardians.player_id
      AND tp.team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
    )
  );
```

---

### 5.9 RLS Politike – team_players

```sql
ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_team_players" ON team_players
  FOR ALL
  USING (_app_internals.is_admin());

CREATE POLICY "coach_own_team_players_link" ON team_players
  FOR SELECT
  USING (
    team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
  );
```

---

### 5.10 RLS Politike – team_coaches

```sql
ALTER TABLE team_coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_team_coaches" ON team_coaches
  FOR ALL
  USING (_app_internals.is_admin());

-- Trener vidi samo svoje povezave
CREATE POLICY "coach_own_assignments" ON team_coaches
  FOR SELECT
  USING (coach_id = auth.uid());
```

---

### 5.11 RLS Politike – schedule_templates

```sql
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_schedules" ON schedule_templates
  FOR ALL
  USING (_app_internals.is_admin());

CREATE POLICY "coach_read_own_schedules" ON schedule_templates
  FOR SELECT
  USING (
    team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
  );
```

---

### 5.12 RLS Politike – activities

```sql
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_activities" ON activities
  FOR ALL
  USING (_app_internals.is_admin());

-- Trener vidi aktivnosti svojih selekcij
CREATE POLICY "coach_own_team_activities" ON activities
  FOR SELECT
  USING (
    team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
  );

-- INSERT samo prek RPC create_or_open_activity
-- Ni direktne INSERT politike

-- UPDATE samo če mesec ni zaklenjen
CREATE POLICY "coach_update_unlocked_activities" ON activities
  FOR UPDATE
  USING (
    team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
    AND NOT _app_internals.is_month_locked(activity_date)
  );

-- DELETE samo če mesec ni zaklenjen
CREATE POLICY "coach_delete_unlocked_activities" ON activities
  FOR DELETE
  USING (
    team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
    AND NOT _app_internals.is_month_locked(activity_date)
  );
```

---

### 5.13 RLS Politike – activity_coaches

```sql
ALTER TABLE activity_coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_activity_coaches" ON activity_coaches
  FOR ALL
  USING (_app_internals.is_admin());

-- Trener vidi samo svoje zapise
CREATE POLICY "coach_own_activity_records" ON activity_coaches
  FOR SELECT
  USING (coach_id = auth.uid());

-- INSERT SAMO če preverjanja uspešna
CREATE POLICY "coach_insert_activity_coach" ON activity_coaches
  FOR INSERT
  WITH CHECK (
    coach_id = auth.uid()
    AND _app_internals.can_coach_insert_activity_coach(activity_id, coach_id, role)
  );

-- UPDATE samo če mesec ni zaklenjen in je lastnik
CREATE POLICY "coach_update_unlocked_activity_coach" ON activity_coaches
  FOR UPDATE
  USING (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM activities a
      WHERE a.id = activity_coaches.activity_id
      AND NOT _app_internals.is_month_locked(a.activity_date)
    )
  );

-- DELETE samo če mesec ni zaklenjen
CREATE POLICY "coach_delete_unlocked_activity_coach" ON activity_coaches
  FOR DELETE
  USING (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM activities a
      WHERE a.id = activity_coaches.activity_id
      AND NOT _app_internals.is_month_locked(a.activity_date)
    )
  );
```

---

### 5.14 RLS Politike – attendance_records

```sql
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_attendance" ON attendance_records
  FOR ALL
  USING (_app_internals.is_admin());

-- Trener vidi prisotnost svojih aktivnosti
CREATE POLICY "coach_own_team_attendance" ON attendance_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM activities a
      WHERE a.id = attendance_records.activity_id
      AND a.team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
    )
  );

-- INSERT samo če igralec je član selekcije in mesec ni zaklenjen
CREATE POLICY "coach_insert_attendance" ON attendance_records
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM activities a
      WHERE a.id = attendance_records.activity_id
      AND a.team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
      AND NOT _app_internals.is_month_locked(a.activity_date)
      AND _app_internals.is_player_in_team_on_date(
        attendance_records.player_id,
        a.team_id,
        a.activity_date
      )
    )
  );

-- UPDATE samo če mesec ni zaklenjen
CREATE POLICY "coach_update_unlocked_attendance" ON attendance_records
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM activities a
      WHERE a.id = attendance_records.activity_id
      AND a.team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
      AND NOT _app_internals.is_month_locked(a.activity_date)
    )
  );

-- DELETE samo če mesec ni zaklenjen
CREATE POLICY "coach_delete_unlocked_attendance" ON attendance_records
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM activities a
      WHERE a.id = attendance_records.activity_id
      AND a.team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
      AND NOT _app_internals.is_month_locked(a.activity_date)
    )
  );
```

---

### 5.15 RLS Politike – form_types

```sql
ALTER TABLE form_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_form_types" ON form_types
  FOR ALL
  USING (_app_internals.is_admin());

CREATE POLICY "coach_read_form_types" ON form_types
  FOR SELECT
  USING (_app_internals.is_coach());
```

---

### 5.16 RLS Politike – player_forms

```sql
ALTER TABLE player_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_player_forms" ON player_forms
  FOR ALL
  USING (_app_internals.is_admin());

-- Trener vidi obrazce igralcev svojih selekcij
CREATE POLICY "coach_read_own_team_forms" ON player_forms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM team_players tp
      WHERE tp.player_id = player_forms.player_id
      AND tp.team_id IN (SELECT team_id FROM _app_internals.get_coach_teams(auth.uid()))
    )
  );
```

---

### 5.17 RLS Politike – coach_rates

```sql
ALTER TABLE coach_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_coach_rates" ON coach_rates
  FOR ALL
  USING (_app_internals.is_admin());

-- KRITIČNO: Trener vidi SAMO svoje postavke
CREATE POLICY "coach_own_rates" ON coach_rates
  FOR SELECT
  USING (coach_id = auth.uid());
```

---

### 5.18 RLS Politike – correction_requests

```sql
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_corrections" ON correction_requests
  FOR ALL
  USING (_app_internals.is_admin());

-- Trener vidi samo svoje zahteve
CREATE POLICY "coach_own_corrections" ON correction_requests
  FOR SELECT
  USING (requested_by = auth.uid());

-- Trener lahko ustvari zahtevo
CREATE POLICY "coach_create_corrections" ON correction_requests
  FOR INSERT
  WITH CHECK (requested_by = auth.uid());
```

---

### 5.19 RLS Politike – audit_log

```sql
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Samo admin lahko bere
CREATE POLICY "admin_read_audit_log" ON audit_log
  FOR SELECT
  USING (_app_internals.is_admin());

-- Nobenih INSERT/UPDATE/DELETE politik
-- Samo triggers lahko dodajajo zapise
```

---

---

## ATOMSKE RPC FUNKCIJE

### 6.1 create_or_open_activity

```sql
CREATE OR REPLACE FUNCTION create_or_open_activity(
  p_team_id UUID,
  p_activity_date DATE,
  p_coach_id UUID
)
RETURNS TABLE(
  activity_id UUID,
  is_new BOOLEAN,
  role_assigned TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_activity_id UUID;
  v_existing_record RECORD;
  v_season_id UUID;
  v_template RECORD;
  v_team_coach RECORD;
  v_head_coach_id UUID;
BEGIN
  -- Preveri dovoljenje trenerja
  SELECT tc.can_be_head_coach, tc.can_be_assistant
  INTO v_team_coach
  FROM public.team_coaches tc
  WHERE tc.team_id = p_team_id
  AND tc.coach_id = p_coach_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trener ni dodeljen tej selekciji';
  END IF;

  -- Pridobi season_id iz teams
  SELECT t.season_id INTO v_season_id
  FROM public.teams t
  WHERE t.id = p_team_id;

  -- Preveri, ali aktivnost že obstaja
  SELECT a.id, a.status INTO v_existing_record
  FROM public.activities a
  WHERE a.team_id = p_team_id
  AND a.activity_date = p_activity_date;

  IF FOUND THEN
    -- Aktivnost že obstaja
    v_activity_id := v_existing_record.id;

    -- Preveri, ali je ta trener že dodan
    IF EXISTS (
      SELECT 1 FROM public.activity_coaches ac
      WHERE ac.activity_id = v_activity_id
      AND ac.coach_id = p_coach_id
    ) THEN
      -- Že dodan, samo odpri
      RETURN QUERY SELECT v_activity_id, false, 
        (SELECT ac.role FROM public.activity_coaches ac 
         WHERE ac.activity_id = v_activity_id AND ac.coach_id = p_coach_id),
        'Aktivnost že obstaja, vi ste že dodani'::TEXT;
      RETURN;
    END IF;

    -- Dodaj kot sotrener, če je dovoljen
    IF NOT v_team_coach.can_be_assistant THEN
      RAISE EXCEPTION 'Niste dovoljeni sotrener za to selekcijo';
    END IF;

    INSERT INTO public.activity_coaches (activity_id, coach_id, role)
    VALUES (v_activity_id, p_coach_id, 'assistant');

    RETURN QUERY SELECT v_activity_id, false, 'assistant'::TEXT, 
      'Dodani ste bili kot sotrener'::TEXT;
    RETURN;
  END IF;

  -- Aktivnost ne obstaja, ustvari novo

  -- Pridobi predlogo iz urnika
  SELECT * INTO v_template
  FROM _app_internals.get_schedule_template(
    p_team_id,
    p_activity_date,
    EXTRACT(ISODOW FROM p_activity_date)::INTEGER
  );

  -- Preveri, ali lahko ta trener postane glavni trener
  IF NOT v_team_coach.can_be_head_coach THEN
    RAISE EXCEPTION 'Niste dovoljeni glavni trener za to selekcijo';
  END IF;

  -- Ustvari aktivnost
  INSERT INTO public.activities (
    season_id,
    team_id,
    activity_date,
    activity_type,
    start_time,
    end_time,
    venue_id,
    status,
    created_by
  ) VALUES (
    v_season_id,
    p_team_id,
    p_activity_date,
    COALESCE(v_template.default_activity_type, 1),
    COALESCE(v_template.start_time, '17:00'::TIME),
    COALESCE(v_template.end_time, '18:30'::TIME),
    v_template.venue_id,
    'draft',
    p_coach_id
  )
  RETURNING id INTO v_activity_id;

  -- Dodaj glavnega trenerja
  INSERT INTO public.activity_coaches (activity_id, coach_id, role)
  VALUES (v_activity_id, p_coach_id, 'head');

  RETURN QUERY SELECT v_activity_id, true, 'head'::TEXT, 
    'Nova aktivnost ustvarjena, vi ste glavni trener'::TEXT;
  RETURN;

EXCEPTION
  WHEN unique_violation THEN
    -- Sočasen vnos, poskusi ponovno odpreti
    SELECT id INTO v_activity_id
    FROM public.activities
    WHERE team_id = p_team_id
    AND activity_date = p_activity_date;

    RETURN QUERY SELECT v_activity_id, false, 
      COALESCE((SELECT ac.role FROM public.activity_coaches ac 
                WHERE ac.activity_id = v_activity_id 
                AND ac.coach_id = p_coach_id), 'none'::TEXT),
      'Sočasen vnos zaznan, aktivnost že obstaja'::TEXT;
    RETURN;
END;
$$;

REVOKE ALL ON FUNCTION create_or_open_activity(UUID, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_or_open_activity(UUID, DATE, UUID) TO authenticated;
```

**Uporaba:**
```typescript
const { data, error } = await supabase.rpc('create_or_open_activity', {
  p_team_id: teamId,
  p_activity_date: '2026-08-15',
  p_coach_id: currentUserId
});

// data: { activity_id, is_new, role_assigned, message }
```

---

### 6.2 complete_activity_with_rates

```sql
CREATE OR REPLACE FUNCTION complete_activity_with_rates(p_activity_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_activity RECORD;
  v_coach RECORD;
  v_rates RECORD;
  v_activity_amount NUMERIC(10,2);
  v_mileage_amount NUMERIC(10,2);
  v_total_amount NUMERIC(10,2);
  v_hours NUMERIC(5,2);
BEGIN
  -- Preveri klicatelja
  IF NOT (_app_internals.is_admin() OR _app_internals.is_coach()) THEN
    RAISE EXCEPTION 'Nepooblaščen dostop';
  END IF;

  -- Pridobi aktivnost
  SELECT * INTO v_activity FROM public.activities WHERE id = p_activity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aktivnost ne obstaja';
  END IF;

  -- Če je trener, lahko zaključi samo svoje aktivnosti
  IF NOT _app_internals.is_admin() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.activity_coaches ac
      WHERE ac.activity_id = p_activity_id
      AND ac.coach_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Lahko zaključite samo svoje aktivnosti';
    END IF;
  END IF;

  -- Preveri glavni trener
  IF NOT EXISTS (
    SELECT 1 FROM public.activity_coaches ac
    WHERE ac.activity_id = p_activity_id
    AND ac.role = 'head'
  ) THEN
    RAISE EXCEPTION 'Aktivnost mora imeti glavnega trenerja';
  END IF;

  -- Izračunaj ure
  v_hours := ROUND(
    EXTRACT(EPOCH FROM (v_activity.end_time - v_activity.start_time)) / 3600.0,
    2
  );

  -- Za vsakega trenerja
  FOR v_coach IN
    SELECT * FROM public.activity_coaches WHERE activity_id = p_activity_id
  LOOP
    -- Pridobi njegove postavke
    SELECT * INTO v_rates
    FROM public.coach_rates
    WHERE coach_id = v_coach.coach_id
    AND season_id = v_activity.season_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Manjkajoč cenorazred za trenerja %', v_coach.coach_id;
    END IF;

    -- Skopiraj ustrezne postavke glede na vlogo
    IF v_coach.role = 'head' THEN
      UPDATE public.activity_coaches
      SET
        hours_worked = v_hours,
        rate_type_1_per_hour = v_rates.head_type_1_per_hour,
        rate_type_2_per_hour = v_rates.head_type_2_per_hour,
        rate_type_3_fixed = v_rates.head_type_3_fixed,
        rate_per_km = v_rates.head_per_km
      WHERE id = v_coach.id;
    ELSE
      UPDATE public.activity_coaches
      SET
        hours_worked = v_hours,
        rate_type_1_per_hour = v_rates.assistant_type_1_per_hour,
        rate_type_2_per_hour = v_rates.assistant_type_2_per_hour,
        rate_type_3_fixed = v_rates.assistant_type_3_fixed,
        rate_per_km = v_rates.assistant_per_km
      WHERE id = v_coach.id;
    END IF;

    -- Izračunaj zneske
    SELECT
      rate_type_1_per_hour,
      rate_type_2_per_hour,
      rate_type_3_fixed,
      rate_per_km,
      hours_worked,
      kilometers
    INTO v_rates
    FROM public.activity_coaches
    WHERE id = v_coach.id;

    -- Activity amount
    IF v_activity.activity_type = 1 THEN
      v_activity_amount := ROUND(v_rates.hours_worked * v_rates.rate_type_1_per_hour, 2);
    ELSIF v_activity.activity_type = 2 THEN
      v_activity_amount := ROUND(v_rates.hours_worked * v_rates.rate_type_2_per_hour, 2);
    ELSIF v_activity.activity_type = 3 THEN
      v_activity_amount := ROUND(v_rates.rate_type_3_fixed, 2);
    END IF;

    -- Mileage amount
    v_mileage_amount := ROUND(v_rates.kilometers * v_rates.rate_per_km, 2);

    -- Total
    v_total_amount := v_activity_amount + v_mileage_amount;

    -- Shrani
    UPDATE public.activity_coaches
    SET
      activity_amount = v_activity_amount,
      mileage_amount = v_mileage_amount,
      total_amount = v_total_amount,
      updated_at = now()
    WHERE id = v_coach.id;
  END LOOP;

  -- Označi aktivnost kot zaključeno
  UPDATE public.activities
  SET status = 'completed', updated_at = now()
  WHERE id = p_activity_id;

  RETURN true;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION complete_activity_with_rates(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_activity_with_rates(UUID) TO authenticated;
```

---

### 6.3 admin_update_with_reason

```sql
CREATE OR REPLACE FUNCTION admin_update_with_reason(
  p_table_name TEXT,
  p_record_id UUID,
  p_field_name TEXT,
  p_new_value TEXT,
  p_reason TEXT,
  p_correction_request_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_value TEXT;
  v_user RECORD;
BEGIN
  -- Samo admin
  IF NOT _app_internals.is_admin() THEN
    RAISE EXCEPTION 'Samo administrator lahko popravlja zaklenjene mesece';
  END IF;

  -- Pridobi uporabnika
  SELECT id, email, full_name INTO v_user
  FROM public.profiles
  WHERE id = auth.uid();

  -- Dinamični UPDATE (samo za podprte tabele)
  IF p_table_name = 'activities' THEN
    EXECUTE format('SELECT %I FROM public.activities WHERE id = $1', p_field_name)
    INTO v_old_value
    USING p_record_id;

    EXECUTE format('UPDATE public.activities SET %I = $1, updated_at = now() WHERE id = $2', p_field_name)
    USING p_new_value, p_record_id;

  ELSIF p_table_name = 'activity_coaches' THEN
    EXECUTE format('SELECT %I FROM public.activity_coaches WHERE id = $1', p_field_name)
    INTO v_old_value
    USING p_record_id;

    EXECUTE format('UPDATE public.activity_coaches SET %I = $1, updated_at = now() WHERE id = $2', p_field_name)
    USING p_new_value, p_record_id;

  ELSIF p_table_name = 'attendance_records' THEN
    EXECUTE format('SELECT %I FROM public.attendance_records WHERE id = $1', p_field_name)
    INTO v_old_value
    USING p_record_id;

    EXECUTE format('UPDATE public.attendance_records SET %I = $1, updated_at = now() WHERE id = $2', p_field_name)
    USING p_new_value, p_record_id;

  ELSE
    RAISE EXCEPTION 'Nepodprta tabela za popravke: %', p_table_name;
  END IF;

  -- Ročni audit log vnos z razlogom
  INSERT INTO public.audit_log (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    user_id,
    user_email,
    user_name,
    correction_reason,
    correction_request_id
  ) VALUES (
    p_table_name,
    p_record_id,
    'UPDATE',
    jsonb_build_object(p_field_name, v_old_value),
    jsonb_build_object(p_field_name, p_new_value),
    v_user.id,
    v_user.email,
    v_user.full_name,
    p_reason,
    p_correction_request_id
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION admin_update_with_reason(TEXT, UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_with_reason(TEXT, UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
```

---

### 6.4 get_schedule_template

```sql
CREATE OR REPLACE FUNCTION _app_internals.get_schedule_template(
  p_team_id UUID,
  p_activity_date DATE,
  p_day_of_week INTEGER
)
RETURNS TABLE(
  id UUID,
  start_time TIME,
  end_time TIME,
  venue_id UUID,
  default_activity_type INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id,
    st.start_time,
    st.end_time,
    st.venue_id,
    st.default_activity_type
  FROM public.schedule_templates st
  WHERE st.team_id = p_team_id
  AND st.day_of_week = p_day_of_week
  AND st.is_active = true
  AND (st.valid_from IS NULL OR st.valid_from <= p_activity_date)
  AND (st.valid_to IS NULL OR st.valid_to >= p_activity_date)
  ORDER BY st.valid_from DESC NULLS LAST
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION _app_internals.get_schedule_template(UUID, DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _app_internals.get_schedule_template(UUID, DATE, INTEGER) TO authenticated;
```

---

---

## MESEČNO ZAKLEPANJE V PODATKOVNI ZBIRKI

### 7.1 Funkcija is_month_locked

```sql
CREATE OR REPLACE FUNCTION _app_internals.is_month_locked(p_activity_date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_date DATE;
  v_activity_month DATE;
  v_current_month DATE;
BEGIN
  -- Trenutni datum v časovnem pasu Europe/Ljubljana
  v_current_date := (now() AT TIME ZONE 'Europe/Ljubljana')::DATE;
  
  -- Prvi dan meseca aktivnosti
  v_activity_month := DATE_TRUNC('month', p_activity_date)::DATE;
  
  -- Prvi dan tekočega meseca
  v_current_month := DATE_TRUNC('month', v_current_date)::DATE;
  
  -- Zaklenjen, če je aktivnost v preteklem mesecu
  RETURN v_activity_month < v_current_month;
END;
$$;

REVOKE ALL ON FUNCTION _app_internals.is_month_locked(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _app_internals.is_month_locked(DATE) TO authenticated;
```

### 7.2 Uporaba v RLS Politikah

Funkcija `is_month_locked()` je že integrirana v UPDATE/DELETE politike:
- `activities`: "coach_update_unlocked_activities", "coach_delete_unlocked_activities"
- `activity_coaches`: "coach_update_unlocked_activity_coach", "coach_delete_unlocked_activity_coach"
- `attendance_records`: "coach_update_unlocked_attendance", "coach_delete_unlocked_attendance"

Trener **NE MOŽE** UPDATE/DELETE prek neposrednega Supabase API-ja po koncu meseca.

---

---

## DOKONČANA REVIZIJSKA SLED

### 8.1 Audit Trigger Funkcija

```sql
CREATE OR REPLACE FUNCTION _app_internals.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- Pridobi uporabnika
  SELECT id, email, full_name INTO v_user
  FROM public.profiles
  WHERE id = auth.uid();

  -- INSERT
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.audit_log (
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
      v_user.id,
      v_user.email,
      v_user.full_name
    );
    RETURN NEW;
  
  -- UPDATE
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO public.audit_log (
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
      v_user.id,
      v_user.email,
      v_user.full_name
    );
    RETURN NEW;
  
  -- DELETE
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO public.audit_log (
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
      v_user.id,
      v_user.email,
      v_user.full_name
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION _app_internals.audit_trigger_func() FROM PUBLIC;
```

### 8.2 Trigger Ustvarjanje

```sql
-- Activities
CREATE TRIGGER audit_activities
  AFTER INSERT OR UPDATE OR DELETE ON activities
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_func();

-- Activity Coaches
CREATE TRIGGER audit_activity_coaches
  AFTER INSERT OR UPDATE OR DELETE ON activity_coaches
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_func();

-- Attendance Records
CREATE TRIGGER audit_attendance_records
  AFTER INSERT OR UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_func();

-- Players (UPDATE in DELETE)
CREATE TRIGGER audit_players
  AFTER UPDATE OR DELETE ON players
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_func();

-- Guardians (UPDATE in DELETE)
CREATE TRIGGER audit_guardians
  AFTER UPDATE OR DELETE ON guardians
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_func();

-- Player Forms (UPDATE)
CREATE TRIGGER audit_player_forms
  AFTER UPDATE ON player_forms
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_func();

-- Coach Rates (UPDATE)
CREATE TRIGGER audit_coach_rates
  AFTER UPDATE ON coach_rates
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_func();

-- Team Coaches (INSERT in DELETE)
CREATE TRIGGER audit_team_coaches
  AFTER INSERT OR DELETE ON team_coaches
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_func();

-- Profiles (samo role spremembe)
CREATE TRIGGER audit_profiles_role
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION _app_internals.audit_trigger_func();
```

### 8.3 Retencijska Politika

```sql
-- Izbriši audit zapise starejše od 7 let (2555 dni)
CREATE OR REPLACE FUNCTION _app_internals.delete_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.audit_log
  WHERE timestamp < (now() - INTERVAL '7 years');
END;
$$;

-- Cron job (Supabase Cron Extension, če dostopen)
-- SELECT cron.schedule('delete-old-audits', '0 2 * * 0', 'SELECT _app_internals.delete_old_audit_logs();');
```

**Opomba:** Administrator lahko izvozi celotno revizijsko sled pred brisanjem.

---

---

## MATRIKA DOVOLJENJ

| Tabela              | Admin SELECT | Admin INSERT | Admin UPDATE | Admin DELETE | Coach SELECT | Coach INSERT | Coach UPDATE | Coach DELETE | Parent SELECT | Guest |
|---------------------|--------------|--------------|--------------|--------------|--------------|--------------|--------------|--------------|---------------|-------|
| profiles            | ✅           | ✅           | ✅           | ✅           | Samo sebe    | ❌           | ❌           | ❌           | Samo sebe     | ❌    |
| seasons             | ✅           | ✅           | ✅           | ✅           | ✅           | ❌           | ❌           | ❌           | ❌            | ❌    |
| teams               | ✅           | ✅           | ✅           | ✅           | Svoje        | ❌           | ❌           | ❌           | ❌            | ❌    |
| venues              | ✅           | ✅           | ✅           | ✅           | ✅           | ❌           | ❌           | ❌           | ❌            | ❌    |
| players             | ✅           | ✅           | ✅           | ✅           | Svoje tim    | ❌           | RPC notes    | ❌           | Svoje otroke  | ❌    |
| guardians           | ✅           | ✅           | ✅           | ✅           | Svoje tim    | ❌           | ❌           | ❌           | Sebe          | ❌    |
| player_guardians    | ✅           | ✅           | ✅           | ✅           | Svoje tim    | ❌           | ❌           | ❌           | ❌            | ❌    |
| team_players        | ✅           | ✅           | ✅           | ✅           | Svoje tim    | ❌           | ❌           | ❌           | ❌            | ❌    |
| team_coaches        | ✅           | ✅           | ✅           | ✅           | Sebe         | ❌           | ❌           | ❌           | ❌            | ❌    |
| schedule_templates  | ✅           | ✅           | ✅           | ✅           | Svoje tim    | ❌           | ❌           | ❌           | ❌            | ❌    |
| activities          | ✅           | ✅           | ✅           | ✅           | Svoje tim    | RPC          | Odklenjeno   | Odklenjeno   | ❌            | ❌    |
| activity_coaches    | ✅           | ✅           | ✅           | ✅           | Sebe         | Preverjanje  | Odklenjeno   | Odklenjeno   | ❌            | ❌    |
| attendance_records  | ✅           | ✅           | ✅           | ✅           | Svoje tim    | Validacija   | Odklenjeno   | Odklenjeno   | ❌            | ❌    |
| form_types          | ✅           | ✅           | ✅           | ✅           | ✅           | ❌           | ❌           | ❌           | ❌            | ❌    |
| player_forms        | ✅           | ✅           | ✅           | ✅           | Svoje tim    | ❌           | ❌           | ❌           | ❌            | ❌    |
| coach_rates         | ✅           | ✅           | ✅           | ✅           | **Samo sebe**| ❌           | ❌           | ❌           | ❌            | ❌    |
| correction_requests | ✅           | ✅           | ✅           | ✅           | Sebe         | ✅           | ❌           | ❌           | ❌            | ❌    |
| audit_log           | ✅           | ❌ (triggers)| ❌           | ❌           | ❌           | ❌           | ❌           | ❌           | ❌            | ❌    |

**Legenda:**
- ✅ = Polni dostop
- ❌ = Brez dostopa
- "Samo sebe" = samo lastne podatke
- "Svoje tim" = samo igralce/aktivnosti selekcij, ki so jim dodeljene
- "RPC" = samo prek RPC funkcije
- "Preverjanje" = INSERT politika uporablja `can_coach_insert_activity_coach()`
- "Validacija" = INSERT politika preveri članstvo igralca
- "Odklenjeno" = samo če mesec ni zaklenjen (`is_month_locked()`)

---

---

## MATRIKA AVTOMATIZIRANIH TESTOV

### 10.1 Enotni Testi (Vitest)

| Test                                  | Opis                                                  | Prioriteta |
|---------------------------------------|-------------------------------------------------------|------------|
| Finančna formula – tip 1             | `hours * rate_type_1_per_hour`                        | P0         |
| Finančna formula – tip 2             | `hours * rate_type_2_per_hour`                        | P0         |
| Finančna formula – tip 3             | `rate_type_3_fixed`                                   | P0         |
| Kilometrina                          | `km * rate_per_km`                                    | P0         |
| Zaokroževanje                        | `ROUND(amount, 2)`                                    | P0         |
| Odstotek prisotnosti                 | `(status=1 count) / (total) * 100`                   | P0         |
| Trajanje aktivnosti                  | `(end_time - start_time) / 60` min                   | P0         |
| Veljavnost članstva                  | `valid_from <= date <= valid_to`                     | P1         |

---

### 10.2 Integracijski Testi (Supabase Lokalno)

| Test                                  | Opis                                                  | Prioriteta |
|---------------------------------------|-------------------------------------------------------|------------|
| RPC create_or_open_activity          | Nova aktivnost + glavni trener                       | P0         |
| RPC create_or_open_activity – duplikat | Odpre obstoječo, doda sotrenerja                    | P0         |
| RPC complete_activity_with_rates     | Snapshot postavk, izračun zneskov                     | P0         |
| RPC admin_update_with_reason         | Popravek z razlogom v audit_log                       | P0         |
| Funkcija is_month_locked             | Pretekli mesec = locked, tekoči = unlocked            | P0         |
| Funkcija is_player_in_team_on_date   | Igralec aktiven na datum                              | P0         |
| Funkcija get_schedule_template       | Vrne max 1 veljavno predlogo                          | P1         |
| Trigger audit_trigger_func           | INSERT/UPDATE/DELETE → audit_log                      | P0         |
| Trigger check_first_admin            | Prvi uporabnik = admin, ostali = zavrnjen             | P1         |
| UNIQUE omejitev aktivnost            | Podvojena aktivnost → napaka                          | P0         |
| UNIQUE omejitev glavni trener        | Dva glavna trenerja → napaka                          | P0         |
| UNIQUE omejitev prisotnost           | Podvojen attendance → napaka                          | P0         |
| Sestavljeni FK activities            | Neskladna sezona → napaka                             | P1         |
| Lokacija omejitev                    | Brez venue_id in custom_venue → napaka                | P1         |
| Tip 3 omejitev                       | Brez is_home_game → napaka                            | P1         |

---

### 10.3 RLS Matrika Testi

| Tabela        | Admin | Coach Svoje Tim | Coach Tuje Tim | Drugi Coach | Neprijavljen |
|---------------|-------|-----------------|----------------|-------------|--------------|
| profiles      | ✅    | Sebe ✅         | ❌             | ❌          | ❌           |
| teams         | ✅    | ✅              | ❌             | ❌          | ❌           |
| players       | ✅    | ✅              | ❌             | ❌          | ❌           |
| activities    | ✅    | ✅              | ❌             | ❌          | ❌           |
| activity_coaches | ✅ | Sebe ✅         | ❌             | ❌          | ❌           |
| attendance_records | ✅ | ✅            | ❌             | ❌          | ❌           |
| coach_rates   | ✅    | Sebe ✅         | ❌             | **❌**      | ❌           |

**Kritični test:** Trener NE sme videti postavk drugega trenerja.

---

### 10.4 Testi Mesečnega Zaklepa

| Test                                  | Pričakovan Rezultat                                   | Prioriteta |
|---------------------------------------|-------------------------------------------------------|------------|
| Trener UPDATE avgustovske aktivnosti 1.9. | Zavrnjeno (RLS)                                   | P0         |
| Trener DELETE avgustovske prisotnosti 1.9. | Zavrnjeno (RLS)                                  | P0         |
| Trener INSERT activity_coaches avg 1.9. | Zavrnjeno (is_month_locked)                        | P0         |
| Admin UPDATE avgustovske aktivnosti 1.9. | Uspešno + audit_log z razlogom                     | P0         |
| Neposreden Supabase API UPDATE avg    | Zavrnjeno (RLS politika)                              | P0         |

---

### 10.5 Testi Spremembe Cenika

| Test                                  | Pričakovan Rezultat                                   | Prioriteta |
|---------------------------------------|-------------------------------------------------------|------------|
| Spremeni coach_rates 1.9.            | Avg aktivnosti NISO spremenjene                       | P0         |
| Complete sept aktivnost po spremembi | Nova postavka uporabljena                             | P0         |
| Revizijska sled coach_rates         | old/new values zapisani                               | P1         |

---

### 10.6 Testi Kopiranja Sezone

| Test                                  | Pričakovan Rezultat                                   | Prioriteta |
|---------------------------------------|-------------------------------------------------------|------------|
| Kopiraj sezono z igralci             | team_players preneseni, activities NE                 | P1         |
| Kopiraj sezono z urniki              | schedule_templates preneseni                          | P1         |
| Kopiraj sezono z postavkami          | coach_rates preneseni                                 | P1         |
| Kopiraj sezono brez aktivnosti       | activities, attendance NE preneseni                   | P0         |

---

### 10.7 E2E Testi (Playwright)

| Test                                  | Opis                                                  | Prioriteta |
|---------------------------------------|-------------------------------------------------------|------------|
| Hiter vnos prisotnosti               | 18 igralcev <1 min, Enter navigacija                 | P0         |
| Dodaj aktivnost – nova               | create_or_open_activity → nova                        | P0         |
| Dodaj aktivnost – obstoječa          | create_or_open_activity → odprta                      | P0         |
| Glavni + sotrener obračun            | Različne postavke, ločeni zneski                      | P0         |
| Excel uvoz igralcev                  | Naloži → poveži → preveri → uvozi                     | P1         |
| Admin popravek zaklenjenega meseca   | correction_request → odobritev → audit_log            | P1         |
| Časovni pas Europe/Ljubljana         | 31.8. 23:59 še ni zaklenjen, 1.9. 00:00 je            | P0         |

---

### 10.8 Kontinuirana Integracija (GitHub Actions)

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:unit
      - run: npx supabase db test
      - run: npm run test:e2e
```

---

---

## NAČRT ZASLONOV

*(Enako kot v1.0, z dodanimi Excel uvozom in revizijsko sledjo)*

### 11.1 Trener – Dodaj Prisotnost

```
┌─────────────────────────────────────────┐
│ DODAJ PRISOTNOST                        │
├─────────────────────────────────────────┤
│ Datum: [___15.08.2026___] [Danes] [Jutri]│
│ Selekcija: [Kadetinje 1 ▼]             │
│                                         │
│ [Nadaljuj] ──────────────────────────►  │
└─────────────────────────────────────────┘

↓ Klic RPC create_or_open_activity ↓

┌─────────────────────────────────────────┐
│ PRISOTNOST – Kadetinje 1                │
│ 15.08.2026 | 17:30-19:00 | OŠ A         │
├─────────────────────────────────────────┤
│ Igralka               | Status | Opomba│
│───────────────────────┼────────┼───────│
│ ►  Ana Novak          │ [1]    │       │ ◄ AKTIVNA
│    Maja Kovač         │ [1]    │       │
│    Eva Horvat         │ [0]    │ bolna │
│    Sara Zupan         │ [2]    │       │
│    ...                │        │       │
├─────────────────────────────────────────┤
│ Prisotni: 15 | Odsotni: 2 | Javljeni: 1│
│ [Vse prisotne] [Počisti]                │
│ [Shrani] ────────────────────────────►  │
└─────────────────────────────────────────┘

Tipkovnica:
- Vnos 0/1/2 + Enter → shrani + naslednja vrstica
- Tab/Shift+Tab navigacija
- Aktivna vrstica jasno označena (modra)
- Barve: 1=zelena, 0=rdeča, 2=oranžna, prazno=siva
- Številka + besedilo (ne samo barva)
```

---

### 11.2 Trener – Dashboard

```
┌─────────────────────────────────────────┐
│ MOJ PREGLED                             │
├─────────────────────────────────────────┤
│ DANES: 15.08.2026                       │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 17:30 Kadetinje 1 – OŠ A (dvorana B)│ │
│ │ [Dodaj prisotnost] ─────────────────►│ │
│ └─────────────────────────────────────┘ │
│                                         │
│ JUTRI: 16.08.2026                       │
│ ┌─────────────────────────────────────┐ │
│ │ 18:00 Mini košarka – Dvorana C      │ │
│ └─────────────────────────────────────┘ │
│                                         │
├─────────────────────────────────────────┤
│ AVGUST 2026 – MOJ OBRAČUN               │
│                                         │
│ Glavni trener:                          │
│   Treningi (tip 1): 8 (16h)             │
│   Tekme (tip 3): 1 (D)                  │
│   Znesek: 280,00 EUR                    │
│                                         │
│ Sotrener:                               │
│   Treningi (tip 1): 4 (8h)              │
│   Pripravljalni (tip 2): 3 (6h)         │
│   Znesek: 154,00 EUR                    │
│                                         │
│ Kilometrina: 240 km × 0,35 = 84,00 EUR  │
│ ────────────────────────────────────────│
│ SKUPAJ:                434,00 EUR       │
│                                         │
│ [Podrobnosti] ──────────────────────────│
└─────────────────────────────────────────┘

OPOZORILA:
⚠ Manjkajoča prisotnost: 13.08. Kadetinje 1
⚠ Konec meseca čez 3 dni
```

---

### 11.3 Admin – Igralci z Excel Uvozom

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
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘

Klik na [Uvoz]:
┌─────────────────────────────────────────┐
│ UVOZ IGRALCEV                           │
├─────────────────────────────────────────┤
│ 1. Naloži datoteko:                     │
│    [Izberi XLSX/CSV] [Prenesi predlogo] │
│                                         │
│ 2. Poveži stolpce (prvih 5 vrstic):     │
│    Excel Stolpec    → Polje aplikacije  │
│    ──────────────────────────────────── │
│    [A - Ime]        → [first_name ▼]    │
│    [B - Priimek]    → [last_name ▼]     │
│    [C - Rojstvo]    → [birth_date ▼]    │
│    [D - Telefon St1]→ [starš 1 tel ▼]   │
│    ...                                  │
│                                         │
│ 3. Preverjanje:                         │
│    ✓ Obvezna polja (ime, priimek) OK    │
│    ⚠ 2 možna podvojena igralca:         │
│       - Ana Novak (12.03.2010)          │
│       - Luka Horvat (15.07.2009)        │
│    ✗ 1 neveljaven datum rojstva:        │
│       - Vrstica 12: "32.13.2010"        │
│                                         │
│ [Uvozi 18 igralcev] [Prekliči]          │
└─────────────────────────────────────────┘
```

---

### 11.4 Admin – Revizijska Sled

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
│ Čas: 15.08.2026 15:32:18                │
│ Razlog: Popravek časa na zahtevo trenerja│
│ Povezana zahteva: #req456               │
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

---

## IZVEDBENI NAČRT

### 12. Faze Razvoja (Spremembe glede na v1.0)

**FAZA A: Podatkovna osnova (4-6 iteracij)** – P0

**Cilj:** Vzpostavitev Supabase podatkovne baze, avtentikacije, vlog, RLS, audit.

**Naloge:**
1. Supabase projekt setup (Frankfurt regija, naročnik last)
2. Shema `_app_internals` + varne funkcije:
   - `is_admin()`, `is_coach()`, `get_coach_teams()`
   - `is_player_in_team_on_date()`, `can_coach_insert_activity_coach()`
   - `check_first_admin()`, `is_month_locked()`
3. Ustvarjanje vseh tabel (profiles → audit_log):
   - Sestavljeni FK `(team_id, season_id)` v activities
   - Delni enolični indeksi (ena aktivna sezona, en glavni trener)
   - Omejitve lokacije, tipi aktivnosti
   - ON DELETE RESTRICT za zgodovinske evidence
4. RLS politike za admin in coach (brez rekurzije)
5. **Dokončani audit log triggers** (18 tabel)
6. Auth setup (email/password) + prvi admin trigger
7. Začetni podatki (form_types, aktivna sezona)

**Testi:**
- ✅ Admin vidi vse podatke
- ✅ Trener vidi samo svoje selekcije
- ✅ Trener NE vidi postavk drugih trenerjev (RLS test)
- ✅ UNIQUE omejitve delujejo (podvojena aktivnost → napaka)
- ✅ Sestavljeni FK zagotavlja skladnost sezone
- ✅ Audit log se polni za vse operacije
- ✅ Trigger prvi admin dovoli/zavrne
- ✅ Delni enolični indeksi delujejo

---

**FAZA B: Administracija (6-9 iteracij)** – P0

**Cilj:** Administratorji lahko upravljajo sezone, selekcije, igralce, trenerje, urnik, dvorane, obrazce.

**Naloge:**
1. Next.js App Router setup (`src/app/`)
2. Admin layout + navigacija
3. Sezone: CRUD, arhiviranje, kopiranje sezone (brez aktivnosti/prisotnosti)
4. Selekcije: CRUD
5. Igralci: CRUD + **obrazci tracking** (`form_types`, `player_forms`)
6. **Excel uvoz igralcev:** naloži → poveži → preveri → uvozi
7. Trenerji: CRUD + povezava s selekcijami (`team_coaches` z dovoljenju vlog)
8. Dvorane: CRUD
9. Redni urniki: CRUD + preverjanje prekrivanj
10. Finančne postavke trenerjev (`coach_rates` – ločeno head/assistant)

**Testi:**
- ✅ Administrator lahko ustvari novo sezono
- ✅ Kopiranje sezone prenese samo izbrane entitete (brez aktivnosti)
- ✅ Excel uvoz zazna podvojene igralce
- ✅ Obrazci tracking deluje (form_types dinamična tabela)
- ✅ Trener lahko ima različna dovoljenja za head/assistant na različnih selekcijah
- ✅ Glavni in sotrener imata ločene postavke

---

**FAZA C: Dnevno delo trenerja (7-11 iteracij)** – P0

**Cilj:** Trenerji lahko dodajajo aktivnosti, vnašajo prisotnost, kilometre.

**Naloge:**
1. Trener layout + navigacija
2. Dashboard trenerja (današnji termini, mesečni pregled)
3. **Atomska RPC `create_or_open_activity`:**
   - Preverjanje dovoljenja
   - Ustvarjanje nove / odpiranje obstoječe
   - Dodajanje glavnega / sotrenerja
   - Sočasni zahtevki (UPSERT semantika)
4. Hiter vnos prisotnosti:
   - Excel-stil vnos (0/1/2, Enter, Tab)
   - Validacija članstva igralca na datum (`is_player_in_team_on_date`)
   - Aktivna vrstica jasno označena
5. Ure/kilometri vnos (`activity_coaches`)
6. **Mesečno zaklepanje v DB** (`is_month_locked` funkcija):
   - RLS UPDATE/DELETE politike preverjajo zaklepanje
   - Trener ne more urejati preteklih mesecev prek API-ja
7. **Zahteva za popravek** (`correction_requests`)
8. **RPC `complete_activity_with_rates`:**
   - Rate snapshot (ustrezna postavka glede na vlogo)
   - Ločeni zneski: `activity_amount`, `mileage_amount`, `total_amount`
   - Transakcijska, preverjanje glavnega trenerja, cenike

**Testi:**
- ✅ Dva trenerja ne moreta ustvariti dveh aktivnosti (UNIQUE)
- ✅ Drugi trener se pridruži kot sotrener (RPC)
- ✅ Vnos 18 igralcev v <1 min z tipkovnico
- ✅ Glavni in sotrener imata različne obračune
- ✅ Sprememba cenika ne vpliva na zaključene aktivnosti (rate snapshot)
- ✅ Trener po 1.9. ne more urejati avgustovskih zapisov (RLS + `is_month_locked`)
- ✅ Neposreden Supabase API poskus UPDATE avgusta → zavrnjeno
- ✅ Igralec, ki ni član selekcije na datum → INSERT prisotnosti zavrnjen

---

**FAZA D: Finance in analitika (5-7 iteracij)** – P0

**Cilj:** Obračuni, dashboardi, poročila, izvozi, **revizijska sled UI**.

**Naloge:**
1. Dashboard administratorja (filtri, statistika, opozorila)
2. Trenerjev mesečni obračun:
   - Razčlenjen po vlogah (glavni/sotrener)
   - Ločeni zneski (aktivnosti, kilometrina, skupaj)
3. Analitika po igralcu (prisotnost %)
4. Analitika po selekciji
5. Poročila: Excel/CSV izvoz (igralci, prisotnost, obračuni, kilometrina)
6. **Revizijska sled prikaz:**
   - Filtri (tabela, uporabnik, datum)
   - Podrobnosti zapisa (old/new values, razlog, povezana zahteva)
   - Izvoz CSV
7. **Admin popravki zaklenjenega meseca:**
   - RPC `admin_update_with_reason`
   - Razlog obvezen
   - Povezava s `correction_request_id`

**Testi:**
- ✅ Dashboard prikazuje točne številke
- ✅ Obračun trenerja ločuje glavne/sotrenerske ure in zneske
- ✅ Odstotek prisotnosti igralca pravilen
- ✅ Excel izvoz vsebuje filtrirane podatke
- ✅ Revizijska sled vsebuje old/new values + razlog
- ✅ Admin popravek z razlogom → audit_log + correction_request_id

---

**FAZA E: Testiranje in Priprava Produkcije (3-4 iteracije)** – P0

**Cilj:** Preverjanje sprejemnih testov, responsivnost, varnost, produkcija, CI/CD.

**Naloge:**
1. Preverjanje vseh **25 sprejemnih testov** (iz specifikacije)
2. Mobile responsive testing (telefon, tablica)
3. Preverjanje RLS (trener ne sme videti tujih podatkov)
4. Performance (indeksi, query optimization)
5. Error handling (jasna slovenska sporočila)
6. **CI/CD setup:**
   - GitHub Actions (lint, typecheck, unit tests, integration tests)
   - Supabase migrations preverjanje
7. **Backup strategija:**
   - Supabase Point-in-Time Recovery (7 dni)
   - Tedenski pg_dump izvoz
8. **Monitoring:**
   - Sentry (samo backend errors, brez osebnih podatkov)
9. Dokumentacija za administratorja

**Testi:**
- ✅ Vseh 25 testov iz specifikacije
- ✅ Aplikacija deluje na iPhone, Android, tablici, računalniku
- ✅ Vnos prisotnosti hiter in brez napak
- ✅ RLS popolnoma zaščiten (matrika testov)
- ✅ CI/CD pipeline uspešen

---

---

## DEVOPS STRATEGIJA

### 13.1 Tehnologija Stack

**Frontend:**
- **Next.js 15.x** (najnovejša stabilna, App Router)
- React 19.x
- TypeScript 5.x
- Tailwind CSS 4.x
- shadcn/ui komponente
- Vitest (enotni testi)
- Playwright (E2E testi)

**Backend:**
- Supabase PostgreSQL (Frankfurt regija)
- Supabase Auth
- Supabase RLS
- Database triggers
- RPC funkcije

**Styling:**
- Atletski-profesionalen dizajn (navy + orange)
- IBM Plex Sans Condensed (naslovi)
- IBM Plex Sans (besedilo)
- IBM Plex Mono (številke)

**Deployment:**
- Vercel (Next.js)
- Supabase (backend)
- GitHub (Git repo – naročnik lastnik)

---

### 13.2 Okolja

| Okolje       | Supabase Projekt  | GitHub Branch | Vercel Deploy      |
|--------------|-------------------|---------------|--------------------|
| Development  | Dev Projekt       | `develop`     | Preview (dev-xxx)  |
| Production   | Prod Projekt      | `main`        | Production         |

**Ločena Supabase projekta:**
- **Dev:** Testiranje migracij, RLS, RPC funkcij
- **Prod:** Produkcijska baza, Point-in-Time Recovery

---

### 13.3 Migracije (Supabase CLI)

**Struktura:**
```
supabase/
  ├── migrations/
  │   ├── 20260801000000_initial_schema.sql
  │   ├── 20260802000000_rls_policies.sql
  │   ├── 20260803000000_audit_triggers.sql
  │   ├── 20260804000000_rpc_functions.sql
  │   └── ...
  ├── seed.sql (test podatki za dev)
  └── config.toml
```

**Workflow:**
1. Razvoj lokalno: `supabase db reset` (migracije + seed)
2. Nova migracija: `supabase migration new <name>`
3. Commit v Git
4. Deploy na dev: `supabase db push --project-ref <dev_ref>`
5. Testiranje
6. Merge v `main`
7. Deploy na prod: `supabase db push --project-ref <prod_ref>`

**Rollback:**
- Point-in-Time Recovery (7 dni)
- Shranjen pg_dump pred migracijo

---

### 13.4 CI/CD Pipeline (GitHub Actions)

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - uses: supabase/setup-cli@v1
      - run: npm ci
      - run: supabase start
      - run: npm run test:integration
      - run: supabase stop

  migration-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: supabase db lint
      - run: supabase test db
      - run: supabase stop

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, unit-tests]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

### 13.5 Varnostne Kopije

**Supabase Point-in-Time Recovery:**
- Avtomatsko (7 dni)
- Obnovitev prek Supabase dashboard

**Tedenski pg_dump:**
```bash
#!/bin/bash
# Vsako nedeljo ob 02:00
pg_dump -h db.xxx.supabase.co -U postgres -d postgres --clean --if-exists \
  | gzip > /backups/sportni_klub_$(date +%Y%m%d).sql.gz

# Ohrani zadnjih 12 tednov
find /backups -name "sportni_klub_*.sql.gz" -mtime +84 -delete
```

**Shranjeno:**
- S3 / Supabase Storage
- Lokal (administratorjev računalnik)

---

### 13.6 Monitoring in Napake

**Sentry (Backend Errors):**
- Samo server errors
- **Brez osebnih podatkov** (ime, priimek, e-pošta filtrirani)
- Samo stack trace + error message

**Ne uporabljaj:**
- Google Analytics (GDPR)
- Tretje storitve za tracking osebnih podatkov

**Logiranje:**
- Supabase Logs (vgrajeno)
- Vercel Logs (deployment, runtime)

---

### 13.7 Obnovitev iz Varnostne Kopije

**Postopek:**
1. Ustvari nov Supabase projekt (Frankfurt)
2. Naloži pg_dump:
   ```bash
   gunzip -c backup.sql.gz | psql -h db.xxx.supabase.co -U postgres -d postgres
   ```
3. Poženi migracije (če backup ni najnovejši):
   ```bash
   supabase db push
   ```
4. Preveri RLS, RPC, triggers
5. Posodobi Vercel env vars (SUPABASE_URL, ANON_KEY)
6. Deploy Next.js app

---

---

## PRVI ADMINISTRATOR

### 14.1 Postopek

**Problem:** Prvi uporabnik si mora nastaviti vlogo `admin`, ostali ne smejo.

**Rešitev:**

1. **Trigger `check_first_admin`** dovoli prvi profil z `role='admin'`.
2. **Administrator** ročno ustvari prvi admin račun:

**Koraki:**

```sql
-- 1. Ustvari prvega uporabnika prek Supabase Auth (UI ali API)
-- Email: admin@sportni-klub.si
-- Geslo: [začasno varno geslo]

-- 2. Pridobi UUID uporabnika
SELECT id FROM auth.users WHERE email = 'admin@sportni-klub.si';
-- Primer: a1b2c3d4-...

-- 3. Vstavi profil z vlogo admin (trigger dovoli prvi profil)
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  'a1b2c3d4-...',
  'admin@sportni-klub.si',
  'Administrator Kluba',
  'admin'
);

-- 4. Vsi nadaljnji uporabniki
-- Registracija prek UI → trigger preveri → dovoli samo 'coach' ali 'parent'
-- Administrator nato ročno spremeni vlogo, če potrebno
```

**Varnost:**
- Trigger preprečuje samodejno dodeljeno vlogo `admin`
- Samo prvi profil ali obstoječi admin lahko dodeli vlogo `admin`

---

---

## ZAKLJUČEK

### Tehnični načrt v1.1 vsebuje:

✅ **1. Odpravljene rekurzivne RLS politike** – varne `SECURITY DEFINER` funkcije v `_app_internals`  
✅ **2. Strožje politike activity_coaches** – `can_coach_insert_activity_coach()` preveri dovoljenja  
✅ **3. Mesečno zaklepanje v DB** – `is_month_locked()` funkcija v RLS politikah  
✅ **4. Atomska RPC `create_or_open_activity`** – ena transakcija, sočasni zahtevki  
✅ **5. Izboljšana `complete_activity_with_rates`** – preverjanje, transakcijska, ločeni zneski  
✅ **6. Odpravljeno neskladje season_id** – sestavljeni FK `(team_id, season_id)`  
✅ **7. Varno brisanje** – ON DELETE RESTRICT za zgodovinske evidence, `archived_at`  
✅ **8. Validacija članstva** – `is_player_in_team_on_date()` v INSERT politiki  
✅ **9. team_players z veljavnostjo** – `valid_from`, `valid_to`, `membership_status`  
✅ **10. Omejeno urejanje igralcev** – trener samo prek `coach_update_player_notes()` RPC  
✅ **11. guardians.profile_id** – pripravljeno za starševski portal  
✅ **12. Dokončana revizijska sled** – kompletni triggers, old/new values, razlog, retention  
✅ **13. Preprečeni neveljavni urniki** – `get_schedule_template()` max 1 predloga  
✅ **14. Zahtevana lokacija** – omejitve `location_required`, `location_exclusive`, tipi  
✅ **15. Preproste omejitve** – delni enolični indeksi namesto EXCLUDE  
✅ **16. Prvi administrator** – trigger `check_first_admin()` + postopek  
✅ **17. Next.js App Router** – projekt bo reinitiailiziran  
✅ **18. Migracije in testi** – Supabase CLI, Vitest, Playwright, matrika testov  
✅ **19. DevOps načrt** – dev/prod okolja, CI/CD, backups, monitoring  
✅ **20. Obrazci in audit P0** – premaknjeni v obvezne funkcije prve različice  

**Dodatno:**
- Matrika dovoljenj (admin/coach/parent/guest)
- Matrika avtomatiziranih testov (enotni, integracijski, RLS, E2E)
- Načrt zaslonov (Excel uvoz, revizijska sled)
- Izvedbeni načrt po fazah (A-E)
- DevOps strategija (migracije, CI/CD, backups)

---

**ČA NA VAŠO POTRDITEV.**

**Prosim, preglejte različico 1.1 in:**
1. Potrdite, da so vsi popravki ustrezni
2. Odobrite začetek reinicializacije projekta z App Router
3. Potrdite začetek implementacije Faze A – Podatkovna osnova

**Po vaši potrditvi:**
1. Reinitiailizacija projekta (Next.js App Router, locked dependencies)
2. Začetek Faze A (Supabase setup, varne funkcije, tabele, RLS, triggers)

---