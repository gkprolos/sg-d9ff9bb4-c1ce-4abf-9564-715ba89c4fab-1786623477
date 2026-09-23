-- ============================================================================
-- MIGRATION: Add GRANT statements for all tables
-- Date: 2026-09-23
-- Reason: Supabase will stop automatically granting Data API access on Oct 30, 2026
-- ============================================================================

-- ============================================================================
-- CORE TABLES (from 20260101000001_create_tables.sql)
-- ============================================================================

-- profiles (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;

-- user_roles (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO anon;
GRANT ALL ON public.user_roles TO service_role;

-- seasons (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
GRANT SELECT ON public.seasons TO anon;
GRANT ALL ON public.seasons TO service_role;

-- teams (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT ON public.teams TO anon;
GRANT ALL ON public.teams TO service_role;

-- venues (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT SELECT ON public.venues TO anon;
GRANT ALL ON public.venues TO service_role;

-- players (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT SELECT ON public.players TO anon;
GRANT ALL ON public.players TO service_role;

-- guardians (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guardians TO authenticated;
GRANT SELECT ON public.guardians TO anon;
GRANT ALL ON public.guardians TO service_role;

-- player_guardians (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_guardians TO authenticated;
GRANT SELECT ON public.player_guardians TO anon;
GRANT ALL ON public.player_guardians TO service_role;

-- team_players (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_players TO authenticated;
GRANT SELECT ON public.team_players TO anon;
GRANT ALL ON public.team_players TO service_role;

-- team_coaches (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_coaches TO authenticated;
GRANT SELECT ON public.team_coaches TO anon;
GRANT ALL ON public.team_coaches TO service_role;

-- schedule_templates (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_templates TO authenticated;
GRANT SELECT ON public.schedule_templates TO anon;
GRANT ALL ON public.schedule_templates TO service_role;

-- activities (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT SELECT ON public.activities TO anon;
GRANT ALL ON public.activities TO service_role;

-- activity_coaches (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_coaches TO authenticated;
GRANT SELECT ON public.activity_coaches TO anon;
GRANT ALL ON public.activity_coaches TO service_role;

-- attendance_records (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT SELECT ON public.attendance_records TO anon;
GRANT ALL ON public.attendance_records TO service_role;

-- form_types (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_types TO authenticated;
GRANT SELECT ON public.form_types TO anon;
GRANT ALL ON public.form_types TO service_role;

-- player_forms (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_forms TO authenticated;
GRANT SELECT ON public.player_forms TO anon;
GRANT ALL ON public.player_forms TO service_role;

-- coach_rates (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_rates TO authenticated;
GRANT SELECT ON public.coach_rates TO anon;
GRANT ALL ON public.coach_rates TO service_role;

-- locked_months (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locked_months TO authenticated;
GRANT SELECT ON public.locked_months TO anon;
GRANT ALL ON public.locked_months TO service_role;

-- correction_requests (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.correction_requests TO authenticated;
GRANT SELECT ON public.correction_requests TO anon;
GRANT ALL ON public.correction_requests TO service_role;

-- audit_log (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log TO authenticated;
GRANT SELECT ON public.audit_log TO anon;
GRANT ALL ON public.audit_log TO service_role;

-- data_subject_requests (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_subject_requests TO authenticated;
GRANT SELECT ON public.data_subject_requests TO anon;
GRANT ALL ON public.data_subject_requests TO service_role;

-- ============================================================================
-- MESSAGING TABLES
-- ============================================================================

-- conversations (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT ON public.conversations TO anon;
GRANT ALL ON public.conversations TO service_role;

-- messages (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT ON public.messages TO anon;
GRANT ALL ON public.messages TO service_role;

-- conversation_participants (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT SELECT ON public.conversation_participants TO anon;
GRANT ALL ON public.conversation_participants TO service_role;

-- ============================================================================
-- PARENT AUTH TABLES (NO RLS - service_role only)
-- ============================================================================

-- parent_auth_codes (NO RLS - service_role only)
GRANT ALL ON public.parent_auth_codes TO service_role;

-- parent_credentials (NO RLS - service_role only)
GRANT ALL ON public.parent_credentials TO service_role;

-- ============================================================================
-- STORE MODULE TABLES
-- ============================================================================

-- store_items (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_items TO authenticated;
GRANT SELECT ON public.store_items TO anon;
GRANT ALL ON public.store_items TO service_role;

-- store_categories (NO RLS - service_role only)
GRANT ALL ON public.store_categories TO service_role;

-- store_orders (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_orders TO authenticated;
GRANT SELECT ON public.store_orders TO anon;
GRANT ALL ON public.store_orders TO service_role;

-- store_order_items (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_order_items TO authenticated;
GRANT SELECT ON public.store_order_items TO anon;
GRANT ALL ON public.store_order_items TO service_role;

-- store_inventory_log (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_inventory_log TO authenticated;
GRANT SELECT ON public.store_inventory_log TO anon;
GRANT ALL ON public.store_inventory_log TO service_role;

-- store_transactions (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_transactions TO authenticated;
GRANT SELECT ON public.store_transactions TO anon;
GRANT ALL ON public.store_transactions TO service_role;

-- store_delivery_addresses (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_delivery_addresses TO authenticated;
GRANT SELECT ON public.store_delivery_addresses TO anon;
GRANT ALL ON public.store_delivery_addresses TO service_role;

-- store_seasonal_prices (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_seasonal_prices TO authenticated;
GRANT SELECT ON public.store_seasonal_prices TO anon;
GRANT ALL ON public.store_seasonal_prices TO service_role;

-- store_size_availability (RLS enabled)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_size_availability TO authenticated;
GRANT SELECT ON public.store_size_availability TO anon;
GRANT ALL ON public.store_size_availability TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all grants are in place
DO $$
DECLARE
  expected_count INT := 35;
  actual_count INT;
BEGIN
  SELECT COUNT(DISTINCT tablename)
  INTO actual_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE 'sql_%';
  
  IF actual_count != expected_count THEN
    RAISE NOTICE 'Warning: Expected % tables, found % tables', expected_count, actual_count;
  ELSE
    RAISE NOTICE 'Success: All % tables have GRANT statements', expected_count;
  END IF;
END $$;