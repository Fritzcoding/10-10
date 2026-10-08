CREATE TABLE private.scheduled_surprises (
  id uuid PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surprise_type text NOT NULL CHECK (surprise_type IN ('note','question','photo','challenge','activity')),
  release_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  photo_path text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CHECK ((surprise_type = 'photo' AND photo_path IS NOT NULL) OR (surprise_type <> 'photo' AND photo_path IS NULL)),
  CHECK (photo_path IS NULL OR photo_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')),
  CHECK (surprise_type = 'photo' OR (payload ->> 'text' IS NOT NULL AND length(pg_catalog.btrim(payload ->> 'text')) BETWEEN 1 AND 2000)),
  CHECK (surprise_type <> 'photo' OR length(COALESCE(payload ->> 'text','')) <= 500)
);
CREATE INDEX scheduled_surprises_couple_release ON private.scheduled_surprises(couple_id, release_at) WHERE status = 'scheduled';
ALTER TABLE private.scheduled_surprises ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.scheduled_surprises FROM PUBLIC, anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('scheduled-surprise-photos','scheduled-surprise-photos',false,8388608,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 8388608, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

CREATE FUNCTION public.can_read_scheduled_surprise_photo(target_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.scheduled_surprises s
    WHERE s.photo_path = target_path AND s.status = 'scheduled'
      AND s.release_at <= pg_catalog.now() AND public.is_couple_member(s.couple_id)
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_scheduled_surprise_photo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_scheduled_surprise_photo(text) TO authenticated;

CREATE POLICY "Users upload bounded surprise photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scheduled-surprise-photos' AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
CREATE POLICY "Released surprise photos are visible to the couple" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'scheduled-surprise-photos' AND public.can_read_scheduled_surprise_photo(name));
CREATE POLICY "Owners remove their surprise photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'scheduled-surprise-photos' AND owner_id = (SELECT auth.uid())::text);

CREATE FUNCTION public.schedule_surprise(
  target_id uuid, target_type text, target_release_at timestamptz, target_payload jsonb, target_photo_path text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := (SELECT auth.uid()); target_couple_id uuid; inserted_count integer;
BEGIN
  SELECT cm.couple_id INTO target_couple_id FROM public.couple_members cm WHERE cm.user_id = caller_id;
  IF caller_id IS NULL OR target_couple_id IS NULL THEN RAISE EXCEPTION 'Couple membership required'; END IF;
  IF target_release_at IS NULL OR target_release_at <= pg_catalog.now() THEN RAISE EXCEPTION 'Release time must be in the future'; END IF;
  IF target_type IS NULL OR target_type NOT IN ('note','question','photo','challenge','activity') OR target_payload IS NULL OR pg_catalog.jsonb_typeof(target_payload) <> 'object' THEN RAISE EXCEPTION 'Invalid surprise'; END IF;
  IF target_type = 'photo' THEN
    IF target_photo_path IS NULL OR target_photo_path !~ ('^' || target_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
      OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'scheduled-surprise-photos' AND o.name = target_photo_path AND o.owner_id = caller_id::text)
      THEN RAISE EXCEPTION 'Upload a valid surprise photo first'; END IF;
    IF length(COALESCE(target_payload ->> 'text','')) > 500 THEN RAISE EXCEPTION 'Photo caption is too long'; END IF;
  ELSIF target_payload ->> 'text' IS NULL OR pg_catalog.length(pg_catalog.btrim(target_payload ->> 'text')) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Surprise text must be between 1 and 2000 characters';
  END IF;
  INSERT INTO private.scheduled_surprises(id,couple_id,created_by,surprise_type,release_at,payload,photo_path)
    VALUES (target_id,target_couple_id,caller_id,target_type,target_release_at,target_payload,target_photo_path)
    ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count = 0 AND NOT EXISTS (
    SELECT 1 FROM private.scheduled_surprises s WHERE s.id = target_id AND s.couple_id = target_couple_id
      AND s.created_by = caller_id AND s.surprise_type = target_type AND s.release_at = target_release_at
      AND s.payload = target_payload AND s.photo_path IS NOT DISTINCT FROM target_photo_path AND s.status = 'scheduled'
  ) THEN RAISE EXCEPTION 'Unable to schedule surprise'; END IF;
  RETURN target_id;
END;
$$;
REVOKE ALL ON FUNCTION public.schedule_surprise(uuid,text,timestamptz,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_surprise(uuid,text,timestamptz,jsonb,text) TO authenticated;

CREATE FUNCTION public.cancel_scheduled_surprise(target_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := (SELECT auth.uid());
BEGIN
  UPDATE private.scheduled_surprises SET status = 'cancelled', updated_at = pg_catalog.now()
    WHERE id = target_id AND created_by = caller_id AND status = 'scheduled' AND release_at > pg_catalog.now()
      AND public.is_couple_member(couple_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Only your unreleased surprise can be cancelled'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_scheduled_surprise(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_surprise(uuid) TO authenticated;

CREATE FUNCTION public.get_released_surprises()
RETURNS TABLE(id uuid,couple_id uuid,created_by uuid,surprise_type text,release_at timestamptz,payload jsonb,photo_path text,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.id,s.couple_id,s.created_by,s.surprise_type,s.release_at,s.payload,s.photo_path,s.created_at
  FROM private.scheduled_surprises s WHERE s.status = 'scheduled' AND s.release_at <= pg_catalog.now()
    AND public.is_couple_member(s.couple_id) ORDER BY s.release_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_released_surprises() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_released_surprises() TO authenticated;

CREATE FUNCTION public.get_my_pending_surprises()
RETURNS TABLE(id uuid,surprise_type text,release_at timestamptz,created_at timestamptz,photo_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.id,s.surprise_type,s.release_at,s.created_at,s.photo_path FROM private.scheduled_surprises s
  WHERE s.created_by = (SELECT auth.uid()) AND s.status = 'scheduled' AND s.release_at > pg_catalog.now()
    AND public.is_couple_member(s.couple_id) ORDER BY s.release_at;
$$;
REVOKE ALL ON FUNCTION public.get_my_pending_surprises() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_pending_surprises() TO authenticated;
