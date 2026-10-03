-- Citizen photo evidence for incident reports.
--
-- The mobile app uploads compressed JPEGs directly to this bucket with
-- supabase-js Storage (authenticated, no service-role key on device) and
-- submits the public URLs as `photo_urls` inside the citizen_report payload.
-- Objects live at `report-evidence/<supabase_user_id>/<uuid>.jpg` so each
-- citizen can only write inside their own folder. The bucket is public so
-- operators and the dashboard can render evidence without signed URLs.
--
-- Apply with `supabase db push` (or paste into the Supabase SQL editor).
-- Until applied, the app still submits reports; photo uploads fail with an
-- actionable message and the report goes through without photos.

INSERT INTO storage.buckets (id, name, public)
VALUES ('report-evidence', 'report-evidence', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Citizens upload own evidence" ON storage.objects;
CREATE POLICY "Citizens upload own evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'report-evidence'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

DROP POLICY IF EXISTS "Public read evidence" ON storage.objects;
CREATE POLICY "Public read evidence"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'report-evidence');

DROP POLICY IF EXISTS "Citizens delete own evidence" ON storage.objects;
CREATE POLICY "Citizens delete own evidence"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'report-evidence'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
