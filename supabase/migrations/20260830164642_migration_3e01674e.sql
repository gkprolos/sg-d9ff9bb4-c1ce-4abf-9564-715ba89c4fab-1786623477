-- Fix conversation_participants primary key issue
-- Drop existing PK, add ID column, make user_id and parent_email nullable

-- Step 1: Drop existing primary key
ALTER TABLE conversation_participants
  DROP CONSTRAINT IF EXISTS conversation_participants_pkey;

-- Step 2: Add ID column as new primary key
ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY;

-- Step 3: Make user_id and parent_email nullable
ALTER TABLE conversation_participants
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN parent_email DROP NOT NULL;

-- Step 4: Add check constraint - at least one must be present
ALTER TABLE conversation_participants
  DROP CONSTRAINT IF EXISTS participant_identity_check;
  
ALTER TABLE conversation_participants
  ADD CONSTRAINT participant_identity_check 
  CHECK (
    (user_id IS NOT NULL AND parent_email IS NULL) OR
    (user_id IS NULL AND parent_email IS NOT NULL)
  );

-- Step 5: Add unique constraint to prevent duplicate participants
ALTER TABLE conversation_participants
  DROP CONSTRAINT IF EXISTS conversation_participants_unique;

CREATE UNIQUE INDEX IF NOT EXISTS conversation_participants_unique_user
  ON conversation_participants(conversation_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversation_participants_unique_parent
  ON conversation_participants(conversation_id, parent_email)
  WHERE parent_email IS NOT NULL;