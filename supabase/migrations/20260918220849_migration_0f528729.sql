-- Add soft delete support to store_items table
ALTER TABLE store_items 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_store_items_deleted_at ON store_items(deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN store_items.deleted_at IS 'Soft delete timestamp - NULL means active';
COMMENT ON COLUMN store_items.deleted_by IS 'User who deleted the item';