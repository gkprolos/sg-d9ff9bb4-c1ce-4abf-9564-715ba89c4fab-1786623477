# NAČRT IMPLEMENTACIJE: TRGOVINA Z OPREMO (STORE)

**Datum:** 17.9.2026  
**Status:** Čaka na potrditev  
**Verzija:** 1.0

---

## 1. POSLOVNE ZAHTEVE - POVZETEK

### 1.1 Cilj
Dodati modul trgovine za naročanje športne opreme, dostopen vsem vlogam (Admin, Trener, Starš), vsaka z različnimi pravicami.

### 1.2 Uporabniške Vloge in Pravice

| Vloga | Pravice |
|-------|---------|
| **Administrator** | - CRUD artiklov<br>- Pregled vseh naročil<br>- Označevanje "Naročeno dobavitelju"<br>- Označevanje "Račun izdelan"<br>- Označevanje "Zaključeno" (predano)<br>- Pregled zbirnikov |
| **Trener** | - CRUD artiklov<br>- Pregled vseh naročil<br>- Označevanje "Naročeno dobavitelju"<br>- Označevanje "Zaključeno" (predano)<br>- Pregled zbirnikov |
| **Starš** | - Pregled artiklov<br>- Oddaja naročila<br>- Preklic odprtega naročila<br>- Pregled svojih naročil in statusov |

### 1.3 Ključne Funkcionalnosti

**Artikel:**
- Številka artikla (unikatna)
- Naziv
- Opis
- Možne velikosti (checkboxy): 11/12, 13/14, XXS, XS, S, M, L, XL, XXL, 3XL
- Cena (EUR)
- Slika 2×3 cm (lahko se poveča ob kliku)
- Povezava (odpre v novem tabu)
- Status (aktiven/neaktiven)

**Naročilo:**
- Starš odda naročilo za več artiklov + velikosti + količine
- Vsota se avtomatsko izračuna
- Preklic možen samo dokler je "Odprto"
- Statusi: Odprto → Naročeno dobavitelju → Predano → Račun izdelan

**Zbirnik Naročil:**
- Avtomatsko 1. in 15. v mesecu
- Admin/Trener označita "Naročeno dobavitelju" + datum
- Admin/Trener označita "Zaključeno" (predano) + datum
- Admin označi "Račun izdelan"

---

## 2. PODATKOVNI MODEL

### 2.1 Nove Tabele

#### `store_items` (Artikli)
```sql
CREATE TABLE store_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_number VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- "Dresi", "Kopački", "Oprema", etc.
  available_sizes JSONB NOT NULL DEFAULT '[]', -- ["S", "M", "L", "XL"]
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  quantity_in_stock INTEGER NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
  low_stock_threshold INTEGER DEFAULT 5,
  image_url TEXT, -- Pot do slike v Supabase Storage
  external_link TEXT, -- Povezava do artikla
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_store_items_active ON store_items(is_active);
CREATE INDEX idx_store_items_number ON store_items(item_number);
CREATE INDEX idx_store_items_category ON store_items(category);
CREATE INDEX idx_store_items_name ON store_items(name); -- For search
```

#### `store_orders` (Naročila)
```sql
CREATE TABLE store_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) NOT NULL UNIQUE, -- Format: ORD-2026-0001
  parent_id UUID NOT NULL REFERENCES auth.users(id),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, ordered, delivered, invoiced
  ordered_at TIMESTAMPTZ, -- Kdaj naročeno dobavitelju
  ordered_by UUID REFERENCES auth.users(id),
  delivered_at TIMESTAMPTZ, -- Kdaj predano staršu
  delivered_by UUID REFERENCES auth.users(id),
  invoiced_at TIMESTAMPTZ, -- Kdaj izdani račun
  invoiced_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMPTZ, -- Če preklic
  cancelled_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('open', 'ordered', 'delivered', 'invoiced', 'cancelled'))
);

CREATE INDEX idx_store_orders_parent ON store_orders(parent_id);
CREATE INDEX idx_store_orders_status ON store_orders(status);
CREATE INDEX idx_store_orders_created ON store_orders(created_at);
```

#### `store_order_items` (Postavke Naročila)
```sql
CREATE TABLE store_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES store_items(id),
  item_name VARCHAR(200) NOT NULL, -- Snapshot naziva
  item_number VARCHAR(50) NOT NULL, -- Snapshot številke
  size VARCHAR(10) NOT NULL, -- "M", "XL", "13/14" itd.
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_store_order_items_order ON store_order_items(order_id);
CREATE INDEX idx_store_order_items_item ON store_order_items(item_id);
```

#### `store_collection_periods` (Zbirniki Naročil)
```sql
CREATE TABLE store_collection_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_date DATE NOT NULL UNIQUE, -- 1.1.2026, 15.1.2026, 1.2.2026, 15.2.2026
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, ordered, closed
  ordered_at TIMESTAMPTZ,
  ordered_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_collection_status CHECK (status IN ('open', 'ordered', 'closed'))
);

CREATE INDEX idx_store_collection_periods_date ON store_collection_periods(period_date);
CREATE INDEX idx_store_collection_periods_status ON store_collection_periods(status);
```

### 2.2 Trigger: Avtomatsko Ustvarjanje Zbirnikov

```sql
-- Funkcija: ustvari zbirnike za 1. in 15. v mesecu (3 mesece vnaprej)
CREATE OR REPLACE FUNCTION create_collection_periods()
RETURNS void AS $$
DECLARE
  current_month DATE;
  period_1st DATE;
  period_15th DATE;
  i INTEGER;
BEGIN
  current_month := DATE_TRUNC('month', CURRENT_DATE);
  
  FOR i IN 0..2 LOOP
    period_1st := (current_month + (i || ' months')::INTERVAL)::DATE;
    period_15th := (current_month + (i || ' months')::INTERVAL + INTERVAL '14 days')::DATE;
    
    INSERT INTO store_collection_periods (period_date)
    VALUES (period_1st), (period_15th)
    ON CONFLICT (period_date) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger: preveri ob vsakem naročilu in ustvari zbirnike če ne obstajajo
CREATE OR REPLACE FUNCTION ensure_collection_periods()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_collection_periods();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_collection_periods
  BEFORE INSERT ON store_orders
  FOR EACH STATEMENT
  EXECUTE FUNCTION ensure_collection_periods();
```

### 2.3 Funkcija: Avtomatski Order Number

```sql
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  sequence_num INTEGER;
  new_number TEXT;
BEGIN
  year_part := TO_CHAR(NEW.created_at, 'YYYY');
  
  -- Najdi največjo zaporedno številko za leto
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM 'ORD-' || year_part || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM store_orders
  WHERE order_number LIKE 'ORD-' || year_part || '-%';
  
  new_number := 'ORD-' || year_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
  NEW.order_number := new_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_order_number
  BEFORE INSERT ON store_orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_order_number();
```

---

## 3. ROW LEVEL SECURITY (RLS) POLICIES

### 3.1 `store_items`

```sql
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;

-- Admin & Coach: CRUD
CREATE POLICY store_items_admin_all ON store_items
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
    )
  );

-- Parents: READ only active items
CREATE POLICY store_items_parent_read ON store_items
  FOR SELECT
  USING (
    is_active = true
    AND auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'parent'
    )
  );
```

### 3.2 `store_orders`

```sql
ALTER TABLE store_orders ENABLE ROW LEVEL SECURITY;

-- Admin & Coach: READ all orders
CREATE POLICY store_orders_admin_read ON store_orders
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
    )
  );

-- Admin & Coach: UPDATE orders (statusi)
CREATE POLICY store_orders_admin_update ON store_orders
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
    )
  );

-- Parents: CREATE own orders
CREATE POLICY store_orders_parent_insert ON store_orders
  FOR INSERT
  WITH CHECK (
    parent_id = auth.uid()
    AND auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'parent'
    )
  );

-- Parents: READ own orders
CREATE POLICY store_orders_parent_read ON store_orders
  FOR SELECT
  USING (
    parent_id = auth.uid()
    AND auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'parent'
    )
  );

-- Parents: UPDATE own orders (only if status = 'open')
CREATE POLICY store_orders_parent_update ON store_orders
  FOR UPDATE
  USING (
    parent_id = auth.uid()
    AND status = 'open'
    AND auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'parent'
    )
  );
```

### 3.3 `store_order_items`

```sql
ALTER TABLE store_order_items ENABLE ROW LEVEL SECURITY;

-- Admin & Coach: READ all
CREATE POLICY store_order_items_admin_read ON store_order_items
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
    )
  );

-- Parents: CRUD own order items (through order ownership)
CREATE POLICY store_order_items_parent_all ON store_order_items
  FOR ALL
  USING (
    order_id IN (
      SELECT id FROM store_orders WHERE parent_id = auth.uid()
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM store_orders WHERE parent_id = auth.uid() AND status = 'open'
    )
  );
```

### 3.4 `store_collection_periods`

```sql
ALTER TABLE store_collection_periods ENABLE ROW LEVEL SECURITY;

-- Admin & Coach: CRUD
CREATE POLICY store_collection_periods_admin_all ON store_collection_periods
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
    )
  );

-- Parents: READ only
CREATE POLICY store_collection_periods_parent_read ON store_collection_periods
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles WHERE role = 'parent'
    )
  );
```

---

## 4. SUPABASE STORAGE BUCKET

```sql
-- Bucket za slike artiklov
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-items', 'store-items', true);

-- RLS policy: Admin & Coach lahko upload
CREATE POLICY "Admin and Coach can upload store images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'store-items'
  AND auth.uid() IN (
    SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
  )
);

-- RLS policy: Vsi lahko read public slike
CREATE POLICY "Public read for store images"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-items');
```

---

## 5. UI NAČRT - WIREFRAMES

### 5.1 Navigacija (Vsi Uporabniki)

```
AppLayout Sidebar:
  ...
  📬 Sporočila
  🛒 Oprema  ← NOV GUMB (za vse vloge)
  ...
```

### 5.2 Admin/Trener: `/store` (Manage Oprema)

**Tabs:**
- **Artikli** - CRUD
- **Naročila** - Pregled vseh naročil
- **Zbirniki** - Pregled po obdobjih (1. in 15.)

**Tab: Artikli**
```
┌─────────────────────────────────────────────────────────────┐
│ [+ Dodaj Artikel]                                [🔍 Search] │
├─────────────────────────────────────────────────────────────┤
│ Št.  │ Slika │ Naziv       │ Velikosti  │ Cena  │ Status │ │
│ 001  │ [img] │ Dres domač  │ S,M,L,XL   │ 45.00 │ ✓     │ │
│ 002  │ [img] │ Dres gost   │ S,M,L,XL   │ 45.00 │ ✓     │ │
│ 003  │ [img] │ Kopački     │ 11/12,13/14│ 65.00 │ ✓     │ │
│ ...  │       │             │            │       │       │ │
└─────────────────────────────────────────────────────────────┘
```

**Tab: Naročila**
```
┌─────────────────────────────────────────────────────────────┐
│ Filter: [Odprto ▼] [Starš ▼] [Datum od-do]                  │
├─────────────────────────────────────────────────────────────┤
│ ORD-2026-0001 │ Ana Novak    │ 15.8.2026 │ 135.00 │ Odprto│
│ ORD-2026-0002 │ Marko Kovač  │ 16.8.2026 │  65.00 │ Odprto│
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘

[Klik na naročilo]
┌─────────────────────────────────────────────────────────────┐
│ Naročilo: ORD-2026-0001                                      │
│ Starš: Ana Novak (ana@example.com)                          │
│ Datum: 15.8.2026 12:34                                       │
│                                                              │
│ Artikel        │ Velikost │ Količina │ Cena  │ Znesek      │
│ Dres domač     │ M        │ 2        │ 45.00 │  90.00      │
│ Kopački        │ 11/12    │ 1        │ 65.00 │  65.00      │
│                                        SKUPAJ:   155.00      │
│                                                              │
│ Status: Odprto                                               │
│ [✓ Naročeno dobavitelju] [✓ Predano] [✓ Račun izdelan]     │
│                                                              │
│ Opombe: _____________________________________________        │
│ [Shrani]                                                     │
└─────────────────────────────────────────────────────────────┘
```

**Tab: Zbirniki**
```
┌─────────────────────────────────────────────────────────────┐
│ Obdobje       │ Št. Naročil │ Znesek   │ Status             │
│ 1.8.2026      │ 12          │ 1,245.00 │ [✓ Naročeno 3.8.]  │
│ 15.8.2026     │ 8           │   890.00 │ Odprto             │
│ 1.9.2026      │ 0           │     0.00 │ Odprto             │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘

[Klik na zbirnik]
┌─────────────────────────────────────────────────────────────┐
│ Zbirnik: 1.8.2026                                            │
│ Status: Naročeno dobavitelju (3.8.2026)                     │
│                                                              │
│ Starš          │ Naročilo      │ Artikli │ Znesek │ Predano│
│ Ana Novak      │ ORD-2026-0001 │ 3       │ 155.00 │ ✓ 5.8. │
│ Marko Kovač    │ ORD-2026-0002 │ 1       │  65.00 │ -      │
│ ...                                                          │
│                                          SKUPAJ:   1,245.00  │
│                                                              │
│ [✓ Naročeno dobavitelju]  Datum: [______]                   │
│ [Zapri Zbirnik]                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Starš: `/store` (Naročanje Opreme)

**Tabs:**
- **Oprema** - Seznam artiklov za naročanje
- **Moja Naročila** - Zgodovina in status

**Tab: Oprema**
```
┌─────────────────────────────────────────────────────────────┐
│ [🔍 Išči...]                                [🛒 Košarica: 2] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Slika 2x3]  Dres domači                                │ │
│ │              Opis: Uradni domači dres kluba...          │ │
│ │              Velikosti: □ S  ☑ M  □ L  □ XL             │ │
│ │              Cena: 45,00 EUR                            │ │
│ │              [🔗 Odpri povezavo]                         │ │
│ │              Količina: [2] [+ Dodaj v košarico]         │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Slika 2x3]  Kopački                                    │ │
│ │              ...                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

[Košarica Modal]
┌─────────────────────────────────────────────────────────────┐
│ Košarica                                              [✕]    │
├─────────────────────────────────────────────────────────────┤
│ Dres domači (M) × 2                        90,00 EUR  [✕]   │
│ Kopački (11/12) × 1                        65,00 EUR  [✕]   │
│                                                              │
│                                  SKUPAJ:  155,00 EUR         │
│                                                              │
│ [Oddaj Naročilo] [Prekliči]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Tab: Moja Naročila**
```
┌─────────────────────────────────────────────────────────────┐
│ Naročilo       │ Datum       │ Znesek   │ Status    │       │
│ ORD-2026-0001  │ 15.8.2026   │ 155,00 € │ Odprto    │[Preklič]│
│ ORD-2026-0002  │ 1.8.2026    │  65,00 € │ Predano   │       │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘

[Klik na naročilo]
┌─────────────────────────────────────────────────────────────┐
│ Naročilo: ORD-2026-0001                                      │
│ Datum: 15.8.2026 12:34                                       │
│                                                              │
│ Artikel        │ Velikost │ Količina │ Cena  │ Znesek      │
│ Dres domač     │ M        │ 2        │ 45.00 │  90.00      │
│ Kopački        │ 11/12    │ 1        │ 65.00 │  65.00      │
│                                        SKUPAJ:   155.00      │
│                                                              │
│ Status Timeline:                                             │
│ ✓ Oddano: 15.8.2026 12:34                                   │
│ ⏳ Naročeno dobavitelju: -                                   │
│ ⏳ Predano: -                                                │
│ ⏳ Račun izdelan: -                                          │
│                                                              │
│ [Prekliči Naročilo] (samo če status = Odprto)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. WORKFLOW DIAGRAM

```
┌─────────────┐
│   STARŠ     │
│ odda        │
│ naročilo    │
└──────┬──────┘
       │
       v
┌─────────────────────────────────────┐
│ Status: ODPRTO                      │
│ - Starš lahko prekliče              │
│ - Vključeno v naslednji zbirnik     │
│   (1. ali 15. v mesecu)             │
└──────┬──────────────────────────────┘
       │
       │ (1. ali 15. v mesecu)
       v
┌─────────────────────────────────────┐
│ ZBIRNIK NAROČIL                     │
│ - Admin/Trener vidi vsa naročila    │
│ - Označita "Naročeno dobavitelju"   │
│   + datum naročila                  │
└──────┬──────────────────────────────┘
       │
       v
┌─────────────────────────────────────┐
│ Status: NAROČENO DOBAVITELJU        │
│ - Starš NE more več preklicati      │
│ - Čakanje na dobavo                 │
└──────┬──────────────────────────────┘
       │
       │ (ko pride blago)
       v
┌─────────────────────────────────────┐
│ Admin/Trener označita:              │
│ - "Predano" + datum predaje         │
└──────┬──────────────────────────────┘
       │
       v
┌─────────────────────────────────────┐
│ Status: PREDANO                     │
│ - Starš vidi da je prevzel blago    │
└──────┬──────────────────────────────┘
       │
       │ (admin izdela račun)
       v
┌─────────────────────────────────────┐
│ Admin označi "Račun izdelan"        │
└──────┬──────────────────────────────┘
       │
       v
┌─────────────────────────────────────┐
│ Status: RAČUN IZDELAN               │
│ - Končno stanje                     │
└─────────────────────────────────────┘
```

---

## 7. FAZE IMPLEMENTACIJE

### FAZA 1: Podatkovna Osnova (1-2h)
- [ ] Ustvari tabele `store_items`, `store_orders`, `store_order_items`, `store_collection_periods`
- [ ] Implementiraj triggerje (order_number, collection_periods)
- [ ] Nastavi RLS policies za vse tabele
- [ ] Ustvari Supabase Storage bucket `store-items`
- [ ] Testiraj ročno z SQL

**Acceptance:**
- Admin lahko INSERT artikel
- Parent lahko INSERT naročilo
- Parent NE more videti tujih naročil
- Zbirniki se avtomatsko ustvarijo

---

### FAZA 2: Admin/Trener - CRUD Artiklov (2-3h)
- [ ] Ustvari `/store` page za admin/coach
- [ ] Tab "Artikli" z tabelo (številka, slika, naziv, velikosti, cena, status)
- [ ] Modal "Dodaj Artikel" (form z vsemi polji + upload slike)
- [ ] Modal "Uredi Artikel"
- [ ] Akcija "Deaktiviraj Artikel"
- [ ] Search/filter funkcionalnost
- [ ] Povečava slike ob kliku

**Acceptance:**
- Admin lahko doda artikel z sliko
- Admin lahko uredi artikel
- Admin lahko deaktivira artikel
- Slika se naloži v Supabase Storage
- Neaktivni artikli se ne prikazujejo staršem

---

### FAZA 3: Starš - Pregled in Naročanje Opreme (3-4h)
- [ ] Ustvari `/store` page za parent
- [ ] Tab "Oprema" s seznamom aktivnih artiklov
- [ ] Kartica artikla (slika, naziv, opis, velikosti checkboxy, cena, link)
- [ ] "Dodaj v košarico" funkcionalnost
- [ ] Košarica modal (pregled, skupni znesek)
- [ ] "Oddaj naročilo" akcija
- [ ] Tab "Moja Naročila" s tabelo (številka, datum, znesek, status)
- [ ] Detail naročila (postavke, timeline statusov)
- [ ] "Prekliči naročilo" akcija (samo če status=open)

**Acceptance:**
- Parent vidi aktivne artikle
- Parent lahko izbere velikost + količino
- Parent lahko odda naročilo
- Naročilo dobi unikatno številko (ORD-YYYY-XXXX)
- Parent vidi svoje naročilo v "Moja Naročila"
- Parent lahko prekliče odprto naročilo
- Parent NE vidi tujih naročil

---

### FAZA 4: Admin/Trener - Pregled Naročil (2-3h)
- [ ] Tab "Naročila" v `/store`
- [ ] Tabela z vsemi naročili (številka, starš, datum, znesek, status)
- [ ] Filtri (status, starš, datum)
- [ ] Detail naročila (postavke, opombe)
- [ ] Akcija "Naročeno dobavitelju" + datum picker
- [ ] Akcija "Predano" + datum picker
- [ ] Akcija "Račun izdelan" (samo admin)
- [ ] Update statusa v realnem času

**Acceptance:**
- Admin/Trener vidi vsa naročila
- Admin/Trener lahko označi "Naročeno dobavitelju"
- Admin/Trener lahko označi "Predano"
- Admin lahko označi "Račun izdelan"
- Datumi se shranijo pravilno
- Status timeline se pravilno prikazuje staršu

---

### FAZA 5: Zbirniki Naročil (2-3h)
- [ ] Tab "Zbirniki" v `/store` (admin/coach)
- [ ] Tabela obdobij (datum, št. naročil, znesek, status)
- [ ] Detail zbirnika (seznam naročil v tem obdobju)
- [ ] Akcija "Naročeno dobavitelju" (za cel zbirnik)
- [ ] Avtomatsko ustvarjanje zbirnikov (1. in 15.) via trigger
- [ ] Pregled po staršu znotraj zbirnika
- [ ] Označevanje posameznih naročil kot "Predano"

**Acceptance:**
- Zbirniki se avtomatsko ustvarijo za naslednja 3 obdobja
- Admin vidi vsa naročila v zbirniku
- Admin lahko označi cel zbirnik kot "Naročeno"
- Admin lahko označi posamezna naročila kot "Predano"

---

### FAZA 6: UI/UX Poliranje (1-2h)
- [ ] Responsive design (mobilni, tablet, desktop)
- [ ] Loading states
- [ ] Empty states
- [ ] Error handling
- [ ] Toast notifications
- [ ] Ikone in vizualna hierarhija
- [ ] Accessibility (keyboard navigation)

**Acceptance:**
- Aplikacija deluje na mobilnih napravah
- Vsi obrazci imajo validacijo
- Uporabnik dobi feedback ob vsaki akciji

---

### FAZA 7: Testiranje in Dokumentacija (1-2h)
- [ ] Testiraj vse vloge (admin, coach, parent)
- [ ] Testiraj workflow (oddaja → naročilo → predaja → račun)
- [ ] Testiraj RLS (parent ne vidi tujih naročil)
- [ ] Testiraj avtomatske zbirnike
- [ ] Dokumentiraj v README
- [ ] Acceptance testi (glej spodaj)

---

## 8. ACCEPTANCE CRITERIA (TESTIRANJE)

### 8.1 Artikli
- [ ] Admin lahko doda artikel z vsemi polji
- [ ] Admin lahko naloži sliko (max 5MB)
- [ ] Slika se prikaže pravilno (2×3 cm ratio)
- [ ] Klik na sliko jo poveča
- [ ] Admin lahko uredi artikel
- [ ] Admin lahko deaktivira artikel
- [ ] Neaktivni artikli se NE prikazujejo staršem
- [ ] Povezava se odpre v novem tabu

### 8.2 Naročila - Starš
- [ ] Parent vidi samo aktivne artikle
- [ ] Parent lahko izbere velikost (checkboxy)
- [ ] Parent lahko doda artikel v košarico
- [ ] Košarica pravilno sešteva (cena × količina)
- [ ] Parent lahko odda naročilo
- [ ] Naročilo dobi unikatno številko (ORD-2026-XXXX)
- [ ] Parent vidi svoje naročilo v "Moja Naročila"
- [ ] Parent lahko prekliče naročilo (samo status=open)
- [ ] Parent NE more preklicati naročenega naročila
- [ ] Parent NE vidi tujih naročil

### 8.3 Naročila - Admin/Trener
- [ ] Admin vidi VSA naročila
- [ ] Trener vidi VSA naročila
- [ ] Admin lahko označi "Naročeno dobavitelju" + datum
- [ ] Trener lahko označi "Naročeno dobavitelju" + datum
- [ ] Admin lahko označi "Predano" + datum
- [ ] Trener lahko označi "Predano" + datum
- [ ] Admin lahko označi "Račun izdelan"
- [ ] Trener NE more označiti "Račun izdelan" (samo admin)
- [ ] Status timeline se pravilno prikazuje

### 8.4 Zbirniki
- [ ] Zbirniki se avtomatsko ustvarijo (1. in 15. v mesecu)
- [ ] Admin vidi vsa naročila v obdobju
- [ ] Admin lahko označi cel zbirnik kot "Naročeno"
- [ ] Datumi se pravilno shranijo
- [ ] Pregled po staršu deluje

### 8.5 Varnost (RLS)
- [ ] Parent NE vidi tujih naročil (SELECT)
- [ ] Parent NE more urediti tujih naročil (UPDATE)
- [ ] Parent NE more brisati artiklov (DELETE)
- [ ] Parent NE more dodajati artiklov (INSERT na store_items)
- [ ] Coach NE more označiti "Račun izdelan"

### 8.6 Navigacija
- [ ] Gumb "Oprema" se prikazuje vsem vlogam
- [ ] Gumb "Oprema" odpre pravilno stran glede na vlogo
- [ ] Admin/Coach vidi CRUD vmesnik
- [ ] Parent vidi naročilni vmesnik

---

## 9. TEHNIČNE ODLOČITVE

### 9.1 Image Upload
- **Supabase Storage** bucket: `store-items`
- Max velikost: 5 MB
- Dovoljeni formati: JPG, PNG, WebP
- Aspect ratio: 2:3 (avtomatski crop ali validation)

### 9.2 Order Number Format
```
ORD-YYYY-XXXX
ORD-2026-0001
ORD-2026-0002
...
```
Zaporedna številka se resetira vsako leto.

### 9.3 Collection Periods Logic
- Avtomatsko generiranje: trigger ob INSERT v store_orders
- Ustvari 3 mesece vnaprej (6 obdobij)
- Datumi: 1. in 15. dan v mesecu

### 9.4 Status Flow
```
Parent odda naročilo → "open"
Admin označi "Naročeno" → "ordered"
Admin označi "Predano" → "delivered"
Admin označi "Račun" → "invoiced"
Parent prekliče → "cancelled" (samo če status=open)
```

### 9.5 Snapshot Podatkov
Ko parent odda naročilo, se shranijo:
- `item_name` (snapshot naziva)
- `item_number` (snapshot številke)
- `unit_price` (snapshot cene)

To preprečuje spremembo cen/nazivov retroaktivno.

---

## 10. VARNOSTNA OPOMBA

**NE spreminjaj obstoječe funkcionalnosti:**
- NE dotikaj attendance, activities, players, teams, coaches
- NE spreminjaj routing obstoječih strani
- NE spreminjaj AppLayout razen dodajanja gumba "Oprema"
- NE spreminjaj RLS policies obstoječih tabel

**Samo dodaj:**
- Nove tabele z `store_*` prefiksom
- Nov routing `/store`
- Nov gumb v navigaciji
- Nov storage bucket `store-items`

---

## 11. OCENA ČASA

| Faza | Čas |
|------|-----|
| 1. Podatkovna osnova | 1-2h |
| 2. CRUD Artiklov | 2-3h |
| 3. Naročanje Opreme | 3-4h |
| 4. Pregled Naročil | 2-3h |
| 5. Zbirniki | 2-3h |
| 6. UI/UX Poliranje | 1-2h |
| 7. Testiranje | 1-2h |
| **SKUPAJ** | **12-19h** |

---

## 12. ODPRTA VPRAŠANJA - POTRJENO ✅

1. **Plačila:** ❌ NE - Ročna izdelava računov v Vasco (zunaj obsega)
2. **Email Obvestila:** ❌ NE - Starši vidijo status na dashboardu
3. **Zaloge:** ✅ DA - Tracking količine na zalogi + urejanje količine
4. **Kategorije:** ✅ DA - Organizacija artiklov (Dresi, Kopački, Oprema) + iskalnik po nazivu
5. **Količinski popusti:** ❌ NE
6. **Valuta:** EUR (fiksno)
7. **Minimal Order:** NE (zunaj obsega)

---

## 13. NASLEDNJI KORAKI

**KO POTRDITE TA NAČRT:**
1. Bom začel z Fazo 1 (Podatkovna osnova)
2. Po vsaki fazi bom pokazal preview in čakal na potrditev
3. Implementiral bom vse acceptance teste
4. Dokumentiral vse spremembe

**ČE ŽELITE SPREMEMBE:**
- Povejte mi katera faza/zahteva naj se spremeni
- Odgovorite na odprta vprašanja
- Dodajte nove zahteve

---

**Status:** ⏸ Čaka na vašo potrditev

**Pripravil:** Softgen AI  
**Datum:** 17.9.2026