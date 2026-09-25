-- Create storage bucket for store items
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-images',
  'store-images',
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Set storage policies for store-images bucket
CREATE POLICY "Public read access for store images"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-images');

CREATE POLICY "Authenticated users can upload store images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'store-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their uploaded store images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'store-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete store images"
ON storage.objects FOR DELETE
USING (bucket_id = 'store-images' AND auth.role() = 'authenticated');