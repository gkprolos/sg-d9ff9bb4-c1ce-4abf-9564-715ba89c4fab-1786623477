-- Step 3: Create NEW simplified policies using SECURITY DEFINER function

-- ACTIVITIES: Coach select policy (NO reference to activity_coaches table in RLS)
CREATE POLICY coach_select_simple ON public.activities
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    -- Team coach access only (no activity_coaches check here to avoid recursion)
    team_id IN (
      SELECT team_id FROM team_coaches
      WHERE coach_id = auth.uid()
        AND is_active = true
    )
  );

COMMENT ON POLICY coach_select_simple ON public.activities IS
  'Coaches can see activities for their assigned teams - simplified to avoid recursion';

-- ACTIVITY_COACHES: Coach select policy (uses SECURITY DEFINER function)
CREATE POLICY coach_select_safe ON public.activity_coaches
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    coach_id = auth.uid()  -- Always see own records
    OR
    coach_can_see_activity(activity_id)  -- Use SECURITY DEFINER function
  );

COMMENT ON POLICY coach_select_safe ON public.activity_coaches IS
  'Coaches can see activity_coaches records using SECURITY DEFINER function to avoid recursion';