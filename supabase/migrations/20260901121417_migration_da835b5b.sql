-- Drop the incorrect trigger and function with CASCADE
DROP TRIGGER IF EXISTS trigger_sync_attendance_date ON activities CASCADE;
DROP FUNCTION IF EXISTS sync_attendance_date_on_activity_change() CASCADE;

-- No replacement needed because:
-- 1. attendance_records does NOT have an attendance_date column
-- 2. The activity date is stored ONLY in activities.activity_date
-- 3. When querying attendance, we JOIN with activities to get the date
-- 4. When activities.activity_date changes, the JOIN automatically shows the new date
-- 5. No sync needed - the relationship is through foreign key