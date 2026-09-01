# Backup Attendance Policies - Pre-Fix

**Datum:** 2026-09-01T01:17:00Z

## Problem
- Admin ne more edit/delete activities
- /attendance "Shrani in zaključi" vrne napako
- attendance_records policies uporabljajo `_app_internals.is_admin()` ki ne obstaja

## Trenutne Policies na attendance_records

### 1. attendance_records_delete_coach (DELETE)
```sql
USING: 
  (_app_internals.is_admin() OR 
   EXISTS (SELECT 1 FROM activity_coaches 
           WHERE activity_id = attendance_records.activity_id 
           AND coach_id = auth.uid()))
```

### 2. attendance_records_insert_coach (INSERT)
```sql
WITH CHECK:
  (_app_internals.is_admin() OR 
   EXISTS (SELECT 1 FROM activity_coaches 
           WHERE activity_id = attendance_records.activity_id 
           AND coach_id = auth.uid()))
```

### 3. coach_insert (INSERT)
```sql
WITH CHECK:
  EXISTS (SELECT 1 FROM activity_coaches 
          WHERE activity_id = attendance_records.activity_id 
          AND coach_id = auth.uid())
```

### 4. attendance_records_select_admin (SELECT)
```sql
USING: _app_internals.is_admin()
```

### 5. coach_select_attendance (SELECT)
```sql
USING:
  EXISTS (SELECT 1 FROM activity_coaches 
          WHERE activity_id = attendance_records.activity_id 
          AND coach_id = auth.uid())
```

### 6. attendance_records_update_coach (UPDATE)
```sql
USING: 
  (_app_internals.is_admin() OR 
   EXISTS (SELECT 1 FROM activity_coaches 
           WHERE activity_id = attendance_records.activity_id 
           AND coach_id = auth.uid()))
```

### 7. coach_update (UPDATE)
```sql
USING:
  EXISTS (SELECT 1 FROM activity_coaches 
          WHERE activity_id = attendance_records.activity_id 
          AND coach_id = auth.uid())
```

## Načrt Zamenjave

### Dropam vse 7 policies

### Ustvarim 4 nove simple policies:

**1. attendance_admin (ALL)**
```sql
FOR ALL
USING (
  EXISTS (SELECT 1 FROM user_roles 
          WHERE user_id = auth.uid() AND role = 'admin')
)
```

**2. attendance_coach_select (SELECT)**
```sql
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM activity_coaches 
          WHERE activity_id = attendance_records.activity_id 
          AND coach_id = auth.uid())
)
```

**3. attendance_coach_insert (INSERT)**
```sql
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM activity_coaches 
          WHERE activity_id = attendance_records.activity_id 
          AND coach_id = auth.uid())
)
```

**4. attendance_coach_update (UPDATE)**
```sql
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM activity_coaches 
          WHERE activity_id = attendance_records.activity_id 
          AND coach_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM activity_coaches 
          WHERE activity_id = attendance_records.activity_id 
          AND coach_id = auth.uid())
)
```

## Prednosti nove strukture:
- ✅ Uporablja `user_roles` namesto `_app_internals.is_admin()`
- ✅ Admin ima ALL operations (SELECT, INSERT, UPDATE, DELETE)
- ✅ Coach policies ločeni po operaciji (SELECT, INSERT, UPDATE)
- ✅ Brez podvajanja policies
- ✅ Konzistentno s activities policies