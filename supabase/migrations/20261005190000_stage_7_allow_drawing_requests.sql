CREATE OR REPLACE FUNCTION public.create_game_request(target_recipient_id uuid, target_game_type text DEFAULT 'tic-tac-toe')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  request_row public.game_requests;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Sign in before sending a game request'; END IF;
  IF target_game_type IS NULL OR target_game_type NOT IN ('tic-tac-toe', 'would-you-rather', 'question-cards', 'whos-more-likely', 'lie-detector', 'describe-without-saying-it', 'draw-together') THEN
    RAISE EXCEPTION 'Game type is invalid';
  END IF;
  IF caller_id = target_recipient_id OR NOT public.are_couple_members(target_recipient_id) THEN
    RAISE EXCEPTION 'Game requests are limited to your partner';
  END IF;
  UPDATE public.game_requests gr SET status = 'expired', updated_at = pg_catalog.now()
  WHERE gr.requester_id = caller_id AND gr.recipient_id = target_recipient_id AND gr.game_type = target_game_type AND gr.status = 'pending' AND gr.expires_at <= pg_catalog.now();
  SELECT gr.* INTO request_row FROM public.game_requests gr
  WHERE gr.requester_id = caller_id AND gr.recipient_id = target_recipient_id AND gr.game_type = target_game_type AND gr.status = 'pending' AND gr.expires_at > pg_catalog.now();
  IF request_row.id IS NOT NULL THEN RETURN pg_catalog.to_jsonb(request_row) || pg_catalog.jsonb_build_object('wasExisting', true); END IF;
  INSERT INTO public.game_requests (requester_id, recipient_id, game_type)
  VALUES (caller_id, target_recipient_id, target_game_type)
  ON CONFLICT (requester_id, recipient_id, game_type) WHERE status = 'pending' DO NOTHING
  RETURNING * INTO request_row;
  IF request_row.id IS NULL THEN
    SELECT gr.* INTO request_row FROM public.game_requests gr
    WHERE gr.requester_id = caller_id AND gr.recipient_id = target_recipient_id AND gr.game_type = target_game_type AND gr.status = 'pending';
    RETURN pg_catalog.to_jsonb(request_row) || pg_catalog.jsonb_build_object('wasExisting', true);
  END IF;
  RETURN pg_catalog.to_jsonb(request_row);
END;
$$;
REVOKE ALL ON FUNCTION public.create_game_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game_request(uuid, text) TO authenticated;
