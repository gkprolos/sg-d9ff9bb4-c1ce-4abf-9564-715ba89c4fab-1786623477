-- BACKUP OF RLS POLICIES BEFORE FIXING INFINITE RECURSION
-- Date: 2026-09-01 00:30:00
-- DO NOT APPLY - This is a backup only for reverting if needed

-- ==============================================
-- ACTIVITIES TABLE POLICIES (BEFORE FIX)
-- ==============================================

-- Policy: admin_all
-- CREATE POLICY admin_all ON public.activities
--   AS PERMISSIVE FOR ALL TO authenticated
--   USING ((get_user_role() = 'admin'::text));

-- Policy: coach_select
-- CREATE POLICY coach_select ON public.activities
--   AS PERMISSIVE FOR SELECT TO authenticated
--   USING (
--     (team_id IN ( SELECT team_coaches.team_id
--       FROM team_coaches
--       WHERE ((team_coaches.coach_id = auth.uid()) AND (team_coaches.is_active = true))))
--     OR 
--     (id IN ( SELECT activity_coaches.activity_id
--       FROM activity_coaches
--       WHERE (activity_coaches.coach_id = auth.uid())))
--   );

-- ==============================================
-- ACTIVITY_COACHES TABLE POLICIES (BEFORE FIX)
-- ==============================================

-- Policy: admin_all
-- CREATE POLICY admin_all ON public.activity_coaches
--   AS PERMISSIVE FOR ALL TO authenticated
--   USING ((get_user_role() = 'admin'::text))
--   WITH CHECK ((get_user_role() = 'admin'::text));

-- Policy: coach_delete
-- CREATE POLICY coach_delete ON public.activity_coaches
--   AS PERMISSIVE FOR DELETE TO authenticated
--   USING ((coach_id = auth.uid()));

-- Policy: coach_insert
-- CREATE POLICY coach_insert ON public.activity_coaches
--   AS PERMISSIVE FOR INSERT TO authenticated
--   WITH CHECK (
--     (activity_id IN ( SELECT a.id
--       FROM (activities a
--         JOIN team_coaches tc ON ((tc.team_id = a.team_id)))
--       WHERE ((tc.coach_id = auth.uid()) AND (tc.is_active = true))))
--   );

-- Policy: coach_select_no_recursion
-- CREATE POLICY coach_select_no_recursion ON public.activity_coaches
--   AS PERMISSIVE FOR SELECT TO authenticated
--   USING (
--     ((coach_id = auth.uid()) 
--     OR 
--     (activity_id IN ( SELECT a.id
--       FROM (activities a
--         JOIN team_coaches tc ON ((tc.team_id = a.team_id)))
--       WHERE ((tc.coach_id = auth.uid()) AND (tc.is_active = true)))))
--   );

-- Policy: coach_update
-- CREATE POLICY coach_update ON public.activity_coaches
--   AS PERMISSIVE FOR UPDATE TO authenticated
--   USING ((coach_id = auth.uid()))
--   WITH CHECK ((coach_id = auth.uid()));

-- ==============================================
-- CIRCULAR DEPENDENCY ISSUE:
-- ==============================================
-- activities.coach_select references activity_coaches table
-- activity_coaches.coach_select_no_recursion references activities table
-- This creates infinite recursion when loading activities
--
-- SOLUTION: Break the circular dependency by using SECURITY DEFINER function
-- or by simplifying one of the policies to NOT reference the other table