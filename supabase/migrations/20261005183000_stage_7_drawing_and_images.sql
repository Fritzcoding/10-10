ALTER TABLE public.game_requests DROP CONSTRAINT game_requests_game_type_check;
ALTER TABLE public.game_requests ADD CONSTRAINT game_requests_game_type_check CHECK (game_type IN (
  'tic-tac-toe', 'would-you-rather', 'question-cards', 'whos-more-likely',
  'lie-detector', 'describe-without-saying-it', 'draw-together'
));
ALTER TABLE public.game_sessions DROP CONSTRAINT game_sessions_game_type_check;
ALTER TABLE public.game_sessions ADD CONSTRAINT game_sessions_game_type_check CHECK (game_type IN (
  'tic-tac-toe', 'would-you-rather', 'question-cards', 'whos-more-likely',
  'lie-detector', 'describe-without-saying-it', 'draw-together'
));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('couple-drawings', 'couple-drawings', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.drawing_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  duration_seconds integer NOT NULL DEFAULT 60 CHECK (duration_seconds BETWEEN 15 AND 600),
  reference_path text,
  started_at timestamptz,
  deadline_at timestamptz,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'waiting' AND started_at IS NULL AND deadline_at IS NULL) OR status <> 'waiting')
);

CREATE TABLE public.drawing_submissions (
  round_id uuid NOT NULL REFERENCES public.drawing_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, user_id)
);

ALTER TABLE public.drawing_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawing_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.drawing_rounds, public.drawing_submissions FROM anon, authenticated;
GRANT SELECT ON public.drawing_rounds, public.drawing_submissions TO authenticated;

CREATE FUNCTION private.can_access_drawing_session(target_session_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_sessions gs
    JOIN public.couple_members a ON a.user_id = gs.player_x_id
    JOIN public.couple_members b ON b.couple_id = a.couple_id AND b.user_id = gs.player_o_id
    WHERE gs.id::text = target_session_id AND gs.game_type = 'draw-together'
      AND gs.status IN ('active', 'completed') AND (SELECT auth.uid()) IN (gs.player_x_id, gs.player_o_id)
      AND (SELECT public.is_couple_member(a.couple_id))
  );
$$;
CREATE FUNCTION private.drawing_round_revealed(target_round_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.drawing_rounds r WHERE r.id = target_round_id
    AND (r.status = 'completed' OR r.deadline_at <= pg_catalog.now()));
$$;
CREATE FUNCTION private.drawing_session_revealed(target_session_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.drawing_rounds r WHERE r.session_id::text = target_session_id
    AND (r.status = 'completed' OR r.deadline_at <= pg_catalog.now()));
$$;
REVOKE ALL ON FUNCTION private.can_access_drawing_session(text), private.drawing_round_revealed(uuid), private.drawing_session_revealed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_access_drawing_session(text), private.drawing_round_revealed(uuid), private.drawing_session_revealed(text) TO authenticated;

CREATE POLICY "Couple players read drawing rounds" ON public.drawing_rounds FOR SELECT TO authenticated
  USING ((SELECT private.can_access_drawing_session(session_id::text)));
CREATE POLICY "Players read own or revealed drawings" ON public.drawing_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drawing_rounds r WHERE r.id = drawing_submissions.round_id
    AND (SELECT private.can_access_drawing_session(r.session_id::text))
    AND (drawing_submissions.user_id = (SELECT auth.uid()) OR (SELECT private.drawing_round_revealed(r.id)))));

CREATE FUNCTION private.initialize_drawing_round()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.game_type = 'draw-together' THEN
    INSERT INTO public.drawing_rounds (session_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.initialize_drawing_round() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER initialize_drawing_round AFTER INSERT ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION private.initialize_drawing_round();

CREATE FUNCTION public.set_drawing_reference(target_session_id uuid, target_reference_path text)
RETURNS public.drawing_rounds LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE round_row public.drawing_rounds; object_type text; object_size bigint;
BEGIN
  SELECT r.* INTO round_row FROM public.drawing_rounds r JOIN public.game_sessions gs ON gs.id = r.session_id
  WHERE gs.id = target_session_id AND gs.status = 'active' AND gs.game_type = 'draw-together'
    AND gs.player_x_id = (SELECT auth.uid()) AND r.status = 'waiting' FOR UPDATE OF r;
  IF round_row.id IS NULL THEN RAISE EXCEPTION 'Only the requester can set a reference before the drawing starts'; END IF;
  IF target_reference_path IS NOT NULL THEN
    IF target_reference_path NOT IN (target_session_id::text || '/reference.jpeg', target_session_id::text || '/reference.png', target_session_id::text || '/reference.webp') THEN
      RAISE EXCEPTION 'Reference image path is invalid';
    END IF;
    SELECT o.metadata->>'mimetype', (o.metadata->>'size')::bigint INTO object_type, object_size
    FROM storage.objects o WHERE o.bucket_id = 'couple-drawings' AND o.name = target_reference_path;
    IF object_type NOT IN ('image/jpeg', 'image/png', 'image/webp') OR object_size NOT BETWEEN 1 AND 5242880 THEN
      RAISE EXCEPTION 'Reference image is missing or invalid';
    END IF;
  END IF;
  UPDATE public.drawing_rounds SET reference_path = target_reference_path WHERE id = round_row.id RETURNING * INTO round_row;
  RETURN round_row;
END;
$$;
REVOKE ALL ON FUNCTION public.set_drawing_reference(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_drawing_reference(uuid, text) TO authenticated;

CREATE FUNCTION public.start_drawing_round(target_session_id uuid, target_duration_seconds integer, target_reference_path text DEFAULT NULL)
RETURNS public.drawing_rounds LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  session_row public.game_sessions;
  round_row public.drawing_rounds;
  object_type text;
  object_size bigint;
  selected_reference_path text;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Sign in before starting a drawing'; END IF;
  IF target_duration_seconds NOT BETWEEN 15 AND 600 THEN RAISE EXCEPTION 'Drawing duration must be between 15 and 600 seconds'; END IF;
  SELECT * INTO session_row FROM public.game_sessions gs WHERE gs.id = target_session_id
    AND gs.game_type = 'draw-together' AND caller_id = gs.player_x_id AND gs.status = 'active' FOR UPDATE;
  IF session_row.id IS NULL THEN RAISE EXCEPTION 'Only the player who sent this request can start the drawing'; END IF;
  SELECT * INTO round_row FROM public.drawing_rounds r WHERE r.session_id = target_session_id FOR UPDATE;
  IF round_row.id IS NULL OR round_row.status <> 'waiting' THEN RAISE EXCEPTION 'Drawing round has already started'; END IF;
  selected_reference_path := coalesce(target_reference_path, round_row.reference_path);
  IF selected_reference_path IS NOT NULL THEN
    IF selected_reference_path NOT IN (target_session_id::text || '/reference.jpeg', target_session_id::text || '/reference.png', target_session_id::text || '/reference.webp') THEN
      RAISE EXCEPTION 'Reference image path is invalid';
    END IF;
    SELECT o.metadata->>'mimetype', (o.metadata->>'size')::bigint INTO object_type, object_size
    FROM storage.objects o WHERE o.bucket_id = 'couple-drawings' AND o.name = selected_reference_path;
    IF object_type NOT IN ('image/jpeg', 'image/png', 'image/webp') OR object_size NOT BETWEEN 1 AND 5242880 THEN
      RAISE EXCEPTION 'Reference image is missing or invalid';
    END IF;
  END IF;
  UPDATE public.drawing_rounds SET duration_seconds = target_duration_seconds,
    reference_path = selected_reference_path, started_at = pg_catalog.now(),
    deadline_at = pg_catalog.now() + pg_catalog.make_interval(secs => target_duration_seconds), status = 'active'
  WHERE id = round_row.id RETURNING * INTO round_row;
  RETURN round_row;
END;
$$;
REVOKE ALL ON FUNCTION public.start_drawing_round(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_drawing_round(uuid, integer, text) TO authenticated;

CREATE FUNCTION public.submit_drawing(target_round_id uuid, target_image_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  round_row public.drawing_rounds;
  session_row public.game_sessions;
  object_type text;
  object_size bigint;
  submission_count integer;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Sign in before submitting a drawing'; END IF;
  SELECT r.* INTO round_row FROM public.drawing_rounds r JOIN public.game_sessions gs ON gs.id = r.session_id
  WHERE r.id = target_round_id AND gs.game_type = 'draw-together'
    AND (SELECT private.can_access_drawing_session(gs.id::text)) FOR UPDATE OF r;
  IF round_row.id IS NULL OR round_row.status <> 'active' OR round_row.deadline_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'Drawing round is no longer accepting submissions';
  END IF;
  SELECT gs.* INTO session_row FROM public.game_sessions gs WHERE gs.id = round_row.session_id;
  IF target_image_path <> round_row.session_id::text || '/drawings/' || caller_id::text || '.png' THEN
    RAISE EXCEPTION 'Drawing image path is invalid';
  END IF;
  SELECT o.metadata->>'mimetype', (o.metadata->>'size')::bigint INTO object_type, object_size
  FROM storage.objects o WHERE o.bucket_id = 'couple-drawings' AND o.name = target_image_path;
  IF object_type <> 'image/png' OR object_size NOT BETWEEN 1 AND 5242880 THEN RAISE EXCEPTION 'Drawing image is missing or invalid'; END IF;
  INSERT INTO public.drawing_submissions (round_id, user_id, image_path) VALUES (round_row.id, caller_id, target_image_path);
  SELECT pg_catalog.count(*)::integer INTO submission_count FROM public.drawing_submissions d WHERE d.round_id = round_row.id;
  IF submission_count = 2 THEN
    UPDATE public.drawing_rounds SET status = 'completed', completed_at = pg_catalog.now() WHERE id = round_row.id;
    UPDATE public.game_sessions SET status = 'completed', updated_at = pg_catalog.now(), revision = revision + 1 WHERE id = session_row.id;
  END IF;
  RETURN pg_catalog.jsonb_build_object('submitted', true, 'revealed', submission_count = 2, 'submission_count', submission_count);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_drawing(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_drawing(uuid, text) TO authenticated;

CREATE FUNCTION public.expire_drawing_round(target_round_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE round_row public.drawing_rounds; session_row public.game_sessions;
BEGIN
  SELECT r.* INTO round_row FROM public.drawing_rounds r WHERE r.id = target_round_id
    AND (SELECT private.can_access_drawing_session(r.session_id::text)) FOR UPDATE;
  IF round_row.id IS NULL THEN RAISE EXCEPTION 'Drawing round is unavailable'; END IF;
  IF round_row.status <> 'active' OR round_row.deadline_at > pg_catalog.now() THEN RETURN false; END IF;
  UPDATE public.drawing_rounds SET status = 'completed', completed_at = pg_catalog.now() WHERE id = round_row.id;
  UPDATE public.game_sessions SET status = 'completed', updated_at = pg_catalog.now(), revision = revision + 1 WHERE id = round_row.session_id RETURNING * INTO session_row;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_drawing_round(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_drawing_round(uuid) TO authenticated;

CREATE POLICY "Couple members read drawing files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'couple-drawings' AND split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    AND (SELECT private.can_access_drawing_session(split_part(name, '/', 1)))
    AND ((split_part(name, '/', 2) IN ('reference.jpeg', 'reference.png', 'reference.webp') AND split_part(name, '/', 3) = '')
      OR (split_part(name, '/', 2) = 'drawings' AND split_part(name, '/', 4) = ''
        AND split_part(name, '/', 3) = (SELECT auth.uid())::text || '.png'
        OR split_part(name, '/', 2) = 'drawings' AND split_part(name, '/', 4) = ''
        AND (SELECT private.drawing_session_revealed(split_part(name, '/', 1))))));
CREATE POLICY "Drawing requester uploads references" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'couple-drawings' AND split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    AND split_part(name, '/', 2) IN ('reference.jpeg', 'reference.png', 'reference.webp')
    AND split_part(name, '/', 3) = ''
    AND EXISTS (SELECT 1 FROM public.game_sessions gs JOIN public.drawing_rounds r ON r.session_id = gs.id
      WHERE gs.id::text = split_part(name, '/', 1) AND gs.status = 'active' AND gs.player_x_id = (SELECT auth.uid()) AND r.status = 'waiting'))
  OR (bucket_id = 'couple-drawings' AND split_part(name, '/', 2) = 'drawings'
    AND split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    AND split_part(name, '/', 4) = ''
    AND split_part(name, '/', 3) = (SELECT auth.uid())::text || '.png'
    AND EXISTS (SELECT 1 FROM public.game_sessions gs JOIN public.drawing_rounds r ON r.session_id = gs.id
      WHERE gs.id::text = split_part(name, '/', 1) AND (SELECT private.can_access_drawing_session(gs.id::text))
        AND r.status = 'active' AND r.deadline_at > pg_catalog.now())));
CREATE POLICY "Drawing requester updates reference images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'couple-drawings' AND split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    AND split_part(name, '/', 2) IN ('reference.jpeg', 'reference.png', 'reference.webp') AND split_part(name, '/', 3) = ''
    AND EXISTS (SELECT 1 FROM public.game_sessions gs JOIN public.drawing_rounds r ON r.session_id = gs.id
      WHERE gs.id::text = split_part(name, '/', 1) AND gs.player_x_id = (SELECT auth.uid()) AND r.status = 'waiting'))
  WITH CHECK (bucket_id = 'couple-drawings' AND split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    AND split_part(name, '/', 2) IN ('reference.jpeg', 'reference.png', 'reference.webp') AND split_part(name, '/', 3) = ''
    AND EXISTS (SELECT 1 FROM public.game_sessions gs JOIN public.drawing_rounds r ON r.session_id = gs.id
      WHERE gs.id::text = split_part(name, '/', 1) AND gs.player_x_id = (SELECT auth.uid()) AND r.status = 'waiting'));
CREATE POLICY "Players can remove their own drawing files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'couple-drawings' AND ((split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
    AND split_part(name, '/', 2) IN ('reference.jpeg', 'reference.png', 'reference.webp') AND split_part(name, '/', 3) = ''
    AND EXISTS (SELECT 1 FROM public.game_sessions gs JOIN public.drawing_rounds r ON r.session_id = gs.id
      WHERE gs.id::text = split_part(name, '/', 1) AND gs.player_x_id = (SELECT auth.uid()) AND r.status = 'waiting')
    OR split_part(name, '/', 2) = 'drawings' AND split_part(name, '/', 4) = '' AND split_part(name, '/', 3) = (SELECT auth.uid())::text || '.png'
      AND (SELECT private.can_access_drawing_session(split_part(name, '/', 1))))));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'drawing_rounds') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.drawing_rounds;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'drawing_submissions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.drawing_submissions;
  END IF;
END;
$$;
