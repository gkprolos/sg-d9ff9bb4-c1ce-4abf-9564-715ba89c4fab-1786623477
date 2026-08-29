-- Create SMTP settings table for email configuration
CREATE TABLE IF NOT EXISTS public.smtp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_host text NOT NULL,
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_username text NOT NULL,
  smtp_password text NOT NULL, -- Will be encrypted in app
  smtp_from_email text NOT NULL,
  smtp_from_name text NOT NULL DEFAULT 'OK Lubnik',
  smtp_secure boolean NOT NULL DEFAULT false, -- true for SSL (port 465), false for TLS (port 587)
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Add RLS
ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;

-- Only admin can read SMTP settings
CREATE POLICY "smtp_settings_select_admin" ON smtp_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Only admin can insert SMTP settings
CREATE POLICY "smtp_settings_insert_admin" ON smtp_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Only admin can update SMTP settings
CREATE POLICY "smtp_settings_update_admin" ON smtp_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Only one active SMTP config at a time (trigger)
CREATE OR REPLACE FUNCTION ensure_single_active_smtp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE smtp_settings 
    SET is_active = false 
    WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER smtp_settings_single_active
  AFTER INSERT OR UPDATE ON smtp_settings
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_smtp();

-- Add comment
COMMENT ON TABLE smtp_settings IS 'SMTP server configuration for sending emails (notifications, OTP codes, messages)';