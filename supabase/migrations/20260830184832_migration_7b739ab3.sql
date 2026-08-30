-- Drop ALL conversation_participants policies and recreate from scratch
-- This will fix the infinite recursion

-- Drop all existing policies
DROP POLICY IF EXISTS "conversation_participants_select_own" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_select_member" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_insert_member" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_update_own" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_admin_all" ON conversation_participants;
DROP POLICY IF EXISTS "admin_conversation_participants" ON conversation_participants;
DROP POLICY IF EXISTS "coach_conversation_participants" ON conversation_participants;
DROP POLICY IF EXISTS "parent_conversation_participants" ON conversation_participants;

-- Create simple, non-recursive policies

-- 1. Admin can see/manage all participants
CREATE POLICY "admin_all_conversation_participants" ON conversation_participants
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
);

-- 2. Users can see participants if they are part of that conversation
-- CRITICAL: Use conversations table, NOT conversation_participants!
CREATE POLICY "user_view_conversation_participants" ON conversation_participants
FOR SELECT
TO public
USING (
  -- User is authenticated AND one of:
  auth.uid() IS NOT NULL
  AND (
    -- They created the conversation
    conversation_id IN (
      SELECT id FROM conversations
      WHERE created_by = auth.uid()
    )
    OR
    -- They are a coach on the conversation's team
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN team_coaches tc ON tc.team_id = c.team_id
      WHERE tc.coach_id = auth.uid()
    )
    OR
    -- They are directly a participant (by user_id match in THIS row)
    user_id = auth.uid()
  )
);

-- 3. Users can insert participants when creating conversations
CREATE POLICY "user_insert_conversation_participants" ON conversation_participants
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Admin
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
    OR
    -- Creator of the conversation
    conversation_id IN (
      SELECT id FROM conversations
      WHERE created_by = auth.uid()
    )
  )
);

-- 4. Users can update their own read status
CREATE POLICY "user_update_own_participant" ON conversation_participants
FOR UPDATE
TO public
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- Note: Parents access conversations via API routes with service role key
-- They don't use RLS (no auth.uid() for parents)