-- ========================================
-- FAZA 2: PARENT LOGIN - DATABASE SETUP
-- ========================================

-- 1. Create parent_auth_codes table for OTP authentication
CREATE TABLE IF NOT EXISTS public.parent_auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_email TEXT NOT NULL,
  code TEXT NOT NULL, -- 4-digit code (hashed for security)
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_email CHECK (parent_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_parent_auth_codes_email ON public.parent_auth_codes(parent_email);
CREATE INDEX IF NOT EXISTS idx_parent_auth_codes_expires ON public.parent_auth_codes(expires_at);

COMMENT ON TABLE public.parent_auth_codes IS 'OTP codes for parent authentication (4-digit, 3 min validity). Accessed only via API routes with service role - no RLS needed.';

-- 2. Create parent_credentials table for optional password storage
CREATE TABLE IF NOT EXISTS public.parent_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- bcrypt hash (nullable - optional password)
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_email CHECK (parent_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_parent_credentials_email ON public.parent_credentials(parent_email);

COMMENT ON TABLE public.parent_credentials IS 'Optional password storage for parents (hybrid OTP + password auth). Accessed only via API routes with service role - no RLS needed.';

-- 3. Trigger to auto-delete expired OTP codes (cleanup)
CREATE OR REPLACE FUNCTION cleanup_expired_otp_codes()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.parent_auth_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_expired_otps ON public.parent_auth_codes;
CREATE TRIGGER trigger_cleanup_expired_otps
  AFTER INSERT ON public.parent_auth_codes
  EXECUTE FUNCTION cleanup_expired_otp_codes();

-- 4. Update player_guardians to support parent authentication
-- Add is_primary flag if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'player_guardians' AND column_name = 'is_primary'
  ) THEN
    ALTER TABLE public.player_guardians 
      ADD COLUMN is_primary BOOLEAN DEFAULT FALSE;
    
    COMMENT ON COLUMN public.player_guardians.is_primary IS 'Primary guardian receives login credentials and notifications';
  END IF;
END $$;

-- 5. Function to get parent's children (for access control in app)
CREATE OR REPLACE FUNCTION get_parent_children(parent_email_param TEXT)
RETURNS TABLE(player_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT pg.player_id
  FROM public.player_guardians pg
  JOIN public.guardians g ON pg.guardian_id = g.id
  WHERE LOWER(g.email) = LOWER(parent_email_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_parent_children IS 'Returns list of player IDs for a given parent email (used for access control)';

-- 6. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_auth_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_credentials TO service_role;
GRANT EXECUTE ON FUNCTION get_parent_children TO authenticated, service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Parent authentication tables created successfully';
  RAISE NOTICE '   - parent_auth_codes: OTP code storage (no RLS - API only)';
  RAISE NOTICE '   - parent_credentials: Optional password storage (no RLS - API only)';
  RAISE NOTICE '   - Auto-cleanup trigger for expired OTPs';
  RAISE NOTICE '   - get_parent_children() function for access control';
  RAISE NOTICE '   - Security: Tables accessed only via API routes with service role key';
END $$;