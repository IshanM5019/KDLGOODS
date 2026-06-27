-- Migration: Add storage configuration for user avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for public avatars
DROP POLICY IF EXISTS "Public Avatar Access" ON storage.objects;
CREATE POLICY "Public Avatar Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow User Upload Avatars" ON storage.objects;
CREATE POLICY "Allow User Upload Avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow User Update Avatars" ON storage.objects;
CREATE POLICY "Allow User Update Avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars');
