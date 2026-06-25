-- Create the public storage bucket for product images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'product-images' bucket

-- 1. Allow public select access to the product-images bucket
CREATE POLICY "Allow public read access to product-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- 2. Allow authenticated users (sellers) to insert objects into their own folder
CREATE POLICY "Allow authenticated users to upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow authenticated users (sellers) to update objects in their own folder
CREATE POLICY "Allow authenticated users to update their own product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Allow authenticated users (sellers) to delete objects in their own folder
CREATE POLICY "Allow authenticated users to delete their own product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
