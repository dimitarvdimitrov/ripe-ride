-- RLS is already enabled on storage.objects by default
-- Create policy to allow service role full access (for backend operations)
CREATE POLICY "Service role can manage all files" ON storage.objects
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Create policy to allow authenticated users to read their own GPX files
CREATE POLICY "Users can read own GPX files" ON storage.objects
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'gpx_files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow authenticated users to insert their own GPX files
CREATE POLICY "Users can insert own GPX files" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'gpx_files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow authenticated users to update their own GPX files
CREATE POLICY "Users can update own GPX files" ON storage.objects
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'gpx_files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'gpx_files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow authenticated users to delete their own GPX files
CREATE POLICY "Users can delete own GPX files" ON storage.objects
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'gpx_files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Ensure the gpx_files bucket exists with proper configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gpx_files', 
  'gpx_files', 
  false, 
  52428800, -- 50MB limit
  ARRAY['application/gpx+xml', 'text/xml', 'application/xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/gpx+xml', 'text/xml', 'application/xml'];