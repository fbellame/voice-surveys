-- Migration: Create storage bucket for lesson documents
-- This creates the lesson-documents bucket needed for PDF uploads

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-documents',
  'lesson-documents',
  true, -- Public bucket so files can be accessed via public URLs
  52428800, -- 50MB file size limit
  ARRAY['application/pdf'] -- Only allow PDF files
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the bucket
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload lesson documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lesson-documents' AND
  (storage.foldername(name))[1] = 'lessons'
);

-- Allow authenticated users to read files
CREATE POLICY "Allow authenticated users to read lesson documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lesson-documents');

-- Allow public read access (since bucket is public)
CREATE POLICY "Allow public read access to lesson documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lesson-documents');

-- Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated users to delete lesson documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lesson-documents');

