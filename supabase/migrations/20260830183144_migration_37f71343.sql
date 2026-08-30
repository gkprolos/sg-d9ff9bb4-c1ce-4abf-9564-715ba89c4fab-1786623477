-- Fix conversations SELECT policy - remove insecure parent check
DROP POLICY IF EXISTS "conversations_select_own" ON conversations;
DROP POLICY IF EXISTS "conversations_select_participant" ON conversations;

-- Admin sees all conversations
-- Coach sees team conversations + conversations they participate in
-- Regular users see only conversations they participate in
-- Parents MUST use API routes (no RLS access) because they don't have auth.uid()
CREATE POLICY "conversations_select_authenticated" ON conversations
FOR SELECT
TO public
USING (
  -- Admin sees all
  (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ))
  OR
  -- Coach sees conversations of their teams
  (EXISTS (
    SELECT 1 FROM team_coaches tc
    WHERE tc.coach_id = auth.uid()
      AND tc.team_id = conversations.team_id
      AND tc.is_active = true
  ))
  OR
  -- User sees conversations they are participant in (user_id match only)
  (EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
  ))
);

-- Note: Parent users don't have auth.uid() so they can't use this policy
-- Parent conversations must be accessed via API routes with service role key
-- and explicit parent_email filtering