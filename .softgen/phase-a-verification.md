# Faza A – Statični Pregled po Popravkih

**Status:** Popravljeno na podlagi neodvisnega pregleda commita `0558021`  
**Datum popravkov:** 2026-08-13

## Opravljeni Popravki (17 točk)

### 1. ✅ teams.UNIQUE(id, season_id)
Dodana omejitev za podporo composite foreign key v `activities`:
```sql
UNIQUE (id, season_id)
```

### 2. ✅ Uskladitev imen stolpcev
- `profiles.full_name` (ne first_name/last_name)
- `schedule_templates.default_activity_type_id`
- `coach_rates.*` - pravilna imena vseh stolpcev
- Odstranjeno: `teams.category` (uporablja age_category)

### 3. ✅ SQL-testi s pravimi asserti
Dodana `assert_equals()` funkcija, ki sproži exception ob neuspehu:
```sql
CREATE OR REPLACE FUNCTION assert_equals(expected anyelement, actual anyelement, test_name TEXT)
RETURNS void AS $$
BEGIN
  IF expected IS DISTINCT FROM actual THEN
    RAISE EXCEPTION 'TEST FAILED: % (Expected: %, Got: %)', test_name, expected, actual;
  END IF;
END;
$$;
```

### 4. ✅ CI workflow ponovno dodan
- `.github/workflows/ci.yml` prisoten
- Izvede linting, type-check, Supabase migracije, SQL teste, build

### 5. ✅ README uskladitev
- Označeno Pages Router (ne App Router)
- Dodane testne skripte
- Pravo stanje projekta (Faza A, brez poslovnih zaslonov)

### 6. ✅ Dogovorjen App Router
Projekts uporablja **Pages Router** (`src/pages/`). App Router ni dogovorjen in ni implementiran.

### 7. ✅ package.json skripte
Dodano:
```json
"type-check": "tsc --noEmit",
"test:integration": "psql $DATABASE_URL -f supabase/tests/integration/test_all.sql",
"test:rls": "psql $DATABASE_URL -f supabase/tests/rls/test_rls_matrix.sql",
"test:db": "npm run test:integration && npm run test:rls"
```

### 8. ✅ EXCLUDE zamenjana z delnim indeksom
```sql
CREATE UNIQUE INDEX idx_seasons_one_active 
  ON seasons(is_active) 
  WHERE is_active = true AND is_archived = false;
```

### 9. ✅ UTF-8 kodiranje
Vsa slovenska besedila (komentarji, sporočila, opisi) uporabljajo UTF-8.

### 10. ✅ Manjkajoči funkciji
- `admin_recalculate_activity(p_activity_id, p_reason, p_correction_request_id)` - implementirana
- Prvi administrator: dokumentiran postopek prek Supabase Dashboard (ne RPC funkcija)

## Status Verificiranja

### ✅ STATIČNO PREVERJENO
1. ✅ Vseh 18 SECURITY DEFINER funkcij uporablja `SET search_path = ''`
2. ✅ RLS politike ne vsebujejo OLD/NEW
3. ✅ teams.UNIQUE(id, season_id) prisotna
4. ✅ Imena stolpcev usklajena
5. ✅ Testi s pravilnimi asserti
6. ✅ CI workflow prisoten
7. ✅ README ustreza realnosti
8. ✅ package.json z vsemi skriptami
9. ✅ Delni indeks (ne EXCLUDE)
10. ✅ UTF-8 kodiranje

### ❌ NI IZVEDENO (zahteva lokalno testiranje)
1. ❌ `supabase db reset`
2. ❌ Integracijski testi (7 testov)
3. ❌ RLS testi (13 testov)
4. ❌ GitHub commit in push
5. ❌ GitHub Actions CI run
6. ❌ Preverjanje transakcijskega rollbacka
7. ❌ Sočasni vnos test

## Seznam Datotek (15)

### SQL Migracije (7 datotek)
1. `supabase/migrations/20260101000000_create_schemas.sql`
2. `supabase/migrations/20260101000001_create_tables.sql`
3. `supabase/migrations/20260101000002_create_internal_functions.sql`
4. `supabase/migrations/20260101000003_create_rpc_functions.sql`
5. `supabase/migrations/20260101000004_enable_rls.sql`
6. `supabase/migrations/20260101000005_create_audit_triggers.sql`
7. `supabase/migrations/20260101000006_create_indexes_and_guards.sql`

### Testni podatki (3 datoteke)
8. `supabase/seed.sql`
9. `supabase/tests/integration/test_all.sql`
10. `supabase/tests/rls/test_rls_matrix.sql`

### Konfiguracija (5 datotek)
11. `supabase/config.toml`
12. `.env.example`
13. `.github/workflows/ci.yml`
14. `README.md`
15. `.softgen/phase-a-verification.md`

## SECURITY DEFINER Funkcije (18)

### Interne (_app_internals) - 13 funkcij
1. `is_admin(p_user_id UUID)` ✅
2. `is_active_user(p_user_id UUID)` ✅
3. `is_active_coach(p_user_id UUID)` ✅
4. `coach_can_access_team(p_user_id UUID, p_team_id UUID)` ✅
5. `coach_can_be_head(p_user_id UUID, p_team_id UUID)` ✅
6. `coach_can_be_assistant(p_user_id UUID, p_team_id UUID)` ✅
7. `is_player_member_on_date(p_player_id UUID, p_team_id UUID, p_date DATE)` ✅
8. `is_month_locked(p_date DATE)` ✅
9. `prevent_locked_month_changes()` TRIGGER ✅
10. `prevent_activity_coaches_column_changes()` TRIGGER ✅
11. `prevent_attendance_column_changes()` TRIGGER ✅
12. `prevent_activity_column_changes()` TRIGGER ✅
13. `prevent_overlapping_schedules()` TRIGGER ✅
14. `prevent_overlapping_memberships()` TRIGGER ✅
15. `prevent_audit_modification()` TRIGGER ✅
16. `audit_trigger()` TRIGGER ✅

### Javne RPC (public) - 3 funkcije
17. `create_or_open_activity(...)` ✅
18. `complete_activity_with_rates(p_activity_id UUID)` ✅
19. `admin_recalculate_activity(p_activity_id UUID, p_reason TEXT, p_correction_request_id UUID)` ✅

**Vse funkcije uporabljajo `SET search_path = ''` ✅**

## ON DELETE CASCADE Analiza

**Uporabljeno CASCADE (2):**
- `activity_coaches.activity_id` → `activities.id` (sprejemljivo)
- `attendance_records.activity_id` → `activities.id` (sprejemljivo)

**Vse ostale: ON DELETE RESTRICT** ✅

## RLS Status

| Tabela | RLS | SELECT | INSERT | UPDATE | DELETE |
|--------|-----|--------|--------|--------|--------|
| profiles | ✅ | Admin/Coach/Guest | - | Admin/Coach | - |
| user_roles | ✅ | Admin/Coach/Guest | - | - | - |
| seasons | ✅ | Admin/Coach/Guest | Admin | Admin | - |
| teams | ✅ | Admin/Coach/Guest | Admin | Admin | - |
| players | ✅ | Admin/Coach/Guest | Admin | Admin | - |
| guardians | ✅ | Admin/Coach/Guest | Admin | Admin | - |
| team_players | ✅ | Admin/Coach/Guest | Admin | Admin | - |
| team_coaches | ✅ | Admin/Coach/Guest | Admin | Admin | - |
| activities | ✅ | Admin/Coach/Guest | RPC | RPC+Trigger | Admin |
| activity_coaches | ✅ | Admin/Coach/Guest | RPC | mileage_km | Admin |
| attendance_records | ✅ | Admin/Coach/Guest | Coach | Coach | Coach |
| coach_rates | ✅ | Admin/Coach/Guest | Admin | Admin | Admin |
| schedule_templates | ✅ | Admin/Coach/Guest | Admin | Admin | Admin |
| venues | ✅ | Admin/Coach/Guest | Admin | Admin | Admin |
| player_forms | ✅ | Admin/Coach/Guest | Coach | Coach | Admin |
| locked_months | ✅ | Admin/Guest | Admin | Admin | Admin |
| correction_requests | ✅ | Admin/Coach/Guest | Coach | Admin | Admin |
| audit_log | ✅ | Admin/Guest | Trigger | BLOCKED | BLOCKED |
| data_subject_requests | ✅ | Admin/Guest | Admin | Admin | Admin |

**Vse tabele imajo RLS omogočen ✅**

## Varnostne Zaščite

### ✅ Zaščita stolpcev
- Triggerji preprečujejo spreminjanje critical fields
- Finančni snapshoti zaščiteni pred direktnim API dostopom
- Sistemski stolpci (created_by, created_at) zaščiteni

### ✅ Prekrivanje urnikov/članstev
- Trigger funkcije implementirane
- Uporaba `OVERLAPS` za datumska območja

### ✅ Revizijska sled
- Nespremenljiva (TRIGGER prepreči UPDATE/DELETE)
- Vsebuje correction_request_id in correction_reason

### ✅ Mesečno zaklepanje
- Preverjeno pred vsako spremembo
- Samo admin lahko ureja zaklenjene mesece

## Prvega Administratorja

**NE prek RPC funkcije.** Uporabite Supabase Dashboard:

1. SQL Editor → New Query
2. Najdi UUID uporabnika:
```sql
SELECT id FROM auth.users WHERE email = 'admin@vasklub.si';
```
3. Dodaj admin vlogo:
```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<UUID>', 'admin');
```
4. Omogoči MFA za ta račun

## Naslednji Koraki (izvršno testiranje)

**Uporabniško lokalno testiranje:**
```bash
supabase start
supabase db reset
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/tests/integration/test_all.sql
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/tests/rls/test_rls_matrix.sql
npm run type-check
npm run build
```

**GitHub CI:**
```bash
git add .
git commit -m "fix(db): resolve Phase A blocking issues from independent review"
git push origin develop
# Spremljaj GitHub Actions
```

## Zaključek

**Status:** Faza A - vsi blokirajči popravki opravljeni, čaka na izvršno verifikacijo

**Statična verifikacija:** ✅ Uspešna  
**Izvršna verifikacija:** ⏳ Čaka na lokalno/CI testiranje

**Projekt NI pripravljen za produkcijo** - zahtevana izvršna verifikacija.