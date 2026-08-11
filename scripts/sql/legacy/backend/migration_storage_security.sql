-- =========================================================================
-- AuraSwap SQL Migration — Storage Security Hardening
-- =========================================================================
-- This script hardens policies on the storage.objects table.
-- Supabase Storage automatically manages RLS enabling for storage.objects.
-- This script creates secure bucket policy constraints for 'property-images'.
-- =========================================================================

-- 1. Public Select (Consolidated - Drop all potential duplicates and leave one)
DROP POLICY IF EXISTS "Public select property images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to property-images" ON storage.objects;
DROP POLICY IF EXISTS "Give public read access to property images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select" ON storage.objects;
DROP POLICY IF EXISTS "Access public property-images" ON storage.objects;

CREATE POLICY "Public read access to property images" ON storage.objects
  FOR SELECT USING (bucket_id = 'property-images');

-- 2. Authenticated Insert (Only signed-in users can upload images)
DROP POLICY IF EXISTS "Authenticated insert property images" ON storage.objects;
CREATE POLICY "Authenticated insert property images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-images' 
    AND auth.role() = 'authenticated'
  );

-- 3. Ownership update/delete (Only the uploader or Admins can modify or delete objects)
DROP POLICY IF EXISTS "Owner modify property images" ON storage.objects;
CREATE POLICY "Owner modify property images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'property-images'
    AND (owner = auth.uid() OR public.is_admin(auth.uid()))
  );
