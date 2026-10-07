INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('couple-voice-memos', 'couple-voice-memos', false, 5242880, ARRAY['audio/webm', 'audio/mp4', 'audio/ogg'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['audio/webm', 'audio/mp4', 'audio/ogg'];

CREATE TABLE public.love_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 2000),
  audio_path text,
  audio_duration_ms integer,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (audio_path IS NULL AND audio_duration_ms IS NULL) OR
    (audio_duration_ms BETWEEN 1 AND 60000 AND audio_path ~ ('^' || couple_id::text || '/[0-9a-fA-F-]{36}\.(webm|mp4|ogg)$'))
  )
);
CREATE INDEX love_notes_couple_created ON public.love_notes(couple_id, created_at DESC);
ALTER TABLE public.love_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.love_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.love_notes TO authenticated;
GRANT INSERT (couple_id, content) ON public.love_notes TO authenticated;
GRANT UPDATE (content, audio_path, audio_duration_ms) ON public.love_notes TO authenticated;
CREATE POLICY "Couples manage their love notes" ON public.love_notes FOR ALL TO authenticated
  USING ((SELECT public.is_couple_member(couple_id))) WITH CHECK ((SELECT public.is_couple_member(couple_id)));

CREATE POLICY "Couples read their voice memo files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'couple-voice-memos'
    AND CASE WHEN name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(webm|mp4|ogg)$'
      THEN (SELECT public.is_couple_member(split_part(name, '/', 1)::uuid)) ELSE false END);
CREATE POLICY "Couples upload voice memo files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'couple-voice-memos'
    AND CASE WHEN name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(webm|mp4|ogg)$'
      THEN (SELECT public.is_couple_member(split_part(name, '/', 1)::uuid)) ELSE false END);
CREATE POLICY "Couples delete their voice memo files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'couple-voice-memos'
    AND CASE WHEN name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(webm|mp4|ogg)$'
      THEN (SELECT public.is_couple_member(split_part(name, '/', 1)::uuid)) ELSE false END);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'love_notes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.love_notes;
  END IF;
END $$;
