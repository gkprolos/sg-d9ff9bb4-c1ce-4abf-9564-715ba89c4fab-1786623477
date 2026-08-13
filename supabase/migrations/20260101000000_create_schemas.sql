-- Migracija 0: Kreiranje shem
-- Datum: 2026-08-13
-- Opis: Kreiranje ločene sheme za interne funkcije

-- Shema za interne funkcije (SECURITY DEFINER)
CREATE SCHEMA IF NOT EXISTS _app_internals;

-- Revoke public access
REVOKE ALL ON SCHEMA _app_internals FROM PUBLIC;

-- Grant usage samo authenticated
GRANT USAGE ON SCHEMA _app_internals TO authenticated;

-- Komentar
COMMENT ON SCHEMA _app_internals IS 'Internal functions for authorization and business logic';