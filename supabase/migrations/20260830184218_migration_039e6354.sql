-- Fix infinite recursion in conversation_participants policies
-- CRITICAL: Do NOT query conversation_participants table within its own policies!
-- CRITICAL: Use auth.uid() not uid()!

-- Drop ALL existing policies on conversation_participants
DROP POLICY IF EXISTS "conversation_participants_admin_all" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_insert_creator" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_select_member" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_select_own" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_insert" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_update_own" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_delete_admin" ON conversation_participants;

-- 1. Admin can do everything
CREATE POLICY "conversation_participants_admin_all" ON conversation_participants
FOR ALL
TO public
USING (_app_internals.is_admin(auth.uid()))
WITH CHECK (_app_internals.is_admin(auth.uid()));

-- 2. SELECT: Users can see participants of conversations they have access to
-- CRITICAL: Use conversations table, NOT conversation_participants (to avoid recursion)
CREATE POLICY "conversation_participants_select_own" ON conversation_participants
FOR SELECT
TO public
USING (
  -- Admin already covered by admin_all policy above
  -- User is this participant (direct match, no subquery needed)
  user_id = auth.uid()
  OR
  -- User can see participants of conversations they're involved in
  -- Check via conversations table ONLY (non-recursive!)
  conversation_id IN (
    SELECT c.id
    FROM conversations c
    WHERE c.created_by = auth.uid()
      OR c.team_id IN (
        SELECT tc.team_id
        FROM team_coaches tc
        WHERE tc.coach_id = auth.uid()
          AND tc.is_active = true
      )
  )
);

-- 3. INSERT: Users can add participants to conversations they created
CREATE POLICY "conversation_participants_insert_own" ON conversation_participants
FOR INSERT
TO public
WITH CHECK (
  -- Conversation creator can add participants
  conversation_id IN (
    SELECT c.id
    FROM conversations c
    WHERE c.created_by = auth.uid()
  )
  OR
  -- User can add themselves as participant
  user_id = auth.uid()
);

-- 4. UPDATE: Users can update their own last_read_at timestamp
CREATE POLICY "conversation_participants_update_own" ON conversation_participants
FOR UPDATE
TO public
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5. DELETE: Only admins (covered by admin_all policy)
-- No separate DELETE policy needed - admin_all handles it