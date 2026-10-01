ALTER TABLE public.game_requests
  DROP CONSTRAINT game_requests_game_type_check,
  ADD CONSTRAINT game_requests_game_type_check
    CHECK (game_type IN ('tic-tac-toe', 'would-you-rather'));

ALTER TABLE public.game_sessions
  DROP CONSTRAINT game_sessions_game_type_check,
  ADD CONSTRAINT game_sessions_game_type_check
    CHECK (game_type IN ('tic-tac-toe', 'would-you-rather')),
  DROP CONSTRAINT game_sessions_status_check,
  ADD CONSTRAINT game_sessions_status_check
    CHECK (status IN ('active', 'won', 'draw', 'abandoned', 'completed')),
  ADD COLUMN deadline_at timestamptz;

CREATE TABLE public.game_submissions (
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer text NOT NULL CHECK (answer IN ('left', 'right')),
  submitted_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (session_id, user_id)
);

ALTER TABLE public.game_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_submissions FROM anon, authenticated;
GRANT SELECT ON TABLE public.game_submissions TO authenticated;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE FUNCTION private.game_submissions_revealed(target_session_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.game_sessions gs
    WHERE gs.id = target_session_id
      AND gs.game_type = 'would-you-rather'
      AND public.are_couple_members(gs.player_x_id)
      AND public.are_couple_members(gs.player_o_id)
      AND (
        (SELECT count(*) FROM public.game_submissions s WHERE s.session_id = gs.id) = 2
        OR gs.deadline_at <= pg_catalog.now()
      )
  );
$$;
REVOKE ALL ON FUNCTION private.game_submissions_revealed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.game_submissions_revealed(uuid) TO authenticated;

CREATE POLICY "Participants read own or revealed game submissions"
  ON public.game_submissions FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      (SELECT private.game_submissions_revealed(game_submissions.session_id))
      AND EXISTS (
        SELECT 1
        FROM public.game_sessions gs
        WHERE gs.id = game_submissions.session_id
          AND (SELECT auth.uid()) IN (gs.player_x_id, gs.player_o_id)
          AND (SELECT public.are_couple_members(gs.player_x_id))
          AND (SELECT public.are_couple_members(gs.player_o_id))
      )
    )
  );

DROP FUNCTION public.create_game_request(uuid);
CREATE FUNCTION public.create_game_request(
  target_recipient_id uuid,
  target_game_type text DEFAULT 'tic-tac-toe'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  request_row public.game_requests;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before sending a game request';
  END IF;
  IF target_game_type IS NULL OR target_game_type NOT IN ('tic-tac-toe', 'would-you-rather') THEN
    RAISE EXCEPTION 'Game type is invalid';
  END IF;
  IF caller_id = target_recipient_id OR NOT public.are_couple_members(target_recipient_id) THEN
    RAISE EXCEPTION 'Game requests are limited to your partner';
  END IF;

  UPDATE public.game_requests gr
  SET status = 'expired', updated_at = pg_catalog.now()
  WHERE gr.requester_id = caller_id
    AND gr.recipient_id = target_recipient_id
    AND gr.game_type = target_game_type
    AND gr.status = 'pending'
    AND gr.expires_at <= pg_catalog.now();

  SELECT gr.* INTO request_row
  FROM public.game_requests gr
  WHERE gr.requester_id = caller_id
    AND gr.recipient_id = target_recipient_id
    AND gr.game_type = target_game_type
    AND gr.status = 'pending'
    AND gr.expires_at > pg_catalog.now();

  IF request_row.id IS NOT NULL THEN
    RETURN pg_catalog.to_jsonb(request_row) || pg_catalog.jsonb_build_object('wasExisting', true);
  END IF;

  INSERT INTO public.game_requests (requester_id, recipient_id, game_type)
  VALUES (caller_id, target_recipient_id, target_game_type)
  ON CONFLICT (requester_id, recipient_id, game_type) WHERE status = 'pending' DO NOTHING
  RETURNING * INTO request_row;

  IF request_row.id IS NULL THEN
    SELECT gr.* INTO request_row
    FROM public.game_requests gr
    WHERE gr.requester_id = caller_id
      AND gr.recipient_id = target_recipient_id
      AND gr.game_type = target_game_type
      AND gr.status = 'pending';
    RETURN pg_catalog.to_jsonb(request_row) || pg_catalog.jsonb_build_object('wasExisting', true);
  END IF;

  RETURN pg_catalog.to_jsonb(request_row);
END;
$$;
REVOKE ALL ON FUNCTION public.create_game_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game_request(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_game_request(target_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  request_row public.game_requests;
  session_row public.game_sessions;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before accepting a game request';
  END IF;

  SELECT gr.* INTO request_row
  FROM public.game_requests gr
  WHERE gr.id = target_request_id
    AND gr.recipient_id = caller_id
    AND gr.status = 'pending'
    AND gr.expires_at > pg_catalog.now()
  FOR UPDATE;

  IF request_row.id IS NULL OR NOT public.are_couple_members(request_row.requester_id) THEN
    RAISE EXCEPTION 'Game request is no longer active';
  END IF;

  UPDATE public.game_requests
  SET status = 'accepted', updated_at = pg_catalog.now()
  WHERE id = target_request_id;

  INSERT INTO public.game_sessions (game_type, player_x_id, player_o_id, deadline_at)
  VALUES (
    request_row.game_type,
    request_row.requester_id,
    request_row.recipient_id,
    CASE WHEN request_row.game_type = 'would-you-rather' THEN pg_catalog.now() + interval '5 minutes' END
  )
  RETURNING * INTO session_row;

  RETURN pg_catalog.jsonb_build_object('request', pg_catalog.to_jsonb(request_row), 'session_id', session_row.id);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_game_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_game_request(uuid) TO authenticated;

CREATE FUNCTION public.submit_hidden_game_answer(target_session_id uuid, target_answer text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  session_row public.game_sessions;
  submission_count integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before submitting an answer';
  END IF;

  SELECT gs.* INTO session_row
  FROM public.game_sessions gs
  WHERE gs.id = target_session_id
  FOR UPDATE;

  IF session_row.id IS NULL
    OR session_row.game_type <> 'would-you-rather'
    OR caller_id NOT IN (session_row.player_x_id, session_row.player_o_id)
    OR NOT public.are_couple_members(session_row.player_x_id)
    OR NOT public.are_couple_members(session_row.player_o_id) THEN
    RAISE EXCEPTION 'Game session is unavailable';
  END IF;
  IF session_row.status <> 'active' THEN
    RAISE EXCEPTION 'Game round is completed';
  END IF;
  IF session_row.deadline_at IS NULL OR session_row.deadline_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'Game deadline has passed';
  END IF;
  IF target_answer IS NULL OR target_answer NOT IN ('left', 'right') THEN
    RAISE EXCEPTION 'Answer is invalid';
  END IF;

  INSERT INTO public.game_submissions (session_id, user_id, answer)
  VALUES (target_session_id, caller_id, target_answer);

  SELECT pg_catalog.count(*)::integer INTO submission_count
  FROM public.game_submissions s
  WHERE s.session_id = target_session_id;

  IF submission_count = 2 THEN
    UPDATE public.game_sessions
    SET status = 'completed', updated_at = pg_catalog.now()
    WHERE id = target_session_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'submitted', true,
    'revealed', submission_count = 2,
    'submission_count', submission_count
  );
END;
$$;
REVOKE ALL ON FUNCTION public.submit_hidden_game_answer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_hidden_game_answer(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.generate_profile_uid() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.submit_tic_tac_toe_move(uuid, integer, integer) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.submit_tic_tac_toe_move(uuid, integer, integer) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.submit_tic_tac_toe_move(
  target_session_id uuid,
  target_revision integer,
  target_cell integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  session_row public.game_sessions;
BEGIN
  SELECT gs.* INTO session_row
  FROM public.game_sessions gs
  WHERE gs.id = target_session_id;

  IF session_row.id IS NULL
    OR NOT public.are_couple_members(session_row.player_x_id)
    OR NOT public.are_couple_members(session_row.player_o_id) THEN
    RAISE EXCEPTION 'Game session is unavailable';
  END IF;
  IF session_row.game_type <> 'tic-tac-toe' THEN
    RAISE EXCEPTION 'This session is not a Tic-Tac-Toe game';
  END IF;

  RETURN private.submit_tic_tac_toe_move(target_session_id, target_revision, target_cell);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_tic_tac_toe_move(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_tic_tac_toe_move(uuid, integer, integer) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_submissions;
  END IF;
END;
$$;
