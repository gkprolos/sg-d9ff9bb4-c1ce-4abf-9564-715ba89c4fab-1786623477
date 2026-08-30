-- Fix conversations SELECT policy to be non-recursive

DROP POLICY IF EXISTS "conversations_select_own" ON conversations;

CREATE POLICY "conversations_select_own" ON conversations
FOR SELECT
TO public
USING (
  -- Admin sees all
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
  OR
  -- User created the conversation
  created_by = auth.uid()
  OR
  -- Conversation is for a team the user coaches
  EXISTS (
    SELECT 1 FROM team_coaches tc
    WHERE tc.team_id = conversations.team_id
      AND tc.coach_id = auth.uid()
  )
);

-- Note: Parent access to conversations must be handled via API routes
-- with service role key, not RLS (since parents don't have auth.uid())