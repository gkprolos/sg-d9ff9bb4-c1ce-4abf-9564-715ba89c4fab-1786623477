-- Step 1: Drop ALL existing policies on attendance_records
DROP POLICY IF EXISTS attendance_records_delete_coach ON attendance_records;
DROP POLICY IF EXISTS attendance_records_insert_coach ON attendance_records;
DROP POLICY IF EXISTS coach_insert ON attendance_records;
DROP POLICY IF EXISTS attendance_records_select_admin ON attendance_records;
DROP POLICY IF EXISTS coach_select_attendance ON attendance_records;
DROP POLICY IF EXISTS attendance_records_update_coach ON attendance_records;
DROP POLICY IF EXISTS coach_update ON attendance_records;

-- Step 2: Create 4 new simple policies

-- 1. Admin has ALL operations
CREATE POLICY attendance_admin ON attendance_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- 2. Coaches can SELECT attendance for their activities
CREATE POLICY attendance_coach_select ON attendance_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activity_coaches
      WHERE activity_id = attendance_records.activity_id
        AND coach_id = auth.uid()
    )
  );

-- 3. Coaches can INSERT attendance for their activities
CREATE POLICY attendance_coach_insert ON attendance_records
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activity_coaches
      WHERE activity_id = attendance_records.activity_id
        AND coach_id = auth.uid()
    )
  );

-- 4. Coaches can UPDATE attendance for their activities
CREATE POLICY attendance_coach_update ON attendance_records
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM activity_coaches
      WHERE activity_id = attendance_records.activity_id
        AND coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activity_coaches
      WHERE activity_id = attendance_records.activity_id
        AND coach_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON POLICY attendance_admin ON attendance_records IS
  'Admins can perform all operations on attendance records';

COMMENT ON POLICY attendance_coach_select ON attendance_records IS
  'Coaches can view attendance for activities they participate in';

COMMENT ON POLICY attendance_coach_insert ON attendance_records IS
  'Coaches can insert attendance for activities they participate in';

COMMENT ON POLICY attendance_coach_update ON attendance_records IS
  'Coaches can update attendance for activities they participate in';