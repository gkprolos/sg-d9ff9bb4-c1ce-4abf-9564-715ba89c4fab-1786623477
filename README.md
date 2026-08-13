# Športni Klub Aplikacija

Celovita spletna aplikacija za upravljanje športnega kluba v slovenskem jeziku.

## Tehnologije

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Row Level Security)
- **UI**: shadcn/ui komponente
- **CI/CD**: GitHub Actions

## Lokalni Razvoj

### Predpogoji

- Node.js 20+
- npm
- Supabase CLI (`npm install -g supabase`)

### Namestitev

```bash
# Kloniraj repozitorij
git clone <repo-url>
cd sportni-klub

# Namesti odvisnosti
npm install

# Zaženi Supabase lokalno
supabase start

# Migracije se samodejno izvedejo
# Če želite ročno reset:
supabase db reset

# Zaženi razvojni strežnik
npm run dev
```

Aplikacija teče na `http://localhost:3000`

### Testiranje

```bash
# Integracijski testi
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/tests/integration/test_all.sql

# RLS testi
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/tests/rls/test_rls_matrix.sql

# TypeScript type check
npm run type-check

# Linting
npm run lint

# Build test
npm run build
```

## Struktura Projekta

```
├── src/
│   ├── app/              # Next.js App Router strani
│   ├── components/       # React komponente
│   └── lib/              # Utility funkcije
├── supabase/
│   ├── migrations/       # SQL migracije (vrstni red pomemben)
│   ├── seed.sql          # Testni podatki
│   └── tests/            # SQL testi
├── .github/
│   └── workflows/        # CI pipeline
└── public/               # Statične datoteke
```

## Migracije

Migracije se izvajajo v striktnem vrstnem redu:

1. `20260101000000_create_schemas.sql` - Sheme
2. `20260101000001_create_tables.sql` - Tabele
3. `20260101000002_create_internal_functions.sql` - Interne funkcije
4. `20260101000003_create_rpc_functions.sql` - RPC funkcije
5. `20260101000004_enable_rls.sql` - Row Level Security
6. `20260101000005_create_audit_triggers.sql` - Revizijska sled
7. `20260101000006_create_indexes_and_guards.sql` - Indeksi in zaščita

## Varnost

- Vsi `SECURITY DEFINER` funkcije uporabljajo `SET search_path = ''`
- RLS omogočen na vseh tabelah
- Revizijska sled nespremenljiva
- Zaščita finančnih podatkov
- Mesečno zaklepanje v podatkovni zbirki

## Dovoljenja (RLS)

| Tabela | Admin | Coach | Guest |
|--------|-------|-------|-------|
| teams | Vse | Samo dodeljene | Nič |
| players | Vse | Samo igralci dodeljenih selekcij | Nič |
| coach_rates | Vse | Samo svoje | Nič |
| activities | Vse | Samo aktivnosti dodeljenih selekcij | Nič |
| attendance_records | Vse | Samo aktivnosti dodeljenih selekcij | Nič |

## Produkcija

### Prvi Administrator

Prvega administratorja NE ustvarite prek aplikacije. Uporabite Supabase Dashboard:

1. Odpri Supabase Dashboard → SQL Editor
2. Izvedi:
```sql
-- Najdi UUID uporabnika
SELECT id FROM auth.users WHERE email = 'admin@vasklub.si';

-- Dodaj vlogo admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('<UUID_iz_prejsnjega_SELECT>', 'admin');
```

### Varnostne Kopije

Nastavite tedensko šifrirano backup (AWS S3 + GPG encryption). Glej `.github/workflows/backup.yml`.

## Podpora

Za vprašanja kontaktirajte tehnično ekipo.

## Licenca

Zaprta koda - last športnega kluba.