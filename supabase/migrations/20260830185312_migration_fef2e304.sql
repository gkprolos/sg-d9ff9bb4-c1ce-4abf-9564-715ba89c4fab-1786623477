-- Rebuild conversation_participants policies using SECURITY DEFINER helper
-- This completely eliminates RLS recursion

-- Drop all existing policies
DROP POLICY IF EXISTS "conversation_participants_select_own" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_select_admin" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_insert_admin" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_insert_allowed" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_update_admin" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_delete_admin" ON conversation_participants;

-- SELECT: User can see participants if they have access to the conversation
CREATE POLICY "conversation_participants_select" ON conversation_participants
FOR SELECT
TO public
USING (
  user_id = auth.uid()
  OR
  user_can_access_conversation(conversation_id)
);

-- INSERT: Only users who can access the conversation can add participants
CREATE POLICY "conversation_participants_insert" ON conversation_participants
FOR INSERT
TO public
WITH CHECK (
  user_can_access_conversation(conversation_id)
  OR
  user_id = auth.uid()
);

-- UPDATE: Only admins can update participants
CREATE POLICY "conversation_participants_update" ON conversation_participants
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- DELETE: Only admins can delete participants
CREATE POLICY "conversation_participants_delete" ON conversation_participants
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);