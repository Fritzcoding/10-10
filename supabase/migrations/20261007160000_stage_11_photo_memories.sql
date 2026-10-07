INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('couple-memories', 'couple-memories', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

CREATE TABLE public.photo_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  object_path text NOT NULL UNIQUE,
  caption text NOT NULL DEFAULT '' CHECK (length(caption) <= 500),
  memory_date date NOT NULL,
  timeline_event_id uuid REFERENCES public.relationship_timeline(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (object_path ~ ('^' || couple_id::text || '/[0-9a-fA-F-]{36}\.(jpg|png|webp)$'))
);
CREATE INDEX photo_memories_couple_date ON public.photo_memories(couple_id, memory_date DESC);
ALTER TABLE public.photo_memories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.photo_memories FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.photo_memories TO authenticated;
GRANT INSERT (couple_id, object_path, caption, memory_date, timeline_event_id) ON public.photo_memories TO authenticated;
GRANT UPDATE (caption, memory_date, timeline_event_id) ON public.photo_memories TO authenticated;
CREATE POLICY "Couples manage their photo memories" ON public.photo_memories FOR ALL TO authenticated
  USING ((SELECT public.is_couple_member(couple_id))) WITH CHECK ((SELECT public.is_couple_member(couple_id)));

CREATE FUNCTION public.validate_photo_memory_timeline_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.timeline_event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.relationship_timeline t
    WHERE t.id = NEW.timeline_event_id AND t.couple_id = NEW.couple_id
  ) THEN RAISE EXCEPTION 'Timeline entry must belong to this couple'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_photo_memory_timeline_link() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_photo_memory_timeline_link BEFORE INSERT OR UPDATE ON public.photo_memories
  FOR EACH ROW EXECUTE FUNCTION public.validate_photo_memory_timeline_link();

CREATE POLICY "Couples read their photo memory files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'couple-memories'
    AND CASE WHEN name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|png|webp)$'
      THEN (SELECT public.is_couple_member(split_part(name, '/', 1)::uuid)) ELSE false END);
CREATE POLICY "Couples upload photo memory files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'couple-memories'
    AND CASE WHEN name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|png|webp)$'
      THEN (SELECT public.is_couple_member(split_part(name, '/', 1)::uuid)) ELSE false END);
CREATE POLICY "Couples delete their photo memory files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'couple-memories'
    AND CASE WHEN name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(jpg|png|webp)$'
      THEN (SELECT public.is_couple_member(split_part(name, '/', 1)::uuid)) ELSE false END);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'photo_memories') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_memories;
  END IF;
END $$;
