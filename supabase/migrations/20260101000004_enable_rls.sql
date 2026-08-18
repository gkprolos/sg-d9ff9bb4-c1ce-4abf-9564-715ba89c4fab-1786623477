-- Migracija 4: Row Level Security
-- Datum: 2026-08-13
-- Opis: RLS politike za vse tabele

-- ============================================================================
-- TABELA: profiles
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse
CREATE POLICY "Admin select all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Uporabnik vidi svoj profil
CREATE POLICY "Users select own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Trener vidi profile drugih trenerjev istih selekcij
CREATE POLICY "Coaches see team coaches"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_coaches tc1
      WHERE tc1.coach_id = auth.uid()
        AND tc1.is_active = true
        AND EXISTS (
          SELECT 1 FROM public.team_coaches tc2
          WHERE tc2.coach_id = profiles.id
            AND tc2.team_id = tc1.team_id
            AND tc2.is_active = true
        )
    )
  );

-- Admin lahko posodablja profile
CREATE POLICY "Admin update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Uporabnik posodablja svoj profil (omejeno)
CREATE POLICY "Users update own profile limited"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Stolpčna dovoljenja: uporabnik lahko posodablja samo določena polja
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, phone, updated_at) ON profiles TO authenticated;

-- ============================================================================
-- TABELA: user_roles
-- ============================================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse vloge
CREATE POLICY "Admin select all roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Uporabnik vidi svojo vlogo
CREATE POLICY "Users select own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Samo admin lahko upravlja vloge
CREATE POLICY "Admin insert roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (_app_internals.is_admin(auth.uid()));

CREATE POLICY "Admin update roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

CREATE POLICY "Admin delete roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: seasons
-- ============================================================================
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- Vsi authenticated uporabniki vidijo sezone
CREATE POLICY "All select seasons"
  ON seasons FOR SELECT
  TO authenticated
  USING (true);

-- Samo admin upravlja sezone
CREATE POLICY "Admin manage seasons"
  ON seasons FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: teams
-- ============================================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse selekcije
CREATE POLICY "Admin select all teams"
  ON teams FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi svoje selekcije
CREATE POLICY "Coaches select assigned teams"
  ON teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_coaches
      WHERE team_id = teams.id
        AND coach_id = auth.uid()
        AND is_active = true
    )
  );

-- Samo admin upravlja selekcije
CREATE POLICY "Admin manage teams"
  ON teams FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: venues
-- ============================================================================
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- Vsi authenticated vidijo dvorane
CREATE POLICY "All select venues"
  ON venues FOR SELECT
  TO authenticated
  USING (true);

-- Samo admin upravlja dvorane
CREATE POLICY "Admin manage venues"
  ON venues FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: players
-- ============================================================================
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse igralce
CREATE POLICY "Admin select all players"
  ON players FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi igralce svojih selekcij (trenutno članstvo)
CREATE POLICY "Coaches select team players"
  ON players FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_players tp
      JOIN public.team_coaches tc ON tp.team_id = tc.team_id
      WHERE tp.player_id = players.id
        AND tc.coach_id = auth.uid()
        AND tc.is_active = true
        AND tp.membership_status = 'active'
        AND (tp.valid_from IS NULL OR tp.valid_from <= CURRENT_DATE)
        AND (tp.valid_to IS NULL OR tp.valid_to >= CURRENT_DATE)
    )
  );

-- Admin upravlja igralce
CREATE POLICY "Admin manage players"
  ON players FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener posodablja opombe (omejeno)
REVOKE UPDATE ON players FROM authenticated;
GRANT UPDATE (notes, updated_at) ON players TO authenticated;

CREATE POLICY "Coaches update player notes"
  ON players FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_players tp
      JOIN public.team_coaches tc ON tp.team_id = tc.team_id
      WHERE tp.player_id = players.id
        AND tc.coach_id = auth.uid()
        AND tc.is_active = true
        AND tp.membership_status = 'active'
        AND (tp.valid_from IS NULL OR tp.valid_from <= CURRENT_DATE)
        AND (tp.valid_to IS NULL OR tp.valid_to >= CURRENT_DATE)
    )
  );

-- ============================================================================
-- TABELA: guardians
-- ============================================================================
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse starše
CREATE POLICY "Admin select all guardians"
  ON guardians FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi starše igralcev svojih selekcij (trenutno članstvo)
CREATE POLICY "Coaches select player guardians"
  ON guardians FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_guardians pg
      JOIN public.team_players tp ON pg.player_id = tp.player_id
      JOIN public.team_coaches tc ON tp.team_id = tc.team_id
      WHERE pg.guardian_id = guardians.id
        AND tc.coach_id = auth.uid()
        AND tc.is_active = true
        AND tp.membership_status = 'active'
        AND (tp.valid_from IS NULL OR tp.valid_from <= CURRENT_DATE)
        AND (tp.valid_to IS NULL OR tp.valid_to >= CURRENT_DATE)
    )
  );

-- Samo admin upravlja starše
CREATE POLICY "Admin manage guardians"
  ON guardians FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: player_guardians
-- ============================================================================
ALTER TABLE player_guardians ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse povezave
CREATE POLICY "Admin select all player_guardians"
  ON player_guardians FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi povezave svojih igralcev (trenutno članstvo)
CREATE POLICY "Coaches select player guardians links"
  ON player_guardians FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_players tp
      JOIN public.team_coaches tc ON tp.team_id = tc.team_id
      WHERE tp.player_id = player_guardians.player_id
        AND tc.coach_id = auth.uid()
        AND tc.is_active = true
        AND tp.membership_status = 'active'
        AND (tp.valid_from IS NULL OR tp.valid_from <= CURRENT_DATE)
        AND (tp.valid_to IS NULL OR tp.valid_to >= CURRENT_DATE)
    )
  );

-- Samo admin upravlja povezave
CREATE POLICY "Admin manage player_guardians"
  ON player_guardians FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: team_players
-- ============================================================================
ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse članstva
CREATE POLICY "Admin select all team_players"
  ON team_players FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi članstva svojih selekcij
CREATE POLICY "Coaches select team memberships"
  ON team_players FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_coaches
      WHERE team_id = team_players.team_id
        AND coach_id = auth.uid()
        AND is_active = true
    )
  );

-- Samo admin upravlja članstva
CREATE POLICY "Admin manage team_players"
  ON team_players FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: team_coaches
-- ============================================================================
ALTER TABLE team_coaches ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse dodelitve
CREATE POLICY "Admin select all team_coaches"
  ON team_coaches FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi dodelitve svojih selekcij
CREATE POLICY "Coaches select team assignments"
  ON team_coaches FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.team_coaches
      WHERE coach_id = auth.uid() AND is_active = true
    )
  );

-- Samo admin upravlja dodelitve
CREATE POLICY "Admin manage team_coaches"
  ON team_coaches FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: schedule_templates
-- ============================================================================
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse urnike
CREATE POLICY "Admin select all schedules"
  ON schedule_templates FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi urnike svojih selekcij
CREATE POLICY "Coaches select team schedules"
  ON schedule_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_coaches
      WHERE team_id = schedule_templates.team_id
        AND coach_id = auth.uid()
        AND is_active = true
    )
  );

-- Samo admin upravlja urnike
CREATE POLICY "Admin manage schedules"
  ON schedule_templates FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: activities
-- ============================================================================
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse aktivnosti
CREATE POLICY "Admin select all activities"
  ON activities FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi aktivnosti svojih selekcij
CREATE POLICY "Coaches select team activities"
  ON activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_coaches
      WHERE team_id = activities.team_id
        AND coach_id = auth.uid()
        AND is_active = true
    )
  );

-- Admin lahko upravlja vse aktivnosti
CREATE POLICY "Admin manage activities"
  ON activities FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener NE sme neposredno urejati aktivnosti - samo preko RPC funkcij
-- UPDATE/INSERT omejitve za trenerje
REVOKE INSERT, UPDATE, DELETE ON activities FROM authenticated;

-- Allow UPDATE for specific columns so the activities_update_policy can work
GRANT UPDATE (is_completed, updated_at, notes) ON activities TO authenticated;

-- Clean non-recursive UPDATE policies
CREATE POLICY "admin_update_activities" ON public.activities
  FOR UPDATE
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()))
  WITH CHECK (_app_internals.is_admin(auth.uid()));

CREATE POLICY "coach_update_activities" ON public.activities
  FOR UPDATE
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.team_coaches
      WHERE coach_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_coaches
      WHERE coach_id = auth.uid() AND is_active = true
    )
  );

-- ============================================================================
-- TABELA: activity_coaches
-- ============================================================================
ALTER TABLE activity_coaches ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse zapise trenerjev
CREATE POLICY "Admin select all activity_coaches"
  ON activity_coaches FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi zapise na aktivnostih svojih selekcij
CREATE POLICY "Coaches select activity coaches"
  ON activity_coaches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      JOIN public.team_coaches tc ON a.team_id = tc.team_id
      WHERE a.id = activity_coaches.activity_id
        AND tc.coach_id = auth.uid()
        AND tc.is_active = true
    )
  );

-- Admin upravlja vse
CREATE POLICY "Admin manage activity_coaches"
  ON activity_coaches FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trenerji NE smejo neposredno urejati - samo preko RPC
REVOKE INSERT, UPDATE, DELETE ON activity_coaches FROM authenticated;
-- Dovoli samo posodabljanje kilometrov
GRANT UPDATE (mileage_km, updated_at) ON activity_coaches TO authenticated;

CREATE POLICY "Coaches update own mileage"
  ON activity_coaches FOR UPDATE
  TO authenticated
  USING (
    coach_id = auth.uid()
    AND NOT _app_internals.is_activity_completed(activity_id)
    AND NOT _app_internals.is_month_locked_for_activity(activity_id)
  )
  WITH CHECK (coach_id = auth.uid());

-- ============================================================================
-- TABELA: attendance_records
-- ============================================================================
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Admin vidi vso prisotnost
CREATE POLICY "Admin select all attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi prisotnost svojih selekcij
CREATE POLICY "Coaches select team attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      JOIN public.team_coaches tc ON a.team_id = tc.team_id
      WHERE a.id = attendance_records.activity_id
        AND tc.coach_id = auth.uid()
        AND tc.is_active = true
    )
  );

-- Admin upravlja vso prisotnost
CREATE POLICY "Admin manage attendance"
  ON attendance_records FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vnese in posodablja prisotnost (samo če ni zaključeno in zaklenjen mesec)
CREATE POLICY "Coaches insert attendance"
  ON attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activities a
      JOIN public.team_coaches tc ON a.team_id = tc.team_id
      WHERE a.id = attendance_records.activity_id
        AND tc.coach_id = auth.uid()
        AND tc.is_active = true
        AND NOT a.is_completed
        AND NOT _app_internals.is_month_locked(a.activity_date)
    )
    AND _app_internals.is_player_member_on_date(
      attendance_records.player_id,
      (SELECT team_id FROM public.activities WHERE id = attendance_records.activity_id),
      (SELECT activity_date FROM public.activities WHERE id = attendance_records.activity_id)
    )
  );

-- Stolpčne omejitve za UPDATE
REVOKE UPDATE ON attendance_records FROM authenticated;
GRANT UPDATE (status, notes, last_modified_by, last_modified_at) ON attendance_records TO authenticated;

CREATE POLICY "Coaches update attendance"
  ON attendance_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      JOIN public.team_coaches tc ON a.team_id = tc.team_id
      WHERE a.id = attendance_records.activity_id
        AND tc.coach_id = auth.uid()
        AND tc.is_active = true
        AND NOT a.is_completed
        AND NOT _app_internals.is_month_locked(a.activity_date)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activities a
      JOIN public.team_coaches tc ON a.team_id = tc.team_id
      WHERE a.id = attendance_records.activity_id
        AND tc.coach_id = auth.uid()
        AND tc.is_active = true
    )
  );

-- ============================================================================
-- TABELA: form_types
-- ============================================================================
ALTER TABLE form_types ENABLE ROW LEVEL SECURITY;

-- Vsi vidijo vrste obrazcev
CREATE POLICY "All select form_types"
  ON form_types FOR SELECT
  TO authenticated
  USING (true);

-- Samo admin upravlja vrste
CREATE POLICY "Admin manage form_types"
  ON form_types FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: player_forms
-- ============================================================================
ALTER TABLE player_forms ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse statuse obrazcev
CREATE POLICY "Admin select all player_forms"
  ON player_forms FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi obrazce svojih igralcev (trenutno članstvo)
CREATE POLICY "Coaches select player forms"
  ON player_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_players tp
      JOIN public.team_coaches tc ON tp.team_id = tc.team_id
      WHERE tp.player_id = player_forms.player_id
        AND tc.coach_id = auth.uid()
        AND tc.is_active = true
        AND tp.membership_status = 'active'
        AND (tp.valid_from IS NULL OR tp.valid_from <= CURRENT_DATE)
        AND (tp.valid_to IS NULL OR tp.valid_to >= CURRENT_DATE)
    )
  );

-- Samo admin upravlja obrazce
CREATE POLICY "Admin manage player_forms"
  ON player_forms FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: coach_rates
-- ============================================================================
ALTER TABLE coach_rates ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse postavke
CREATE POLICY "Admin select all rates"
  ON coach_rates FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi SAMO svoje postavke
CREATE POLICY "Coaches select own rates"
  ON coach_rates FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

-- Samo admin upravlja postavke
CREATE POLICY "Admin manage rates"
  ON coach_rates FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: correction_requests
-- ============================================================================
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;

-- Admin vidi vse zahteve
CREATE POLICY "Admin select all correction_requests"
  ON correction_requests FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- Trener vidi svoje zahteve
CREATE POLICY "Coaches select own requests"
  ON correction_requests FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid());

-- Trener ustvari zahtevo
CREATE POLICY "Coaches insert requests"
  ON correction_requests FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- Samo admin obravnava zahteve
CREATE POLICY "Admin review requests"
  ON correction_requests FOR UPDATE
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- ============================================================================
-- TABELA: audit_log
-- ============================================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admin vidi vso revizijsko sled
CREATE POLICY "Admin select all audit"
  ON audit_log FOR SELECT
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));

-- NIČ ne sme vpisovati, posodabljati ali brisati (samo triggerji)
REVOKE ALL ON audit_log FROM authenticated;
GRANT SELECT ON audit_log TO authenticated;

-- ============================================================================
-- TABELA: data_subject_requests
-- ============================================================================
ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;

-- Samo admin
CREATE POLICY "Admin manage gdpr_requests"
  ON data_subject_requests FOR ALL
  TO authenticated
  USING (_app_internals.is_admin(auth.uid()));