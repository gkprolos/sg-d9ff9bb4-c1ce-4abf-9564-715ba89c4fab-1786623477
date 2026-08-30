-- Create function to calculate hours worked from activity start/end times
CREATE OR REPLACE FUNCTION calculate_activity_coach_hours()
RETURNS TRIGGER AS $$
DECLARE
  activity_start_time TIME;
  activity_end_time TIME;
  duration_hours NUMERIC;
BEGIN
  -- Get activity start/end times
  SELECT start_time, end_time
  INTO activity_start_time, activity_end_time
  FROM activities
  WHERE id = NEW.activity_id;
  
  -- Calculate duration in hours
  IF activity_start_time IS NOT NULL AND activity_end_time IS NOT NULL THEN
    -- Extract epoch (seconds) and convert to hours
    duration_hours := EXTRACT(EPOCH FROM (activity_end_time - activity_start_time)) / 3600.0;
    
    -- Round to 2 decimal places
    NEW.hours_worked := ROUND(duration_hours, 2);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on activity_coaches to auto-calculate hours_worked
DROP TRIGGER IF EXISTS trigger_calculate_activity_coach_hours ON activity_coaches;

CREATE TRIGGER trigger_calculate_activity_coach_hours
  BEFORE INSERT OR UPDATE ON activity_coaches
  FOR EACH ROW
  EXECUTE FUNCTION calculate_activity_coach_hours();

COMMENT ON FUNCTION calculate_activity_coach_hours() IS 'Automatically calculates hours_worked from activity start/end times';
COMMENT ON TRIGGER trigger_calculate_activity_coach_hours ON activity_coaches IS 'Auto-calculates hours_worked before insert/update';