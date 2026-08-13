# Faza A – Verifikacijski Rapport

**Status:** Implementirano v Softgen sandbox, čaka na GitHub CI verifikacijo  
**Datum:** 2026-08-13

## Omejitve Softgen Sandbox Okolja

Softgen sandbox NE omogoča:
- Git commit in push v uporabnikov GitHub repozitorij
- Izvajanje GitHub Actions CI
- Namestitve Supabase CLI
- Izvajanja PostgreSQL in SQL testov

**Vse migracije, testi in konfiguracija so pripravljeni, vendar niso bili izvršno testirani.**

---

## Ustvarjene Datoteke

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
- `supabase/seed.sql` (195 vrstic) - Sintetični testni podatki
- `supabase/tests/integration/test_all.sql` (300 vrstic) - Integracijski testi
- `supabase/tests/rls/test_rls_matrix.sql` (180 vrstic) - RLS testna matrika

**Skupaj:** 675 vrstic testnega SQL kode

### CI/CD in Dokumentacija
- `.github/workflows/ci.yml` (53 vrstic) - GitHub Actions pipeline
- `README.md` (134 vrstic) - Dokumentacija

**SKUPNA STATISTIKA:** 3220 vrstic kode in dokumentacije

---

## Sintaktična Analiza (izvršeno v sandbox)

### ✅ RLS Politike (brez OLD/NEW)
- **Datoteka:** `20260101000004_enable_rls.sql`
- **Preverba:** `grep -rn "OLD\." + "NEW\."`
- **Rezultat:** 0 zadetkov v RLS politikah
- **Status:** ✅ PRAVILNO - RLS ne uporablja OLD/NEW

### ✅ SECURITY DEFINER funkcije
- **Datoteke:** migrations 002, 003, 006
- **Preverba:** `grep "SET search_path = ''"`
- **Rezultat:** Vseh 16 SECURITY DEFINER funkcij uporablja prazen search_path
- **Status:** ✅ PRAVILNO - Varne funkcije

### ✅ OLD/NEW v Trigger Funkcijah
- **Datoteka:** `20260101000006_create_indexes_and_guards.sql`
- **Lokacija:** Trigger funkcije (prevent_*_column_changes)
- **Status:** ✅ PRAVILNO - OLD/NEW uporabljen samo v TRIGGER funkcijah, ne v RLS

---

## Implementirane Varnostne Zaščite

### 1. Zaščita Kritičnih Stolpcev (Trigger-based)
- `prevent_activity_coaches_column_changes` - preprečuje:
  - Spreminjanje activity_id, coach_id
  - Spreminjanje vloge (razen admin)
  - Spreminjanje finančnih snapshots (razen admin)
  
- `prevent_attendance_column_changes` - preprečuje:
  - Spreminjanje activity_id, player_id
  - Spreminjanje recorded_by, created_at
  
- `prevent_activity_column_changes` - preprečuje:
  - Spreminjanje season_id, team_id, created_by, created_at
  - Spreminjanje datuma (razen admin)

### 2. Zaščita Prekrivanj
- `prevent_overlapping_schedules` - preprečuje prekrivanje urnikov
- `prevent_overlapping_memberships` - preprečuje prekrivanje članstev

### 3. Revizijska Sled
- `prevent_audit_modification` - blokira UPDATE in DELETE na audit_log
- Kompletni audit triggerji za vse tabele

### 4. Mesečno Zaklepanje
- `prevent_locked_month_changes` - preveri zaklenjen mesec pred UPDATE/DELETE
- Implementirano za activities, activity_coaches, attendance_records

---

## RPC Funkcije

### `create_or_open_activity`
**Vhod:**
- `p_team_id UUID`
- `p_activity_date DATE`
- `p_activity_type INTEGER`
- `p_venue_id UUID` (optional)
- `p_custom_venue TEXT` (optional)
- `p_start_time TIME`
- `p_end_time TIME`
- `p_is_home_game BOOLEAN` (optional)

**Varnostne preverbe:**
- Identiteta iz `auth.uid()` (NE parametrov)
- Trener mora biti aktiven
- Selekcija ne sme biti arhivirana
- Sezona ne sme biti arhivirana
- Datum znotraj sezone
- Mesec ne sme biti zaklenjen
- Trener mora biti dodeljen selekciji

**Funkcionalnost:**
- Atomska transakcija (UNIQUE constraint handling)
- Ustvari novo aktivnost ALI odpre obstoječo
- Doda trenerja kot glavnega (če lahko) ALI sotrenerja
- Uporabi urnik, če obstaja

### `complete_activity_with_rates`
**Vhod:**
- `p_activity_id UUID`

**Varnostne preverbe:**
- Klicatelj je glavni trener ALI admin
- Aktivnost ni že zaključena
- Glavni trener mora obstajati
- Prisotnost popolna (vsi igralci)
- Vsi trenerji imajo ceniki

**Funkcionalnost:**
- Izračuna obračune za vse trenerje
- Shrani snapshote postavk
- Označi aktivnost kot zaključeno
- Transakcijski rollback ob napaki

---

## RLS Matrika (Načrtovana)

| Tabela | Admin | Coach | Guest |
|--------|-------|-------|-------|
| profiles | ALL | Samo svoj profil | Nič |
| user_roles | ALL | READ samo svoj | Nič |
| seasons | ALL | READ aktivne | Nič |
| teams | ALL | READ dodeljene | Nič |
| players | ALL | READ igralci dodeljenih selekcij | Nič |
| team_players | ALL | READ za dodeljene selekcije | Nič |
| team_coaches | ALL | READ za dodeljene selekcije | Nič |
| activities | ALL | CRUD dodeljene selekcije | Nič |
| activity_coaches | ALL | UPDATE samo svoje kilometre | Nič |
| attendance_records | ALL | CRUD za dodeljene selekcije | Nič |
| coach_rates | ALL | READ samo svoje | Nič |
| schedule_templates | ALL | READ za dodeljene selekcije | Nič |
| venues | ALL | READ vse | Nič |
| audit_log | READ | Nič | Nič |

---

## Testni Načrt (Pripravljen, ni izveden)

### Integracijski Testi (test_all.sql)
1. ✓ create_or_open_activity - Nova aktivnost (glavni trener)
2. ✓ create_or_open_activity - Obstoječa aktivnost (dodaj sotrenerja)
3. ✓ Prepreči nepooblaščenega trenerja
4. ✓ complete_activity_with_rates - Obračun
5. ✓ Prepreči spreminjanje zaključene aktivnosti
6. ✓ Prepreči spreminjanje finančnih snapshots
7. ✓ Revizijska sled nespremenljiva

**Skupaj:** 7 integracija testov

### RLS Testi (test_rls_matrix.sql)
**Admin:**
1. ✓ Vidi vse selekcije
2. ✓ Vidi vse trenerje
3. ✓ Vidi vse igralce
4. ✓ Vidi vse cenike

**Trener 1:**
5. ✓ Vidi samo svojo selekcijo
6. ✓ Vidi igralce samo svoje selekcije
7. ✓ Vidi samo svoj cenik
8. ✓ NE vidi cenikov drugih

**Trener 2:**
9. ✓ Vidi samo svojo selekcijo
10. ✓ NE vidi igralcev drugih selekcij

**Guest:**
11. ✓ NE vidi selekcij
12. ✓ NE vidi igralcev
13. ✓ NE vidi cenikov

**Skupaj:** 13 RLS testov

**SKUPNO TESTOV:** 20 testov pripravljenih

---

## Naslednji Koraki (Zahteva izvajanje IZVEN sandbox)

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
- ✓ Linting prehaja
- ✓ Type checking prehaja
- ✓ Migracije uspešne
- ✓ Integracijski testi vsi zeleni
- ✓ RLS testi vsi zeleni
- ✓ Build uspešen

---

## Kar NI BILO MOGOČE VERIFICIRATI v Sandbox

❌ **Dejanski `supabase db reset`** - Potreben lokalni Supabase  
❌ **Izvajanje SQL testov** - Potreben PostgreSQL  
❌ **GitHub Actions CI run** - Potreben GitHub push  
❌ **Preverjanje migracijske poti od prazne baze** - Potrebna PostgreSQL  
❌ **RLS enforcement test** - Potrebna aktivna baza  
❌ **Trigger execution test** - Potrebna aktivna baza  
❌ **Transaction rollback test** - Potrebna aktivna baza  

---

## Potrjene Sintaktične Lastnosti

✅ **RLS politike:** 0 OLD/NEW referenc (potrjeno z grep)  
✅ **SECURITY DEFINER:** 16 funkcij, vse z `SET search_path = ''`  
✅ **Trigger funkcije:** OLD/NEW pravilno uporabljene samo v triggerjih  
✅ **Konsistentna imena:** Pregledano in usklajeno  
✅ **ISODOW:** Uporabljen za dneve (1=pon, 7=ned)  
✅ **Varne transakcije:** Vse RPC funkcije so transakcijske  

---

## Zaključek

**Faza A je IMPLEMENTIRANA kot izvršljiva SQL koda, vendar NI BILA IZVRŠNO TESTIRANA zaradi omejitev Softgen sandbox okolja.**

Za dokončno verifikacijo je potrebno:
1. Uporabnik zažene lokalni Supabase
2. Uporabnik izvede SQL teste
3. Uporabnik pushne v GitHub
4. GitHub Actions CI avtomatsko verificira

**Status:** Čaka na izvršno verifikacijo v uporabnikovem okolju.