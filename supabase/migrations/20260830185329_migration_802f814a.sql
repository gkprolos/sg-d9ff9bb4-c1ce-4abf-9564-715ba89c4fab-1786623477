-- Fix conversations SELECT policy to be simple and non-recursive

DROP POLICY IF EXISTS "conversations_select_accessible" ON conversations;
DROP POLICY IF EXISTS "conversations_select_authenticated" ON conversations;
DROP POLICY IF EXISTS "conversations_select_own" ON conversations;

-- Conversations can be selected if user has access
CREATE POLICY "conversations_select" ON conversations
FOR SELECT
TO public
USING (
  user_can_access_conversation(id)
);