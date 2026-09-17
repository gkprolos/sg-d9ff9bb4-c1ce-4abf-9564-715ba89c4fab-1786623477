-- Create Supabase Storage bucket for store item images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-items',
  'store-items',
  true,
  5242880, -- 5 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Admin & Coach can upload
DROP POLICY IF EXISTS "Admin and Coach can upload store images" ON storage.objects;
CREATE POLICY "Admin and Coach can upload store images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'store-items'
  AND auth.uid() IN (
    SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
  )
);

-- RLS Policy: Admin & Coach can update
DROP POLICY IF EXISTS "Admin and Coach can update store images" ON storage.objects;
CREATE POLICY "Admin and Coach can update store images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'store-items'
  AND auth.uid() IN (
    SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
  )
);

-- RLS Policy: Admin & Coach can delete
DROP POLICY IF EXISTS "Admin and Coach can delete store images" ON storage.objects;
CREATE POLICY "Admin and Coach can delete store images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'store-items'
  AND auth.uid() IN (
    SELECT user_id FROM user_roles WHERE role IN ('admin', 'coach')
  )
);

-- RLS Policy: Public read for all (parents can see images)
DROP POLICY IF EXISTS "Public read for store images" ON storage.objects;
CREATE POLICY "Public read for store images"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-items');