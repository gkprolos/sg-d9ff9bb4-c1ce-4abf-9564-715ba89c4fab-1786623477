-- Create trigger to sync attendance_date when activity_date changes
CREATE OR REPLACE FUNCTION sync_attendance_date_on_activity_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if activity_date actually changed
  IF NEW.activity_date IS DISTINCT FROM OLD.activity_date THEN
    
    -- Update all attendance records for this activity
    UPDATE public.attendance_records
    SET attendance_date = NEW.activity_date
    WHERE activity_id = NEW.id;
    
    -- Log the sync in audit_log
    INSERT INTO public.audit_log (
      table_name,
      record_id,
      action,
      old_values,
      new_values,
      changed_by,
      changed_at,
      reason
    ) VALUES (
      'attendance_records',
      NEW.id,
      'update',
      jsonb_build_object('activity_date', OLD.activity_date),
      jsonb_build_object('activity_date', NEW.activity_date),
      auth.uid(),
      NOW(),
      'Auto-synced attendance_date when activity_date changed'
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_attendance_date ON public.activities;

-- Create trigger on activities table
CREATE TRIGGER trigger_sync_attendance_date
  AFTER UPDATE OF activity_date ON public.activities
  FOR EACH ROW
  WHEN (NEW.activity_date IS DISTINCT FROM OLD.activity_date)
  EXECUTE FUNCTION sync_attendance_date_on_activity_change();

COMMENT ON FUNCTION sync_attendance_date_on_activity_change() IS 
  'Automatically syncs attendance_date in attendance_records when activity_date changes';