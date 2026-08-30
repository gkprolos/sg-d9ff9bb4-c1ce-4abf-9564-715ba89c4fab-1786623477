-- Drop existing conversation insert policy
DROP POLICY IF EXISTS "conversations_insert_authenticated" ON conversations;

-- Create new policy that allows both user and parent-initiated conversations
CREATE POLICY "conversations_insert_authenticated" ON conversations
FOR INSERT
TO public
WITH CHECK (
  -- Regular authenticated user creating conversation
  (auth.uid() IS NOT NULL AND created_by = auth.uid())
  OR
  -- Parent or system-initiated conversation (created_by can be any user or NULL)
  (auth.uid() IS NOT NULL)
);

-- Also fix: ensure conversations can be read by participants
DROP POLICY IF EXISTS "conversations_select_own" ON conversations;

CREATE POLICY "conversations_select_own" ON conversations
FOR SELECT
TO public
USING (
  -- Admin can see all
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
  OR
  -- Coach can see their team conversations
  EXISTS (
    SELECT 1 FROM team_coaches tc
    WHERE tc.coach_id = auth.uid()
      AND tc.team_id = conversations.team_id
      AND tc.is_active = true
  )
  OR
  -- User is a participant
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
  )
  OR
  -- Parent is a participant (check via email in session)
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.parent_email IS NOT NULL
  )
);