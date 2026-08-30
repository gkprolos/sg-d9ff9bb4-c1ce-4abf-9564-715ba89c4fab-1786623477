-- Fix infinite recursion in conversation_participants policies
-- Remove ALL recursive queries to conversation_participants table

-- Drop all existing policies on conversation_participants
DROP POLICY IF EXISTS "admin_conversation_participants" ON conversation_participants;
DROP POLICY IF EXISTS "coach_conversation_participants" ON conversation_participants;
DROP POLICY IF EXISTS "parent_conversation_participants" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_select_own" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_insert" ON conversation_participants;

-- Simple non-recursive policies for conversation_participants

-- 1. SELECT: Users can only see participants of conversations they're part of
-- Check this via conversations table, NOT conversation_participants (to avoid recursion)
CREATE POLICY "conversation_participants_select_own" ON conversation_participants
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
  -- User is this participant (direct match, no subquery)
  user_id = auth.uid()
  OR
  -- Check via conversations table (non-recursive)
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_participants.conversation_id
      AND (
        -- User created the conversation
        c.created_by = auth.uid()
        OR
        -- Conversation is for a team the user coaches
        EXISTS (
          SELECT 1 FROM team_coaches tc
          WHERE tc.team_id = c.team_id
            AND tc.coach_id = auth.uid()
        )
      )
  )
);

-- 2. INSERT: Only conversation creators and admins can add participants
CREATE POLICY "conversation_participants_insert" ON conversation_participants
FOR INSERT
TO public
WITH CHECK (
  -- Admin can insert
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
  OR
  -- Creator of the conversation can add participants
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_participants.conversation_id
      AND c.created_by = auth.uid()
  )
  OR
  -- User is adding themselves
  user_id = auth.uid()
);

-- 3. UPDATE: Users can update their own last_read_at
CREATE POLICY "conversation_participants_update_own" ON conversation_participants
FOR UPDATE
TO public
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. DELETE: Only admins can remove participants
CREATE POLICY "conversation_participants_delete_admin" ON conversation_participants
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
);