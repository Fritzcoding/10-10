ALTER TABLE public.game_requests
  DROP CONSTRAINT game_requests_game_type_check,
  ADD CONSTRAINT game_requests_game_type_check CHECK (game_type IN (
    'tic-tac-toe', 'would-you-rather', 'question-cards', 'whos-more-likely',
    'lie-detector', 'describe-without-saying-it'
  ));
ALTER TABLE public.game_sessions
  DROP CONSTRAINT game_sessions_game_type_check,
  ADD CONSTRAINT game_sessions_game_type_check CHECK (game_type IN (
    'tic-tac-toe', 'would-you-rather', 'question-cards', 'whos-more-likely',
    'lie-detector', 'describe-without-saying-it'
  )),
  ADD COLUMN current_round smallint NOT NULL DEFAULT 1 CHECK (current_round IN (1, 2));

CREATE TABLE public.game_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid REFERENCES public.couples(id) ON DELETE CASCADE,
  game_type text NOT NULL CHECK (game_type IN ('question-cards', 'whos-more-likely', 'describe-without-saying-it')),
  category text NOT NULL,
  prompt text NOT NULL CHECK (length(pg_catalog.btrim(prompt)) BETWEEN 1 AND 280),
  forbidden_words text[] NOT NULL DEFAULT ARRAY[]::text[],
  source_type text NOT NULL CHECK (source_type IN ('original', 'couple')),
  source_name text NOT NULL,
  source_license text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CHECK (
    (source_type = 'original' AND couple_id IS NULL AND created_by IS NULL)
    OR (source_type = 'couple' AND couple_id IS NOT NULL AND created_by IS NOT NULL AND game_type = 'question-cards')
  )
);
CREATE INDEX game_prompts_game_category ON public.game_prompts (game_type, category);
ALTER TABLE public.game_prompts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_prompts FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.game_prompts TO authenticated;
CREATE POLICY "Read shared or couple prompts"
  ON public.game_prompts FOR SELECT TO authenticated
  USING (
    game_type <> 'describe-without-saying-it'
    AND ((source_type = 'original' AND couple_id IS NULL) OR public.is_couple_member(couple_id))
  );
CREATE POLICY "Couples create their own questions"
  ON public.game_prompts FOR INSERT TO authenticated
  WITH CHECK (
    source_type = 'couple'
    AND game_type = 'question-cards'
    AND created_by = (SELECT auth.uid())
    AND public.is_couple_member(couple_id)
  );

INSERT INTO public.game_prompts (game_type, category, prompt, source_type, source_name, source_license) VALUES
  ('question-cards', 'Getting to know each other', 'What small thing can turn an ordinary day into a good one for you?', 'original', 'Couple App original seed', 'Created for this app'),
  ('question-cards', 'Getting to know each other', 'What is something you would love to learn, just for fun?', 'original', 'Couple App original seed', 'Created for this app'),
  ('question-cards', 'Getting to know each other', 'When do you feel most like yourself?', 'original', 'Couple App original seed', 'Created for this app'),
  ('question-cards', 'Memories', 'Which ordinary day together would you happily relive?', 'original', 'Couple App original seed', 'Created for this app'),
  ('question-cards', 'Memories', 'What is a little moment with us that still makes you smile?', 'original', 'Couple App original seed', 'Created for this app'),
  ('question-cards', 'Memories', 'What did you first notice about me?', 'original', 'Couple App original seed', 'Created for this app'),
  ('question-cards', 'Everyday life', 'What is one small way I can make a busy day easier for you?', 'original', 'Couple App original seed', 'Created for this app'),
  ('question-cards', 'Everyday life', 'What does a perfect quiet evening look like to you?', 'original', 'Couple App original seed', 'Created for this app'),
  ('question-cards', 'Everyday life', 'Which little routine would you like us to make our own?', 'original', 'Couple App original seed', 'Created for this app'),
  ('question-cards', 'Future', 'What place would you like us to explore together?', 'original', 'Couple App original seed', 'Created for this app'),
  ('question-cards', 'Future', 'What is something new you would like us to try this year?', 'original', 'Couple App original seed', 'Created for this app'),
  ('question-cards', 'Future', 'What kind of tradition would you like us to start?', 'original', 'Couple App original seed', 'Created for this app'),
  ('whos-more-likely', 'Everyday life', 'Who is more likely to stay up late finishing one more thing?', 'original', 'Couple App original seed', 'Created for this app'),
  ('whos-more-likely', 'Everyday life', 'Who is more likely to suggest ordering the same favorite meal?', 'original', 'Couple App original seed', 'Created for this app'),
  ('whos-more-likely', 'Getting to know each other', 'Who is more likely to start a conversation with someone new?', 'original', 'Couple App original seed', 'Created for this app'),
  ('whos-more-likely', 'Getting to know each other', 'Who is more likely to try a new hobby?', 'original', 'Couple App original seed', 'Created for this app'),
  ('whos-more-likely', 'Memories', 'Who is more likely to remember a tiny detail from a story?', 'original', 'Couple App original seed', 'Created for this app'),
  ('whos-more-likely', 'Future', 'Who is more likely to plan a spontaneous day trip?', 'original', 'Couple App original seed', 'Created for this app'),
  ('whos-more-likely', 'Future', 'Who is more likely to start planning a shared project?', 'original', 'Couple App original seed', 'Created for this app'),
  ('whos-more-likely', 'Everyday life', 'Who is more likely to bring home a small surprise?', 'original', 'Couple App original seed', 'Created for this app'),
  ('describe-without-saying-it', 'Things around us', 'Sunflower', 'original', 'Couple App original seed', 'Created for this app'),
  ('describe-without-saying-it', 'Things around us', 'Umbrella', 'original', 'Couple App original seed', 'Created for this app'),
  ('describe-without-saying-it', 'Food', 'Pancake', 'original', 'Couple App original seed', 'Created for this app'),
  ('describe-without-saying-it', 'Food', 'Watermelon', 'original', 'Couple App original seed', 'Created for this app'),
  ('describe-without-saying-it', 'Places', 'Airport', 'original', 'Couple App original seed', 'Created for this app'),
  ('describe-without-saying-it', 'Places', 'Aquarium', 'original', 'Couple App original seed', 'Created for this app'),
  ('describe-without-saying-it', 'Everyday life', 'Toothbrush', 'original', 'Couple App original seed', 'Created for this app'),
  ('describe-without-saying-it', 'Everyday life', 'Backpack', 'original', 'Couple App original seed', 'Created for this app');
UPDATE public.game_prompts SET forbidden_words = ARRAY['flower', 'yellow', 'garden'] WHERE prompt = 'Sunflower';
UPDATE public.game_prompts SET forbidden_words = ARRAY['rain', 'wet', 'open'] WHERE prompt = 'Umbrella';
UPDATE public.game_prompts SET forbidden_words = ARRAY['breakfast', 'syrup', 'pan'] WHERE prompt = 'Pancake';
UPDATE public.game_prompts SET forbidden_words = ARRAY['fruit', 'red', 'seeds'] WHERE prompt = 'Watermelon';
UPDATE public.game_prompts SET forbidden_words = ARRAY['plane', 'travel', 'terminal'] WHERE prompt = 'Airport';
UPDATE public.game_prompts SET forbidden_words = ARRAY['fish', 'water', 'glass'] WHERE prompt = 'Aquarium';
UPDATE public.game_prompts SET forbidden_words = ARRAY['teeth', 'paste', 'bathroom'] WHERE prompt = 'Toothbrush';
UPDATE public.game_prompts SET forbidden_words = ARRAY['school', 'carry', 'bag'] WHERE prompt = 'Backpack';

CREATE TABLE public.conversation_game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  round_number smallint NOT NULL CHECK (round_number IN (1, 2)),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id uuid REFERENCES public.game_prompts(id) ON DELETE SET NULL,
  public_state jsonb,
  deadline_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (session_id, round_number)
);
CREATE TABLE public.conversation_game_submissions (
  round_id uuid NOT NULL REFERENCES public.conversation_game_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer jsonb NOT NULL CHECK (pg_catalog.jsonb_typeof(answer) = 'object'),
  submitted_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (round_id, user_id)
);
ALTER TABLE public.conversation_game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_game_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.conversation_game_rounds, public.conversation_game_submissions FROM anon, authenticated;
GRANT SELECT ON TABLE public.conversation_game_rounds, public.conversation_game_submissions TO authenticated;

CREATE FUNCTION private.conversation_submission_revealed(target_round_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_game_rounds r
    JOIN public.game_sessions gs ON gs.id = r.session_id
    WHERE r.id = target_round_id
      AND (r.status = 'completed' OR r.deadline_at <= pg_catalog.now())
      AND public.are_couple_members(gs.player_x_id)
      AND public.are_couple_members(gs.player_o_id)
  );
$$;
REVOKE ALL ON FUNCTION private.conversation_submission_revealed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.conversation_submission_revealed(uuid) TO authenticated;

CREATE POLICY "Couple participants read conversation rounds"
  ON public.conversation_game_rounds FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.game_sessions gs
    WHERE gs.id = conversation_game_rounds.session_id
      AND (SELECT auth.uid()) IN (gs.player_x_id, gs.player_o_id)
      AND (SELECT public.are_couple_members(gs.player_x_id))
      AND (SELECT public.are_couple_members(gs.player_o_id))
  ));
CREATE POLICY "Participants read own or revealed conversation submissions"
  ON public.conversation_game_submissions FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      (SELECT private.conversation_submission_revealed(conversation_game_submissions.round_id))
      AND EXISTS (
        SELECT 1 FROM public.conversation_game_rounds r
        JOIN public.game_sessions gs ON gs.id = r.session_id
        WHERE r.id = conversation_game_submissions.round_id
          AND (SELECT auth.uid()) IN (gs.player_x_id, gs.player_o_id)
          AND (SELECT public.are_couple_members(gs.player_x_id))
          AND (SELECT public.are_couple_members(gs.player_o_id))
      )
    )
  );

DROP FUNCTION public.create_game_request(uuid, text);
CREATE FUNCTION public.create_game_request(target_recipient_id uuid, target_game_type text DEFAULT 'tic-tac-toe')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  request_row public.game_requests;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Sign in before sending a game request'; END IF;
  IF target_game_type IS NULL OR target_game_type NOT IN ('tic-tac-toe', 'would-you-rather', 'question-cards', 'whos-more-likely', 'lie-detector', 'describe-without-saying-it') THEN
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

CREATE FUNCTION public.start_conversation_game(target_session_id uuid, target_prompt_id uuid DEFAULT NULL)
RETURNS public.conversation_game_rounds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  session_row public.game_sessions;
  prompt_row public.game_prompts;
  round_row public.conversation_game_rounds;
BEGIN
  SELECT * INTO session_row FROM public.game_sessions WHERE id = target_session_id FOR UPDATE;
  IF session_row.id IS NULL OR session_row.game_type NOT IN ('question-cards', 'whos-more-likely', 'lie-detector', 'describe-without-saying-it')
    OR caller_id NOT IN (session_row.player_x_id, session_row.player_o_id)
    OR NOT public.are_couple_members(session_row.player_x_id) OR NOT public.are_couple_members(session_row.player_o_id) THEN
    RAISE EXCEPTION 'Conversation game session is unavailable';
  END IF;
  SELECT * INTO round_row FROM public.conversation_game_rounds WHERE session_id = target_session_id AND round_number = session_row.current_round;
  IF round_row.id IS NOT NULL THEN RETURN round_row; END IF;
  IF session_row.status <> 'active' OR session_row.current_round <> 1 OR caller_id <> session_row.player_x_id THEN
    RAISE EXCEPTION 'The game requester must start this round';
  END IF;
  IF session_row.game_type IN ('question-cards', 'whos-more-likely') THEN
    IF target_prompt_id IS NULL THEN
      SELECT * INTO prompt_row FROM public.game_prompts p
      WHERE p.game_type = session_row.game_type
        AND ((p.source_type = 'original' AND p.couple_id IS NULL) OR (p.couple_id IS NOT NULL AND public.is_couple_member(p.couple_id)))
      ORDER BY pg_catalog.random() LIMIT 1;
    ELSE
      SELECT * INTO prompt_row FROM public.game_prompts p
      WHERE p.id = target_prompt_id AND p.game_type = session_row.game_type
        AND ((p.source_type = 'original' AND p.couple_id IS NULL) OR (p.couple_id IS NOT NULL AND public.is_couple_member(p.couple_id)));
    END IF;
    IF prompt_row.id IS NULL THEN RAISE EXCEPTION 'Choose an available prompt for this game'; END IF;
  ELSIF session_row.game_type = 'describe-without-saying-it' THEN
    IF target_prompt_id IS NOT NULL THEN RAISE EXCEPTION 'Describe words are selected by the game'; END IF;
    SELECT * INTO prompt_row FROM public.game_prompts p WHERE p.game_type = session_row.game_type ORDER BY pg_catalog.random() LIMIT 1;
    IF prompt_row.id IS NULL THEN RAISE EXCEPTION 'No Describe words are available'; END IF;
  ELSIF target_prompt_id IS NOT NULL THEN
    RAISE EXCEPTION 'This game does not use prompts';
  END IF;
  INSERT INTO public.conversation_game_rounds (session_id, round_number, creator_id, prompt_id, deadline_at)
  VALUES (target_session_id, 1, session_row.player_x_id, prompt_row.id, NULL)
  RETURNING * INTO round_row;
  RETURN round_row;
END;
$$;
REVOKE ALL ON FUNCTION public.start_conversation_game(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_conversation_game(uuid, uuid) TO authenticated;

CREATE FUNCTION public.get_describe_game_word(target_round_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  round_row public.conversation_game_rounds;
  session_row public.game_sessions;
  prompt_row public.game_prompts;
BEGIN
  SELECT * INTO round_row FROM public.conversation_game_rounds WHERE id = target_round_id;
  SELECT * INTO session_row FROM public.game_sessions WHERE id = round_row.session_id;
  IF round_row.id IS NULL OR session_row.game_type <> 'describe-without-saying-it' OR round_row.status <> 'active'
    OR round_row.creator_id <> caller_id OR round_row.deadline_at <= pg_catalog.now()
    OR NOT public.are_couple_members(session_row.player_x_id) OR NOT public.are_couple_members(session_row.player_o_id)
    OR EXISTS (SELECT 1 FROM public.conversation_game_submissions s WHERE s.round_id = target_round_id AND s.user_id = caller_id) THEN
    RAISE EXCEPTION 'The Describe word is unavailable to this player';
  END IF;
  SELECT * INTO prompt_row FROM public.game_prompts WHERE id = round_row.prompt_id;
  UPDATE public.conversation_game_rounds SET public_state = '{"word_shown":true}'::jsonb WHERE id = target_round_id;
  RETURN pg_catalog.jsonb_build_object('word', prompt_row.prompt, 'forbidden', pg_catalog.to_jsonb(prompt_row.forbidden_words));
END;
$$;
REVOKE ALL ON FUNCTION public.get_describe_game_word(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_describe_game_word(uuid) TO authenticated;

CREATE FUNCTION public.submit_conversation_game_answer(target_round_id uuid, target_answer jsonb, target_public_state jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  round_row public.conversation_game_rounds;
  session_row public.game_sessions;
  prompt_row public.game_prompts;
  answer_to_store jsonb := target_answer;
  submission_count integer;
  statements jsonb;
  statement text;
  statement_set text[] := ARRAY[]::text[];
  next_round smallint;
  next_creator uuid;
  next_prompt_id uuid;
  next_deadline timestamptz;
BEGIN
  SELECT * INTO round_row FROM public.conversation_game_rounds WHERE id = target_round_id FOR UPDATE;
  SELECT * INTO session_row FROM public.game_sessions WHERE id = round_row.session_id FOR UPDATE;
  IF round_row.id IS NULL OR session_row.status <> 'active' OR session_row.current_round <> round_row.round_number OR round_row.status <> 'active'
    OR caller_id NOT IN (session_row.player_x_id, session_row.player_o_id)
    OR NOT public.are_couple_members(session_row.player_x_id) OR NOT public.are_couple_members(session_row.player_o_id) THEN
    RAISE EXCEPTION 'Conversation round is unavailable';
  END IF;
  IF round_row.deadline_at IS NOT NULL AND round_row.deadline_at <= pg_catalog.now() THEN RAISE EXCEPTION 'The round deadline has passed'; END IF;
  IF target_answer IS NULL OR pg_catalog.jsonb_typeof(target_answer) <> 'object' THEN RAISE EXCEPTION 'Answer is invalid'; END IF;

  IF session_row.game_type = 'question-cards' THEN
    IF target_public_state IS NOT NULL OR pg_catalog.length(pg_catalog.btrim(target_answer->>'answer')) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Answer is invalid'; END IF;
  ELSIF session_row.game_type = 'whos-more-likely' THEN
    IF target_public_state IS NOT NULL OR target_answer->>'choice' NOT IN ('me', 'partner') THEN RAISE EXCEPTION 'Answer is invalid'; END IF;
  ELSIF session_row.game_type = 'lie-detector' THEN
    IF caller_id = round_row.creator_id THEN
      IF EXISTS (SELECT 1 FROM public.conversation_game_submissions WHERE round_id = round_row.id)
        OR pg_catalog.jsonb_typeof(target_public_state->'statements') <> 'array'
        OR pg_catalog.jsonb_array_length(target_public_state->'statements') <> 3
        OR (target_answer->>'lie_index') !~ '^[0-2]$' THEN RAISE EXCEPTION 'Lie Detector setup is invalid'; END IF;
      FOR statement IN SELECT value FROM pg_catalog.jsonb_array_elements_text(target_public_state->'statements') LOOP
        IF pg_catalog.length(pg_catalog.btrim(statement)) NOT BETWEEN 1 AND 280 THEN RAISE EXCEPTION 'Each statement must be between 1 and 280 characters'; END IF;
        IF pg_catalog.lower(pg_catalog.btrim(statement)) = ANY(statement_set) THEN RAISE EXCEPTION 'Statements must be different'; END IF;
        statement_set := pg_catalog.array_append(statement_set, pg_catalog.lower(pg_catalog.btrim(statement)));
      END LOOP;
      UPDATE public.conversation_game_rounds SET public_state = target_public_state WHERE id = round_row.id;
    ELSE
      IF target_public_state IS NOT NULL OR target_answer->>'guess_index' !~ '^[0-2]$'
        OR NOT EXISTS (SELECT 1 FROM public.conversation_game_submissions WHERE round_id = round_row.id AND user_id = round_row.creator_id) THEN RAISE EXCEPTION 'Lie Detector guess is invalid'; END IF;
    END IF;
  ELSIF session_row.game_type = 'describe-without-saying-it' THEN
    IF caller_id = round_row.creator_id THEN
      IF EXISTS (SELECT 1 FROM public.conversation_game_submissions WHERE round_id = round_row.id)
        OR target_public_state IS NOT NULL OR round_row.public_state->>'word_shown' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Show the word before starting the Describe turn'; END IF;
      SELECT * INTO prompt_row FROM public.game_prompts WHERE id = round_row.prompt_id AND game_type = 'describe-without-saying-it';
      answer_to_store := pg_catalog.jsonb_build_object('word', prompt_row.prompt, 'forbidden', pg_catalog.to_jsonb(prompt_row.forbidden_words));
      UPDATE public.conversation_game_rounds SET deadline_at = pg_catalog.now() + interval '60 seconds', public_state = '{"started":true}'::jsonb WHERE id = round_row.id;
    ELSE
      IF target_public_state IS NOT NULL OR pg_catalog.length(pg_catalog.btrim(target_answer->>'guess')) NOT BETWEEN 1 AND 80
        OR round_row.public_state->>'started' IS DISTINCT FROM 'true'
        OR NOT EXISTS (SELECT 1 FROM public.conversation_game_submissions WHERE round_id = round_row.id AND user_id = round_row.creator_id) THEN RAISE EXCEPTION 'Describe guess is invalid'; END IF;
      IF pg_catalog.lower(pg_catalog.btrim(target_answer->>'guess')) = pg_catalog.lower((SELECT p.prompt FROM public.game_prompts p WHERE p.id = round_row.prompt_id)) THEN answer_to_store := target_answer || '{"correct":true}'::jsonb;
      ELSE answer_to_store := target_answer || '{"correct":false}'::jsonb; END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Conversation game type is invalid';
  END IF;

  INSERT INTO public.conversation_game_submissions (round_id, user_id, answer) VALUES (round_row.id, caller_id, answer_to_store);
  SELECT pg_catalog.count(*)::integer INTO submission_count FROM public.conversation_game_submissions WHERE round_id = round_row.id;
  IF submission_count = 2 THEN
    UPDATE public.conversation_game_rounds SET status = 'completed', completed_at = pg_catalog.now() WHERE id = round_row.id;
    IF session_row.game_type IN ('question-cards', 'whos-more-likely') OR round_row.round_number = 2 THEN
      UPDATE public.game_sessions SET status = 'completed', updated_at = pg_catalog.now() WHERE id = session_row.id;
    ELSE
      next_round := 2;
      next_creator := CASE WHEN round_row.creator_id = session_row.player_x_id THEN session_row.player_o_id ELSE session_row.player_x_id END;
      next_deadline := NULL;
      IF session_row.game_type = 'describe-without-saying-it' THEN
        SELECT p.id INTO next_prompt_id FROM public.game_prompts p WHERE p.game_type = session_row.game_type AND p.id <> round_row.prompt_id ORDER BY pg_catalog.random() LIMIT 1;
      END IF;
      INSERT INTO public.conversation_game_rounds (session_id, round_number, creator_id, prompt_id, deadline_at)
      VALUES (session_row.id, next_round, next_creator, next_prompt_id, next_deadline);
      UPDATE public.game_sessions SET current_round = next_round, updated_at = pg_catalog.now() WHERE id = session_row.id;
    END IF;
  END IF;
  RETURN pg_catalog.jsonb_build_object('submitted', true, 'revealed', submission_count = 2, 'submission_count', submission_count,
    'round_completed', submission_count = 2, 'session_completed', session_row.game_type IN ('question-cards', 'whos-more-likely') AND submission_count = 2 OR round_row.round_number = 2 AND submission_count = 2);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_conversation_game_answer(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_conversation_game_answer(uuid, jsonb, jsonb) TO authenticated;

CREATE FUNCTION public.expire_conversation_game_round(target_round_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  round_row public.conversation_game_rounds;
  session_row public.game_sessions;
  next_prompt_id uuid;
  next_creator uuid;
BEGIN
  SELECT * INTO round_row FROM public.conversation_game_rounds WHERE id = target_round_id FOR UPDATE;
  SELECT * INTO session_row FROM public.game_sessions WHERE id = round_row.session_id FOR UPDATE;
  IF round_row.id IS NULL OR session_row.game_type <> 'describe-without-saying-it'
    OR caller_id NOT IN (session_row.player_x_id, session_row.player_o_id)
    OR NOT public.are_couple_members(session_row.player_x_id) OR NOT public.are_couple_members(session_row.player_o_id) THEN
    RAISE EXCEPTION 'Describe round is unavailable';
  END IF;
  IF round_row.status = 'completed' THEN RETURN pg_catalog.jsonb_build_object('expired', true, 'round_completed', true, 'session_completed', session_row.status = 'completed'); END IF;
  IF round_row.deadline_at > pg_catalog.now() OR round_row.deadline_at IS NULL THEN RAISE EXCEPTION 'The round deadline has not passed'; END IF;
  UPDATE public.conversation_game_rounds SET status = 'completed', completed_at = pg_catalog.now() WHERE id = round_row.id;
  IF round_row.round_number = 1 THEN
    next_creator := CASE WHEN round_row.creator_id = session_row.player_x_id THEN session_row.player_o_id ELSE session_row.player_x_id END;
    SELECT p.id INTO next_prompt_id FROM public.game_prompts p WHERE p.game_type = session_row.game_type AND p.id <> round_row.prompt_id ORDER BY pg_catalog.random() LIMIT 1;
    INSERT INTO public.conversation_game_rounds (session_id, round_number, creator_id, prompt_id, deadline_at)
    VALUES (session_row.id, 2, next_creator, next_prompt_id, NULL);
    UPDATE public.game_sessions SET current_round = 2, updated_at = pg_catalog.now() WHERE id = session_row.id;
    RETURN pg_catalog.jsonb_build_object('expired', true, 'round_completed', true, 'session_completed', false);
  END IF;
  UPDATE public.game_sessions SET status = 'completed', updated_at = pg_catalog.now() WHERE id = session_row.id;
  RETURN pg_catalog.jsonb_build_object('expired', true, 'round_completed', true, 'session_completed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.expire_conversation_game_round(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_conversation_game_round(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversation_game_rounds') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_game_rounds;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversation_game_submissions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_game_submissions;
  END IF;
END;
$$;

CREATE FUNCTION public.create_couple_question(target_category text, target_prompt text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  caller_couple_id uuid;
  prompt_row public.game_prompts;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Sign in before adding a question'; END IF;
  IF target_category NOT IN ('Getting to know each other', 'Memories', 'Everyday life', 'Future')
    OR target_prompt IS NULL OR pg_catalog.length(pg_catalog.btrim(target_prompt)) NOT BETWEEN 1 AND 280 THEN
    RAISE EXCEPTION 'Question category or text is invalid';
  END IF;
  SELECT cm.couple_id INTO caller_couple_id FROM public.couple_members cm WHERE cm.user_id = caller_id;
  IF caller_couple_id IS NULL THEN RAISE EXCEPTION 'Pair with your partner before adding a question'; END IF;
  INSERT INTO public.game_prompts (couple_id, game_type, category, prompt, source_type, source_name, source_license, created_by)
  VALUES (caller_couple_id, 'question-cards', target_category, pg_catalog.btrim(target_prompt), 'couple', 'Couple authored', NULL, caller_id)
  RETURNING * INTO prompt_row;
  RETURN pg_catalog.to_jsonb(prompt_row);
END;
$$;
REVOKE ALL ON FUNCTION public.create_couple_question(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_couple_question(text, text) TO authenticated;
