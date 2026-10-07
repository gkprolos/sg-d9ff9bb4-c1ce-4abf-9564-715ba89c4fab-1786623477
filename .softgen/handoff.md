# Klub - Project Handoff Document

**Datum:** 2026-10-07  
**Verzija:** v1.2  
**Status:** Production-ready z aktivno uporabo

---

## 🎯 Pregled Projekta

**Klub** je celovit sistem za upravljanje športnega kluba, namenjen trenerjem, administratorjem in staršem. Omogoča vodenje igralcev, prisotnosti, treningov, komunikacije, billing-a in klubske trgovine.

**Glavne funkcionalnosti:**
- Dashboard s statistiko in pregledi
- Upravljanje igralcev in ekip/selekcij
- Vnos prisotnosti na treningih in tekmah
- Terminski plan aktivnosti
- Komunikacija (messaging med trenerji in starši)
- Billing in finančno upravljanje
- Klubska trgovina (store)
- Poročila in statistike

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 15.5** (Page Router) - React framework
- **React 19.2** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 3.4** - Styling
- **shadcn/ui** - Component library
- **Lucide React** - Icons

### Backend & Database
- **Supabase** - Backend as a Service
  - PostgreSQL database
  - Row Level Security (RLS)
  - Authentication
  - Real-time subscriptions
  - Storage (if needed)
- **Edge Functions** - Serverless functions

### Additional Tools
- **PM2** - Process manager (ecosystem.config.js)
- **Vercel** - Deployment platform
- **Git** - Version control

---

## 📁 Struktura Projekta

```
├── .softgen/                    # Projektna dokumentacija
│   ├── technical-plan.md        # Glavni tehnični načrt
│   ├── technical-plan-v1.2-fixes.md  # Popravki in dopolnitve
│   ├── store-implementation-plan.md  # Plan za trgovino
│   └── handoff.md              # Ta dokument
│
├── supabase/
│   ├── config.toml             # Supabase konfiguracija
│   ├── migrations/             # Database migrations (100+ datotek)
│   └── seed.sql                # Initial data
│
├── src/
│   ├── components/
│   │   ├── layout/AppLayout.tsx    # Main layout z navigacijo
│   │   ├── ui/                     # shadcn/ui komponente (40+ datotek)
│   │   ├── SEO.tsx                 # SEO meta tags
│   │   └── ProtectedRoute.tsx      # Route protection
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx         # Authentication context
│   │   └── ThemeProvider.tsx       # Theme management
│   │
│   ├── hooks/
│   │   ├── use-mobile.tsx          # Mobile detection
│   │   └── use-toast.ts            # Toast notifications
│   │
│   ├── integrations/supabase/
│   │   ├── client.ts               # Supabase client
│   │   ├── database.types.ts       # Auto-generated types (2000+ vrstic)
│   │   └── types.ts                # Custom types
│   │
│   ├── lib/
│   │   ├── utils.ts                # Utility functions
│   │   ├── excelUtils.ts           # Excel export
│   │   └── emailService.ts         # Email notifications
│   │
│   ├── pages/
│   │   ├── _app.tsx                # App wrapper
│   │   ├── _document.tsx           # HTML document
│   │   ├── index.tsx               # Landing page
│   │   ├── dashboard.tsx           # Main dashboard (1983 vrstic)
│   │   ├── players.tsx             # Upravljanje igralcev
│   │   ├── teams.tsx               # Upravljanje ekip/selekcij
│   │   ├── attendance.tsx          # Vnos prisotnosti (950 vrstic)
│   │   ├── attendance/monthly.tsx  # Mesečni pregled prisotnosti
│   │   ├── activities.tsx          # Upravljanje aktivnosti/treningov
│   │   ├── schedules.tsx           # Terminski plan
│   │   ├── messaging.tsx           # Komunikacija (1619 vrstic)
│   │   ├── my-children.tsx         # Parent view - otroci
│   │   ├── my-players.tsx          # Coach view - igralci
│   │   ├── coaches.tsx             # Upravljanje trenerjev
│   │   ├── billing.tsx             # Billing in finance
│   │   ├── store.tsx               # Klubska trgovina (3400 vrstic)
│   │   ├── reports.tsx             # Poročila
│   │   ├── settings.tsx            # Nastavitve
│   │   ├── smtp-settings.tsx       # Email konfiguracija
│   │   └── api/                    # API routes
│   │       ├── auth/parent/        # Parent authentication
│   │       ├── parent/             # Parent API endpoints
│   │       ├── admin/              # Admin endpoints
│   │       └── messaging/          # Messaging webhooks
│   │
│   ├── services/
│   │   ├── authService.ts          # Authentication helpers
│   │   ├── seasonsService.ts       # Seasons management
│   │   ├── teamsService.ts         # Teams helpers
│   │   └── venuesService.ts        # Venues helpers
│   │
│   └── styles/
│       └── globals.css             # Global styles + Tailwind
│
├── public/                     # Static assets
├── package.json               # Dependencies
└── README.md                  # Project overview
```

---

## 🗄️ Database Schema

### Glavne Tabele

**Uporabniki in Avtentikacija:**
- `profiles` - Uporabniški profili (povezava z auth.users)
- `user_roles` - Vloge uporabnikov (admin, coach, parent)

**Športne Entitete:**
- `players` - Igralci (first_name, last_name, birth_date, gender, parent_id)
- `teams` - Ekipe/selekcije (name, category, season_id, head_coach_id)
- `team_players` - Povezava igralcev in ekip (many-to-many)
- `team_coaches` - Povezava trenerjev in ekip
- `seasons` - Sezone (name, start_date, end_date, is_active)
- `venues` - Lokacije/igrišča

**Aktivnosti in Prisotnost:**
- `activities` - Treningi/tekme (activity_date, team_id, venue_id, is_completed)
- `attendance_records` - Zapisi prisotnosti (player_id, activity_id, status: 0/1/2)
  - Status: 0 = odsoten, 1 = prisoten, 2 = opravičen
- `player_attendance_rates` - Izračunane stopnje prisotnosti

**Komunikacija:**
- `conversations` - Pogovori med trenerji in starši
- `conversation_messages` - Sporočila
- `conversation_participants` - Udeleženci v pogovorih

**Billing:**
- `billing_items` - Postavke za obračun
- `player_billing` - Obračuni za igralce
- `payments` - Plačila

**Store (Trgovina):**
- `store_categories` - Kategorije produktov
- `store_products` - Produkti
- `store_orders` - Naročila
- `store_order_items` - Postavke naročil

### RLS (Row Level Security)

**Vse tabele imajo RLS enabled** z policies za:
- Admini: polni dostop do vseh podatkov
- Trenerji: dostop do svojih ekip in igralcev
- Starši: dostop samo do svojih otrok in povezanih podatkov

**Pomembni RPC funkciji:**
- `complete_activity_with_rates` - Zaključi aktivnost in posodobi stopnje prisotnosti
- `update_player_attendance_rates` - Posodobi stopnje prisotnosti za igralca

---

## 🔑 Ključne Funkcionalnosti

### 1. Dashboard (`/dashboard`)
- Statistika po selekcijah (število igralcev, prisotnost)
- Pregled obiska po igralcih z filtri:
  - Iskanje po imenu/priimku
  - Filter po selekciji
  - Sortiranje po stolpcih (klik na header)
  - Toggle "Samo nizka prisotnost (<75%)"
- Statistika po trenerjih
- Filtriranje po mesecu in selekciji

### 2. Prisotnost (`/attendance`)
**Pomembno:** Sistem uporablja 3 statuse + null (brez zapisa):
- `null` - brez zapisa (prazno polje)
- `0` - odsoten
- `1` - prisoten
- `2` - opravičen

**Funkcionalnosti:**
- Vnos prisotnosti: text input s številkami 0/1/2, prazen string briše zapis
- "Počisti vse" - EN delete query za vse zapise aktivnosti
- "Vse označi kot prisotne" - bulk upsert vseh igralcev s statusom 1
- "Shrani in zaključi" - confirmation dialog za igralce brez zapisa (označeni kot odsotni)

### 3. Messaging (`/messaging`)
- Pogovori med trenerji in starši
- Real-time updates (če implementirano)
- Obvestila o novih sporočilih
- API endpoints za starše

### 4. Store (`/store.tsx`)
- Kategorije in produkti
- Naročila
- Admin panel za upravljanje

### 5. Parent Portal
- `/login/parent` - OTP login za starše
- `/my-children` - Pregled otrok in njihove prisotnosti
- API endpoints v `/api/parent/`

---

## 📝 Nedavne Spremembe (Zadnjih 10 Commitov)

```
1. fix(dashboard): change showLowAttendanceOnly default to false
   - Inicializacija spremenjena iz true na false

2. fix(attendance): improve attendance record handling
   - handleAttendanceChange: DELETE za null, upsert za 0/1/2
   - onChange: podpora za prazno polje (null)
   - "Počisti vse": EN delete query
   - "Vse označi kot prisotne": bulk upsert
   - handleCompleteAttendance: confirmation za igralce brez zapisa

3. fix(dashboard): remove confusing additional team filter
   - Odstranjen dodaten team filter iz player attendance

4. Revert to state at 78940b629da3a25e7e2cba96632e03c313fabf3d
   - Rollback na stabilno stanje

5. debug(dashboard): add comprehensive logging to trace team filter issue
   - Debug logiranje za troubleshooting

6-10. Različni bugfixi in izboljšave za dashboard attendance display
```

---

## 🎨 Pomembne Konvencije

### Code Style
- **Jezik:** Slovenščina za UI, variable names, comments
- **TypeScript strict mode**
- **ESLint** configured
- **Functional components** z hooks (ne class components)

### Database Queries
- Uporabljaj Supabase client iz `@/integrations/supabase/client`
- Vedno preveri RLS policies
- Bulk operations namesto forEach loops
- Error handling z try/catch + toast notifications

### State Management
- React useState/useContext
- AuthContext za globalno auth state
- Lokalni state v komponentah

### Styling
- Tailwind utility classes
- shadcn/ui komponente
- Responsive design (mobile-first)
- Dark mode podpora (ThemeProvider)

### Error Handling
```typescript
try {
  // Database operation
  const { data, error } = await supabase...
  if (error) throw error;
  
  // Success toast
  toast({ title: "Uspešno" });
} catch (error: any) {
  console.error("Napaka:", error);
  toast({
    variant: "destructive",
    title: "Napaka",
    description: error.message
  });
}
```

### Authentication
- Supabase Auth
- Role-based access (admin/coach/parent)
- ProtectedRoute komponenta
- Parent OTP login flow

---

## 🚀 Setup Navodila

### 1. Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_password
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
```bash
# Če uporabljaš lokalni Supabase
supabase start
supabase db reset

# Ali aplikraj migracije na produkcijski Supabase
supabase db push
```

### 4. Generate Types
```bash
# Po spremembah v database schema
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/database.types.ts
```

### 5. Run Development Server
```bash
npm run dev
# Ali z PM2
pm2 start ecosystem.config.js
```

---

## 🐛 Known Issues & Gotchas

### 1. Dashboard Attendance Display
- Dashboard agregira podatke po IGRALCU (ne po igralcu+selekcija)
- Mora uporabljati isti query pattern kot `/attendance/monthly.tsx`
- DATE format (ne TIMESTAMP) za date range filtering
- Brez season filtra (razen če eksplicitno zahtevan)

### 2. Attendance Records
- `null` status pomeni "brez zapisa" - IZBRIŠI iz baze
- Ne uporabljaj `status: 0` za "ni vnosa" - uporabi DELETE
- Bulk operations za boljšo performance

### 3. Large Files
Nekatere datoteke so zelo velike in bi jih bilo dobro razbiti:
- `dashboard.tsx` (1983 vrstic)
- `messaging.tsx` (1619 vrstic)
- `store.tsx` (3400 vrstic)
- `players.tsx` (1183 vrstic)

### 4. TypeScript Types
- `database.types.ts` je auto-generated - NE urejaj ročno
- Re-generiraj po vsaki spremembi schema

### 5. RLS Debugging
- Če query vrne prazen array brez errora → preveri RLS policies
- Admin bypass: uporabi service role key (samo server-side!)

---

## 📞 Contact & Support

**Git Repository:** [povezava do repoja]  
**Supabase Project:** [povezava do projekta]  
**Vercel Deployment:** [povezava do deployementa]

**Dokumentacija:**
- `.softgen/technical-plan.md` - Podroben tehnični načrt
- `.softgen/technical-plan-v1.2-fixes.md` - Spremembe in popravki
- `README.md` - Osnovne informacije

---

## 🎯 Priporočila za Nadaljevanje

### Short-term (1-2 tedna)
1. Razbiti velike datoteke (dashboard, messaging, store)
2. Dodati unit tests za kritične funkcije
3. Optimizirati database queries (indexing)
4. Code review in cleanup

### Medium-term (1-2 meseca)
1. Implementirati real-time updates (Supabase Realtime)
2. Izboljšati mobile UX
3. Dodati analytics in tracking
4. Performance optimizacija

### Long-term (3+ meseci)
1. PWA support
2. Offline mode
3. Advanced reporting
4. Multi-language support

---

## 🔍 Debugging Tips

### Check Database Schema
```sql
-- V Supabase SQL Editor
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public';
```

### Check RLS Policies
```sql
SELECT * FROM pg_policies 
WHERE schemaname = 'public';
```

### Console Logging
Dashboard ima debug logging - odpri browser console in poišči:
```
=== DASHBOARD ATTENDANCE DEBUG ===
```

### Common Errors
- **PGRST116**: Query vrnil 0 vrstic pri `.single()` → uporabi `.maybeSingle()`
- **42501**: Permission denied → preveri RLS policies
- **23503**: Foreign key violation → preveri da parent record obstaja

---

**Dokument pripravljen:** 2026-10-07  
**Verzija:** 1.0  
**Avtor:** Softgen AI Assistant

Za dodatna vprašanja ali pojasnila preglejte projektno dokumentacijo v `.softgen/` direktoriju.