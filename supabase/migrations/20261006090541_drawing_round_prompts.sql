ALTER TABLE public.drawing_rounds ADD COLUMN subject text;
ALTER TABLE public.drawing_rounds ADD COLUMN category text;
ALTER TABLE public.drawing_rounds ADD CONSTRAINT drawing_round_prompt_length_check CHECK (
  (subject IS NULL OR (subject = pg_catalog.btrim(subject) AND pg_catalog.char_length(subject) BETWEEN 1 AND 120))
  AND (category IS NULL OR (category = pg_catalog.btrim(category) AND pg_catalog.char_length(category) BETWEEN 1 AND 60))
);

DROP FUNCTION public.start_drawing_round(uuid, integer, text);

CREATE FUNCTION public.start_drawing_round(
  target_session_id uuid,
  target_duration_seconds integer,
  target_subject text,
  target_category text,
  target_reference_path text DEFAULT NULL
)
RETURNS public.drawing_rounds LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  session_row public.game_sessions;
  round_row public.drawing_rounds;
  object_type text;
  object_size bigint;
  selected_reference_path text;
  selected_subject text := pg_catalog.btrim(target_subject);
  selected_category text := pg_catalog.btrim(target_category);
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Sign in before starting a drawing'; END IF;
  IF target_duration_seconds IS NULL OR target_duration_seconds NOT BETWEEN 15 AND 600 THEN RAISE EXCEPTION 'Drawing duration must be between 15 and 600 seconds'; END IF;
  IF selected_subject IS NULL OR pg_catalog.char_length(selected_subject) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Drawing subject must be between 1 and 120 characters'; END IF;
  IF selected_category IS NULL OR pg_catalog.char_length(selected_category) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Drawing category must be between 1 and 60 characters'; END IF;
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
    subject = selected_subject, category = selected_category,
    reference_path = selected_reference_path, started_at = pg_catalog.now(),
    deadline_at = pg_catalog.now() + pg_catalog.make_interval(secs => target_duration_seconds), status = 'active'
  WHERE id = round_row.id RETURNING * INTO round_row;
  RETURN round_row;
END;
$$;
REVOKE ALL ON FUNCTION public.start_drawing_round(uuid, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_drawing_round(uuid, integer, text, text, text) TO authenticated;
