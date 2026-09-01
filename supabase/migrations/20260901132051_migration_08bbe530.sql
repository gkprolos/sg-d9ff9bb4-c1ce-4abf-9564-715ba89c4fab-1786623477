-- Add RLS policy for coaches to view attendance via team assignment (not just activity assignment)
CREATE POLICY "attendance_coach_select_via_team"
ON attendance_records
FOR SELECT
TO public
USING (
  -- Coach can see attendance if they're assigned to the team of the activity
  EXISTS (
    SELECT 1
    FROM activities a
    JOIN team_coaches tc ON tc.team_id = a.team_id
    WHERE a.id = attendance_records.activity_id
      AND tc.coach_id = auth.uid()
      AND tc.is_active = true
  )
);

COMMENT ON POLICY "attendance_coach_select_via_team" ON attendance_records IS 
  'Coaches can view attendance records for activities of teams they are assigned to (via team_coaches)';