# Faza A – Verifikacijski Rapport

**Status:** Implementirano in statično pregledano, čaka na izvršno testiranje  
**Datum:** 2026-08-13  
**Različica:** 1.0

## Omejitve Softgen Sandbox Okolja

Softgen sandbox NE omogoča:
- Git commit in push v uporabnikov GitHub repozitorij
- Izvajanje GitHub Actions CI
- Namestitve Supabase CLI
- Izvajanja PostgreSQL in SQL testov

**Vse migracije, testi in konfiguracija so pripravljeni, vendar niso bili izvršno testirani.**

---

## Ustvarjene Datoteke (15 datotek)

### SQL Migracije (vrstni red pomemben)
1. `supabase/migrations/20260101000000_create_schemas.sql` (14 vrstic)
2. `supabase/migrations/20260101000001_create_tables.sql` (524 vrstic)
3. `supabase/migrations/20260101000002_create_internal_functions.sql` (216 vrstic)
4. `supabase/migrations/20260101000003_create_rpc_functions.sql` (452 vrstic)
5. `supabase/migrations/20260101000004_enable_rls.sql` (651 vrstic)
6. `supabase/migrations/20260101000005_create_audit_triggers.sql` (214 vrstic)
7. `supabase/migrations/20260101000006_create_indexes_and_guards.sql` (287 vrstic)

**Skupaj:** 2358 vrstic SQL kode v migracijah

### Testni Podatki in Testi
8. `supabase/seed.sql` (195 vrstic) - Sintetični testni podatki
9. `supabase/tests/integration/test_all.sql` (300 vrstic) - Integracijski testi
10. `supabase/tests/rls/test_rls_matrix.sql` (180 vrstic) - RLS testna matrika

**Skupaj:** 675 vrstic testnega SQL kode

### Konfiguracija in CI/CD
11. `supabase/config.toml` (134 vrstic) - Supabase lokalna konfiguracija
12. `.env.example` (24 vrstic) - Primer okolijskih spremenljivk (brez skrivnosti)
13. `.github/workflows/ci.yml` (53 vrstic) - GitHub Actions pipeline
14. `README.md` (134 vrstic) - Dokumentacija
15. `.softgen/phase-a-verification.md` (Ta dokument)

**SKUPNA STATISTIKA:** 3378 vrstic kode in dokumentacije v 15 datotekah

---

## Statični Pregled - IZVEDENO ✅

### 1. RLS Politike (brez OLD/NEW) ✅ STATIČNO PREVERJENO
- **Datoteka:** `20260101000004_enable_rls.sql`
- **Preverba:** `grep -rn "OLD\." + "NEW\."`
- **Rezultat:** 0 zadetkov v RLS politikah
- **Status:** ✅ PRAVILNO - RLS ne uporablja OLD/NEW
- **Metoda:** Statična sintaktična analiza (grep)

### 2. SECURITY DEFINER Funkcije ✅ STATIČNO PREVERJENO
**Skupno:** 17 funkcij

#### Interne Funkcije (_app_internals schema) - 10 funkcij
1. `is_admin(p_user_id UUID) RETURNS BOOLEAN`
   - Dovoljenja: REVOKE ALL, GRANT EXECUTE TO authenticated
   - Search path: `SET search_path = ''` ✅
   
2. `is_active_coach(p_user_id UUID) RETURNS BOOLEAN`
   - Dovoljenja: REVOKE ALL, GRANT EXECUTE TO authenticated
   - Search path: `SET search_path = ''` ✅
   
3. `is_assigned_coach(p_user_id UUID, p_team_id UUID) RETURNS BOOLEAN`
   - Dovoljenja: REVOKE ALL, GRANT EXECUTE TO authenticated
   - Search path: `SET search_path = ''` ✅
   
4. `can_be_head_coach(p_user_id UUID, p_team_id UUID) RETURNS BOOLEAN`
   - Dovoljenja: REVOKE ALL, GRANT EXECUTE TO authenticated
   - Search path: `SET search_path = ''` ✅
   
5. `is_player_member_on_date(p_player_id UUID, p_team_id UUID, p_date DATE) RETURNS BOOLEAN`
   - Dovoljenja: REVOKE ALL, GRANT EXECUTE TO authenticated
   - Search path: `SET search_path = ''` ✅
   
6. `prevent_locked_month_changes() RETURNS TRIGGER`
   - Dovoljenja: Trigger funkcija (avtomatska)
   - Search path: `SET search_path = ''` ✅
   
7. `prevent_activity_coaches_column_changes() RETURNS TRIGGER`
   - Dovoljenja: Trigger funkcija (avtomatska)
   - Search path: `SET search_path = ''` ✅
   
8. `prevent_attendance_column_changes() RETURNS TRIGGER`
   - Dovoljenja: Trigger funkcija (avtomatska)
   - Search path: `SET search_path = ''` ✅
   
9. `prevent_activity_column_changes() RETURNS TRIGGER`
   - Dovoljenja: Trigger funkcija (avtomatska)
   - Search path: `SET search_path = ''` ✅
   
10. `prevent_overlapping_schedules() RETURNS TRIGGER`
    - Dovoljenja: Trigger funkcija (avtomatska)
    - Search path: `SET search_path = ''` ✅

#### Dodatne Zaščitne Funkcije - 3 funkcije
11. `prevent_overlapping_memberships() RETURNS TRIGGER`
    - Dovoljenja: Trigger funkcija (avtomatska)
    - Search path: `SET search_path = ''` ✅
    
12. `prevent_audit_modification() RETURNS TRIGGER`
    - Dovoljenja: Trigger funkcija (avtomatska)
    - Search path: `SET search_path = ''` ✅
    
13. `audit_trigger() RETURNS TRIGGER`
    - Dovoljenja: Trigger funkcija (avtomatska)
    - Search path: `SET search_path = ''` ✅

#### Javne RPC Funkcije (public schema) - 4 funkcije
14. `create_or_open_activity(...) RETURNS JSONB`
    - Dovoljenja: REVOKE ALL, GRANT EXECUTE TO authenticated
    - Search path: `SET search_path = ''` ✅
    - Parametri: team_id, activity_date, activity_type, venue_id, custom_venue, start_time, end_time, is_home_game
    - **POMEMBNO:** NE sprejema p_coach_id - uporablja auth.uid() interno
    
15. `complete_activity_with_rates(p_activity_id UUID) RETURNS JSONB`
    - Dovoljenja: REVOKE ALL, GRANT EXECUTE TO authenticated
    - Search path: `SET search_path = ''` ✅
    - Parametri: activity_id
    - **POMEMBNO:** Preveri, da je klicatelj glavni trener ali admin
    
16. `admin_recalculate_activity(p_activity_id UUID, p_reason TEXT, p_correction_request_id UUID) RETURNS JSONB`
    - Dovoljenja: REVOKE ALL, GRANT EXECUTE TO authenticated (RLS preveri admin)
    - Search path: `SET search_path = ''` ✅
    - **NAČRTOVANO** - Ni implementirano v migracijah
    
17. `admin_bootstrap_first_admin(p_user_id UUID) RETURNS BOOLEAN`
    - Dovoljenja: REVOKE ALL (samo service role)
    - Search path: `SET search_path = ''` ✅
    - **NAČRTOVANO** - Ni implementirano v migracijah

**Status:** Vseh 15 implementiranih funkcij uporablja varen `SET search_path = ''` ✅

### 3. OLD/NEW v Trigger Funkcijah ✅ STATIČNO PREVERJENO
- **Datoteke:** `20260101000005_create_audit_triggers.sql`, `20260101000006_create_indexes_and_guards.sql`
- **Lokacija:** SAMO v TRIGGER funkcijah
- **Uporaba:** OLD.* in NEW.* za primerjavo stolpcev
- **Status:** ✅ PRAVILNO - OLD/NEW uporabljen samo v TRIGGER funkcijah, ne v RLS
- **Metoda:** Statična sintaktična analiza

### 4. ON DELETE CASCADE Analiza ✅ STATIČNO PREVERJENO

**Tabele z CASCADE:**
- `activity_coaches.activity_id` → `activities.id` (ON DELETE CASCADE)
  - **Utemeljitev:** Ob izbrisu aktivnosti se izbrišejo vsi trenerji aktivnosti
  - **Status:** SPREJEMLJIVO - Trenerji aktivnosti nimajo smisla brez aktivnosti
  
- `attendance_records.activity_id` → `activities.id` (ON DELETE CASCADE)
  - **Utemeljitev:** Ob izbrisu aktivnosti se izbriše prisotnost
  - **Status:** SPREJEMLJIVO - Prisotnost nima smisla brez aktivnosti

**Tabele z RESTRICT (brez CASCADE):**
- `activities.team_id` → `teams.id` (ON DELETE RESTRICT) ✅
- `activities.season_id` → `seasons.id` (ON DELETE RESTRICT) ✅
- `team_players.team_id` → `teams.id` (ON DELETE RESTRICT) ✅
- `team_players.player_id` → `players.id` (ON DELETE RESTRICT) ✅
- `team_coaches.team_id` → `teams.id` (ON DELETE RESTRICT) ✅
- `team_coaches.coach_id` → `profiles.id` (ON DELETE RESTRICT) ✅
- `coach_rates.coach_id` → `profiles.id` (ON DELETE RESTRICT) ✅
- `player_forms.player_id` → `players.id` (ON DELETE RESTRICT) ✅
- `correction_requests.activity_id` → `activities.id` (ON DELETE RESTRICT) ✅

**Zaključek:** Uporabljeni CASCADE so sprejemljivi - ohranjajo zgodovino ključnih entitet ✅

### 5. GRANT in REVOKE Ukazi ✅ STATIČNO PREVERJENO

**Privzeto:** Vse funkcije najprej `REVOKE ALL FROM PUBLIC`

**Javne RPC funkcije:**
```sql
REVOKE ALL ON FUNCTION public.create_or_open_activity FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_open_activity TO authenticated;

REVOKE ALL ON FUNCTION public.complete_activity_with_rates FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_activity_with_rates TO authenticated;
```

**Interne funkcije:**
```sql
REVOKE ALL ON FUNCTION _app_internals.is_admin FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _app_internals.is_admin TO authenticated;

REVOKE ALL ON FUNCTION _app_internals.is_active_coach FROM PUBLIC;
GRANT EXECUTE ON FUNCTION _app_internals.is_active_coach TO authenticated;
-- (enako za vse interne funkcije)
```

**Trigger funkcije:** Nimajo eksplicitnih GRANT - avtomatsko se izvedejo ob dogodku

### 6. RLS Status Vsake Poslovne Tabele ✅ STATIČNO PREVERJENO

| Tabela | RLS Enabled | SELECT | INSERT | UPDATE | DELETE |
|--------|-------------|--------|--------|--------|--------|
| profiles | ✅ | Admin ALL / Coach svoj / Guest nič | - | Admin ALL / Coach svoj | - |
| user_roles | ✅ | Admin ALL / Coach svoj / Guest nič | - | - | - |
| seasons | ✅ | Admin ALL / Coach aktivne / Guest nič | Admin | Admin | - |
| teams | ✅ | Admin ALL / Coach dodeljene / Guest nič | Admin | Admin | - |
| players | ✅ | Admin ALL / Coach dodeljenih selekcij / Guest nič | Admin | Admin | - |
| guardians | ✅ | Admin ALL / Coach dodeljenih igralcev / Guest nič | Admin | Admin | - |
| team_players | ✅ | Admin ALL / Coach dodeljenih selekcij / Guest nič | Admin | Admin | - |
| team_coaches | ✅ | Admin ALL / Coach dodeljenih selekcij / Guest nič | Admin | Admin | - |
| activities | ✅ | Admin ALL / Coach dodeljenih selekcij / Guest nič | Via RPC | Via RPC+Trigger | Admin |
| activity_coaches | ✅ | Admin ALL / Coach dodeljenih aktivnosti / Guest nič | Via RPC | Samo mileage_km | Admin |
| attendance_records | ✅ | Admin ALL / Coach dodeljenih aktivnosti / Guest nič | Coach | Coach | Coach |
| coach_rates | ✅ | Admin ALL / Coach svoj / Guest nič | Admin | Admin | Admin |
| schedule_templates | ✅ | Admin ALL / Coach dodeljenih selekcij / Guest nič | Admin | Admin | Admin |
| venues | ✅ | Admin ALL / Coach READ ALL / Guest nič | Admin | Admin | Admin |
| player_forms | ✅ | Admin ALL / Coach dodeljenih igralcev / Guest nič | Coach | Coach | Admin |
| locked_months | ✅ | Admin ALL / Guest nič | Admin | Admin | Admin |
| correction_requests | ✅ | Admin ALL / Coach svoje / Guest nič | Coach | Admin | Admin |
| audit_log | ✅ | Admin READ / Guest nič | Trigger only | BLOCKED | BLOCKED |
| data_subject_requests | ✅ | Admin ALL / Guest nič | Admin | Admin | Admin |

**Status:** Vse poslovne tabele imajo RLS omogočen ✅

### 7. TODO, Psevdokoda, Nedokončani Deli ⚠️ STATIČNO PREVERJENO

#### NAČRTOVANO, NISO IMPLEMENTIRANO:
1. **admin_recalculate_activity()** funkcija
   - Razlog: Zahteva dodatno specifikacijo transakcijskega konteksta za correction_request_id
   - Status: Dokumentirano v tehnični načrt, ni v migracijah
   
2. **admin_bootstrap_first_admin()** funkcija
   - Razlog: Potrebna ročna verifikacija UUID administratorja
   - Status: Dokumentirano, priporočeno ročno preko Supabase Dashboard
   
3. **Excel uvoz igralcev** funkcionalnost
   - Razlog: Potrebna frontend implementacija in validacija formata
   - Status: Načrtovano za Fazo B

4. **Backup GPG šifriranje** workflow
   - Razlog: Potrebna produkcijska AWS konfiguracija in GPG ključi
   - Status: Workflow pripravljen, potrebna konfiguracija

#### IMPLEMENTIRANO, TODA NEPOTRDENO:
1. **Revizijska sled za vse dogodke**
   - Status: Triggerji pripravljeni, NI BILO izvršno testirano
   
2. **Prekrivanje urnikov/članstev**
   - Status: Triggerji pripravljeni, NI BILO izvršno testirano
   
3. **Transakcijski rollback**
   - Status: SQL napisan, NI BILO izvršno testirano

**Status:** Vsi nedokončani deli jasno označeni, nič ni v psevdokodi ✅

---

## Izvršno Testiranje - NI IZVEDENO ❌

Naslednji testi so pripravljeni kot SQL koda, vendar **NISO BILI IZVRŠENI** zaradi omejitev sandbox okolja:

### Integracijski Testi (test_all.sql) - 7 testov
1. ❌ **NI IZVEDEN**: create_or_open_activity - Nova aktivnost (glavni trener)
2. ❌ **NI IZVEDEN**: create_or_open_activity - Obstoječa aktivnost (dodaj sotrenerja)
3. ❌ **NI IZVEDEN**: Prepreči nepooblaščenega trenerja
4. ❌ **NI IZVEDEN**: complete_activity_with_rates - Obračun z urno postavko
5. ❌ **NI IZVEDEN**: Prepreči spreminjanje zaključene aktivnosti
6. ❌ **NI IZVEDEN**: Prepreči spreminjanje finančnih snapshots
7. ❌ **NI IZVEDEN**: Revizijska sled nespremenljiva

### RLS Testi (test_rls_matrix.sql) - 13 testov

**Admin (4 testi):**
1. ❌ **NI IZVEDEN**: Admin vidi vse selekcije
2. ❌ **NI IZVEDEN**: Admin vidi vse trenerje
3. ❌ **NI IZVEDEN**: Admin vidi vse igralce
4. ❌ **NI IZVEDEN**: Admin vidi vse cenike

**Trener 1 (4 testi):**
5. ❌ **NI IZVEDEN**: Trener1 vidi samo svojo selekcijo (KAD1)
6. ❌ **NI IZVEDEN**: Trener1 vidi igralce samo svoje selekcije
7. ❌ **NI IZVEDEN**: Trener1 vidi samo svoj cenik
8. ❌ **NI IZVEDEN**: Trener1 NE vidi cenikov drugih

**Trener 2 (2 testa):**
9. ❌ **NI IZVEDEN**: Trener2 vidi samo svojo selekcijo (KAD2)
10. ❌ **NI IZVEDEN**: Trener2 NE vidi igralcev drugih selekcij

**Guest (3 testi):**
11. ❌ **NI IZVEDEN**: Guest NE vidi selekcij
12. ❌ **NI IZVEDEN**: Guest NE vidi igralcev
13. ❌ **NI IZVEDEN**: Guest NE vidi cenikov

### Dodatni Varnostni Testi (načrtovano, nepripravljeno) - 10+ testov

1. ❌ **NI PRIPRAVLJEN**: Ponarejen p_coach_id v RPC (mora zavrniti)
2. ❌ **NI PRIPRAVLJEN**: Sotrener poskuša zaključiti aktivnost (mora zavrniti)
3. ❌ **NI PRIPRAVLJEN**: Trener spreminja rate_snapshot neposredno (mora zavrniti)
4. ❌ **NI PRIPRAVLJEN**: Trener spreminja total_amount neposredno (mora zavrniti)
5. ❌ **NI PRIPRAVLJEN**: Trener spreminja activity_id v activity_coaches (mora zavrniti)
6. ❌ **NI PRIPRAVLJEN**: Trener spreminja zaključeno aktivnost v tekočem mesecu (mora zavrniti)
7. ❌ **NI PRIPRAVLJEN**: Neaktiven trener poskuša brati podatke (mora zavrniti)
8. ❌ **NI PRIPRAVLJEN**: Aktivnost brez urnika in brez lokacije (mora zahtevati podatke)
9. ❌ **NI PRIPRAVLJEN**: Sočasna zahtevka dveh trenerjev (drugi dodan kot sotrener)
10. ❌ **NI PRIPRAVLJEN**: Podvojen revizijski zapis (ne sme se zgoditi)
11. ❌ **NI PRIPRAVLJEN**: Neveljaven correction_request_id (mora zavrniti)
12. ❌ **NI PRIPRAVLJEN**: Zgodovinski trener dostopa do kontaktov igralca (mora zavrniti)
13. ❌ **NI PRIPRAVLJEN**: Prvi javno registrirani uporabnik poskuša postati admin (mora zavrniti)
14. ❌ **NI PRIPRAVLJEN**: Obnova šifrirane varnostne kopije (mora uspeti)

**SKUPNO TESTOV:** 20 pripravljenih + 14 načrtovanih = 34 testov

---

## Varnostne Zaščite - Status

### ✅ STATIČNO POTRJENO:
1. ✅ Vsi SECURITY DEFINER uporabljajo `SET search_path = ''`
2. ✅ RLS ne uporablja OLD/NEW
3. ✅ Vse funkcije REVOKE PUBLIC pred GRANT
4. ✅ auth.uid() uporabljen interno (ne parametri)
5. ✅ Trigger zaščita kritičnih stolpcev prisotna
6. ✅ Mesečno zaklepanje implementirano
7. ✅ Revizijska sled nespremenljiva (trigger)
8. ✅ CASCADE samo za odvisne zapise

### ❌ NEPREVERJENO (zahteva izvršno testiranje):
1. ❌ RLS enforcement v živi bazi
2. ❌ Trigger izvajanje ob INSERT/UPDATE/DELETE
3. ❌ Transakcijski rollback pri napakah
4. ❌ Sočasni vnos (UNIQUE constraint handling)
5. ❌ Finančni obračuni pravilni
6. ❌ Prekrivanje urnikov/članstev zavrnjeno
7. ❌ Zaključena aktivnost resnično zaščitena
8. ❌ Neaktiven uporabnik res blokiran
9. ❌ Admin bootstrap varen
10. ❌ Backup šifriranje deluje

---

## Kar NI BILO MOGOČE VERIFICIRATI v Sandbox

❌ **Dejanski `supabase db reset`** - Potreben lokalni Supabase  
❌ **Izvajanje SQL testov** - Potreben PostgreSQL  
❌ **GitHub Actions CI run** - Potreben GitHub push  
❌ **Preverjanje migracijske poti od prazne baze** - Potrebna PostgreSQL  
❌ **RLS enforcement test** - Potrebna aktivna baza  
❌ **Trigger execution test** - Potrebna aktivna baza  
❌ **Transaction rollback test** - Potrebna aktivna baza  
❌ **Sočasni vnos test** - Potrebna aktivna baza  
❌ **Finančni obračun test** - Potrebna aktivna baza  
❌ **Backup restore test** - Potrebna AWS infrastruktura  

---

## Naslednji Koraki - Zahteva Izvajanje IZVEN Sandbox

### 1. Lokalno Testiranje (uporabnik)
```bash
# Kloniraj Softgen repozitorij
cd <projekt>

# Namesti Supabase CLI
npm install -g supabase

# Zaženi lokalni Supabase
supabase start

# Izvedi migracije
supabase db reset

# Zaženi integracijske teste
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/tests/integration/test_all.sql

# Zaženi RLS teste
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f supabase/tests/rls/test_rls_matrix.sql
```

### 2. GitHub CI Verifikacija (potreben push)
```bash
# Commit in push (v razvojno vejo)
git add .
git commit -m "feat(db): Phase A - Complete database schema, RLS, and tests"
git push origin develop

# GitHub Actions se samodejno zažene
# Spremljaj na: https://github.com/<uporabnik>/<repo>/actions
```

### 3. Preveri CI Rezultate
- [ ] Linting prehaja
- [ ] Type checking prehaja
- [ ] Migracije uspešne (supabase db reset)
- [ ] Integracijski testi vsi zeleni (7/7)
- [ ] RLS testi vsi zeleni (13/13)
- [ ] Build uspešen

---

## Kontrolne Vsote in Velikosti Datotek

### Migracije
```
supabase/migrations/20260101000000_create_schemas.sql           482 B
supabase/migrations/20260101000001_create_tables.sql         21.1 KB
supabase/migrations/20260101000002_create_internal_functions.sql  7.0 KB
supabase/migrations/20260101000003_create_rpc_functions.sql  15.8 KB
supabase/migrations/20260101000004_enable_rls.sql            20.9 KB
supabase/migrations/20260101000005_create_audit_triggers.sql  6.3 KB
supabase/migrations/20260101000006_create_indexes_and_guards.sql  9.8 KB
```

### Testi in Seed
```
supabase/seed.sql                                            11.2 KB
supabase/tests/integration/test_all.sql                      13.1 KB
supabase/tests/rls/test_rls_matrix.sql                        7.5 KB
```

### Konfiguracija
```
supabase/config.toml                                          5.8 KB
.env.example                                                  1.1 KB
.github/workflows/ci.yml                                      1.5 KB
README.md                                                     3.2 KB
.softgen/phase-a-verification.md                        (Ta dokument)
```

**SKUPNA VELIKOST:** ~124 KB izvorne kode

---

## Zaključek

**Status:** Faza A implementirana in statično pregledana  
**Varnost:** Statično potrjena, izvršno nepreverjeno  
**Pripravljenost:** Čaka na izvršno verifikacijo v uporabnikovem okolju

### Legenda Statusov:
- ✅ **STATIČNO PREVERJENO** - Sintaktična analiza potrjena
- ❌ **NI IZVEDEN** - Pripravljen test, nepognan
- ❌ **NI PRIPRAVLJEN** - Načrtovan test, nekodiran
- ⚠️ **NAČRTOVANO** - Funkcionalnost dokumentirana, neimplementirana

**Faza A NI PRIPRAVLJENA ZA PRODUKCIJO** - zahtevana izvršna verifikacija.