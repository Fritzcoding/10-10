ALTER TABLE public.game_requests
  DROP CONSTRAINT game_requests_game_type_check,
  ADD CONSTRAINT game_requests_game_type_check CHECK (game_type IN (
    'tic-tac-toe', 'would-you-rather', 'question-cards', 'whos-more-likely',
    'lie-detector', 'describe-without-saying-it', 'draw-together', 'memory-match',
    'rock-paper-scissors', 'word-chain'
  ));
ALTER TABLE public.game_sessions
  DROP CONSTRAINT game_sessions_game_type_check,
  ADD CONSTRAINT game_sessions_game_type_check CHECK (game_type IN (
    'tic-tac-toe', 'would-you-rather', 'question-cards', 'whos-more-likely',
    'lie-detector', 'describe-without-saying-it', 'memory-match',
    'rock-paper-scissors', 'word-chain', 'draw-together'
  ));

CREATE FUNCTION private.game_relationship_allowed(target_game_type text, first_user uuid, second_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IN (first_user, second_user)
    AND (
      ((SELECT public.are_couple_members(first_user)) AND (SELECT public.are_couple_members(second_user)))
      OR (
        target_game_type IN ('tic-tac-toe', 'memory-match', 'rock-paper-scissors', 'word-chain')
        AND EXISTS (
          SELECT 1 FROM public.friend_requests fr
          WHERE fr.request_type = 'friend' AND fr.status = 'accepted'
            AND ((fr.requester_id = first_user AND fr.recipient_id = second_user)
              OR (fr.requester_id = second_user AND fr.recipient_id = first_user))
        )
      )
    );
$$;
REVOKE ALL ON FUNCTION private.game_relationship_allowed(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.game_relationship_allowed(text, uuid, uuid) TO authenticated;

CREATE TABLE private.tiny_game_decks (
  session_id uuid PRIMARY KEY REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  cards jsonb NOT NULL CHECK (pg_catalog.jsonb_typeof(cards) = 'array')
);
ALTER TABLE private.tiny_game_decks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.tiny_game_decks FROM PUBLIC, anon, authenticated;

CREATE TABLE public.tiny_game_states (
  session_id uuid PRIMARY KEY REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  state jsonb NOT NULL CHECK (pg_catalog.jsonb_typeof(state) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
ALTER TABLE public.tiny_game_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tiny_game_states FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tiny_game_states TO authenticated;
CREATE POLICY "Tiny game participants read public state"
  ON public.tiny_game_states FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.game_sessions gs
    WHERE gs.id = tiny_game_states.session_id
      AND (SELECT private.game_relationship_allowed(gs.game_type, gs.player_x_id, gs.player_o_id))
  ));

CREATE TABLE public.tiny_game_choices (
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice text NOT NULL CHECK (choice IN ('rock', 'paper', 'scissors')),
  submitted_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (session_id, user_id)
);
ALTER TABLE public.tiny_game_choices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tiny_game_choices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tiny_game_choices TO authenticated;
CREATE FUNCTION private.tiny_game_rps_revealed(target_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT pg_catalog.count(*) FROM public.tiny_game_choices c WHERE c.session_id = target_session_id) = 2;
$$;
REVOKE ALL ON FUNCTION private.tiny_game_rps_revealed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.tiny_game_rps_revealed(uuid) TO authenticated;
CREATE POLICY "RPS participants read own or revealed choices"
  ON public.tiny_game_choices FOR SELECT TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) OR (
      EXISTS (SELECT 1 FROM public.game_sessions gs
        WHERE gs.id = tiny_game_choices.session_id AND gs.game_type = 'rock-paper-scissors'
          AND gs.status = 'completed'
          AND (SELECT private.game_relationship_allowed(gs.game_type, gs.player_x_id, gs.player_o_id))
      )
      AND (SELECT private.tiny_game_rps_revealed(tiny_game_choices.session_id))
    ))
    AND EXISTS (SELECT 1 FROM public.game_sessions gs
      WHERE gs.id = tiny_game_choices.session_id
        AND (SELECT auth.uid()) IN (gs.player_x_id, gs.player_o_id)
        AND (SELECT private.game_relationship_allowed(gs.game_type, gs.player_x_id, gs.player_o_id))
    )
  );

DROP POLICY IF EXISTS "Couple members can read their sessions" ON public.game_sessions;
CREATE POLICY "Game participants read authorized sessions"
  ON public.game_sessions FOR SELECT TO authenticated
  USING ((SELECT private.game_relationship_allowed(game_type, player_x_id, player_o_id)));
DROP POLICY IF EXISTS "Couple members can read their game requests" ON public.game_requests;
CREATE POLICY "Game participants read authorized requests"
  ON public.game_requests FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IN (requester_id, recipient_id)
    AND (SELECT private.game_relationship_allowed(game_type, requester_id, recipient_id))
  );

CREATE FUNCTION private.initialize_tiny_game_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  initial_state jsonb;
  deck jsonb;
BEGIN
  IF NEW.game_type NOT IN ('memory-match', 'rock-paper-scissors', 'word-chain') THEN RETURN NEW; END IF;
  IF NEW.game_type = 'memory-match' THEN
    SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(pair) ORDER BY pg_catalog.random()) INTO deck
    FROM pg_catalog.unnest(ARRAY['🌙','🌙','🌷','🌷','☀️','☀️','🍓','🍓','🌈','🌈','🐚','🐚','🍋','🍋','🦋','🦋']) AS values(pair);
    INSERT INTO private.tiny_game_decks(session_id, cards) VALUES (NEW.id, deck);
    SELECT pg_catalog.jsonb_build_object(
      'game_type', NEW.game_type,
      'cards', pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', n, 'pair', NULL) ORDER BY n),
      'revealed', '[]'::jsonb, 'matched', '[]'::jsonb, 'scores', '[0,0]'::jsonb
    ) INTO initial_state FROM pg_catalog.generate_series(0, 15) n;
  ELSIF NEW.game_type = 'word-chain' THEN
    initial_state := pg_catalog.jsonb_build_object('game_type', NEW.game_type, 'words', '[]'::jsonb);
  ELSE
    initial_state := pg_catalog.jsonb_build_object('game_type', NEW.game_type);
  END IF;
  INSERT INTO public.tiny_game_states(session_id, state) VALUES (NEW.id, initial_state);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.initialize_tiny_game_session() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER initialize_tiny_game_session AFTER INSERT ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION private.initialize_tiny_game_session();

CREATE FUNCTION public.submit_tiny_game_action(target_session_id uuid, target_revision integer, target_action jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  session_row public.game_sessions;
  state_row public.tiny_game_states;
  deck_row private.tiny_game_decks;
  next_state jsonb;
  words text[];
  revealed integer[];
  matched integer[];
  next_revealed integer[];
  next_matched integer[];
  score_index integer;
  next_scores jsonb;
  card_index integer;
  next_turn text;
  next_status text;
  word text;
  previous_word text;
  pair_a text;
  pair_b text;
  player_mark text;
BEGIN
  SELECT * INTO session_row FROM public.game_sessions WHERE id = target_session_id FOR UPDATE;
  IF caller_id IS NULL OR session_row.id IS NULL
    OR session_row.game_type NOT IN ('memory-match', 'word-chain')
    OR NOT private.game_relationship_allowed(session_row.game_type, session_row.player_x_id, session_row.player_o_id) THEN
    RAISE EXCEPTION 'Tiny game session is unavailable';
  END IF;
  IF session_row.status <> 'active' THEN RAISE EXCEPTION 'Game is completed'; END IF;
  IF session_row.revision IS DISTINCT FROM target_revision THEN RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='stale_revision'; END IF;
  player_mark := CASE WHEN caller_id = session_row.player_x_id THEN 'X' WHEN caller_id = session_row.player_o_id THEN 'O' END;
  IF player_mark IS NULL THEN RAISE EXCEPTION 'User is not a player'; END IF;
  IF player_mark <> session_row.turn THEN RAISE EXCEPTION 'It is not your turn'; END IF;
  IF target_action IS NULL OR pg_catalog.jsonb_typeof(target_action) <> 'object' THEN RAISE EXCEPTION 'Game action is invalid'; END IF;

  SELECT * INTO state_row FROM public.tiny_game_states WHERE session_id = target_session_id FOR UPDATE;
  IF session_row.game_type = 'word-chain' THEN
    IF target_action->>'type' <> 'word' THEN RAISE EXCEPTION 'Word Chain action is invalid'; END IF;
    word := pg_catalog.lower(pg_catalog.btrim(target_action->>'word'));
    IF word IS NULL OR word = '' OR pg_catalog.length(word) > 40 OR word !~ '^[[:alpha:]]+$' THEN RAISE EXCEPTION 'Word is invalid'; END IF;
    SELECT pg_catalog.array_agg(value) INTO words FROM pg_catalog.jsonb_array_elements_text(state_row.state->'words') AS value;
    words := COALESCE(words, ARRAY[]::text[]);
    IF pg_catalog.cardinality(words) >= 10 THEN RAISE EXCEPTION 'Word chain is complete'; END IF;
    IF word = ANY(words) THEN RAISE EXCEPTION 'Word was already used'; END IF;
    previous_word := words[pg_catalog.cardinality(words)];
    IF previous_word IS NOT NULL AND pg_catalog.left(word,1) <> pg_catalog.right(previous_word,1) THEN RAISE EXCEPTION 'Word does not continue the chain'; END IF;
    next_state := pg_catalog.jsonb_set(state_row.state, '{words}', state_row.state->'words' || pg_catalog.jsonb_build_array(word));
    next_turn := CASE WHEN session_row.turn = 'X' THEN 'O' ELSE 'X' END;
    next_status := CASE WHEN pg_catalog.jsonb_array_length(next_state->'words') >= 10 THEN 'completed' ELSE 'active' END;
  ELSE
    IF target_action->>'type' <> 'flip' OR (target_action->>'index') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Memory Match action is invalid'; END IF;
    card_index := (target_action->>'index')::integer;
    SELECT * INTO deck_row FROM private.tiny_game_decks WHERE session_id = target_session_id;
    IF deck_row.session_id IS NULL OR card_index < 0 OR card_index >= pg_catalog.jsonb_array_length(deck_row.cards) THEN RAISE EXCEPTION 'Card index is invalid'; END IF;
    SELECT COALESCE(pg_catalog.array_agg(value::integer), ARRAY[]::integer[]) INTO revealed FROM pg_catalog.jsonb_array_elements_text(state_row.state->'revealed') AS value;
    SELECT COALESCE(pg_catalog.array_agg(value::integer), ARRAY[]::integer[]) INTO matched FROM pg_catalog.jsonb_array_elements_text(state_row.state->'matched') AS value;
    IF card_index = ANY(matched) OR card_index = ANY(revealed) THEN RAISE EXCEPTION 'Card is already open'; END IF;
    next_turn := session_row.turn;
    next_status := 'active';
    IF pg_catalog.cardinality(revealed) >= 2 THEN revealed := ARRAY[]::integer[]; END IF;
    IF pg_catalog.cardinality(revealed) = 1 THEN
      pair_a := deck_row.cards->>revealed[1];
      pair_b := deck_row.cards->>card_index;
      next_revealed := revealed || card_index;
      IF pair_a = pair_b THEN
        next_matched := matched || revealed[1] || card_index;
        score_index := CASE WHEN session_row.turn = 'X' THEN 0 ELSE 1 END;
        next_scores := pg_catalog.jsonb_set(state_row.state->'scores', ARRAY[score_index::text], pg_catalog.to_jsonb(((state_row.state->'scores'->>score_index)::integer) + 1));
        matched := next_matched;
      ELSE
        next_turn := CASE WHEN session_row.turn = 'X' THEN 'O' ELSE 'X' END;
      END IF;
    ELSE
      next_revealed := ARRAY[card_index];
    END IF;
    next_status := CASE WHEN pg_catalog.cardinality(matched) = pg_catalog.jsonb_array_length(deck_row.cards) THEN 'completed' ELSE 'active' END;
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', n, 'pair', CASE WHEN n = ANY(next_revealed) OR n = ANY(matched) THEN deck_row.cards->>n ELSE NULL END) ORDER BY n)
      INTO next_state
      FROM pg_catalog.generate_series(0, pg_catalog.jsonb_array_length(deck_row.cards)-1) n;
    next_state := pg_catalog.jsonb_build_object(
      'game_type', 'memory-match', 'cards', next_state,
      'revealed', pg_catalog.to_jsonb(next_revealed), 'matched', pg_catalog.to_jsonb(matched),
      'scores', COALESCE(next_scores, state_row.state->'scores')
    );
  END IF;
  UPDATE public.tiny_game_states SET state = next_state, updated_at = pg_catalog.now() WHERE session_id = target_session_id;
  UPDATE public.game_sessions SET revision = revision + 1, turn = next_turn, status = next_status, updated_at = pg_catalog.now()
    WHERE id = target_session_id;
  RETURN next_state;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_tiny_game_action(uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_tiny_game_action(uuid, integer, jsonb) TO authenticated;

CREATE FUNCTION public.submit_tiny_game_rps_choice(target_session_id uuid, target_choice text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  session_row public.game_sessions;
  choice_count integer;
  inserted_user uuid;
BEGIN
  SELECT * INTO session_row FROM public.game_sessions WHERE id = target_session_id FOR UPDATE;
  IF caller_id IS NULL OR session_row.id IS NULL OR session_row.game_type <> 'rock-paper-scissors'
    OR session_row.status <> 'active'
    OR NOT private.game_relationship_allowed(session_row.game_type, session_row.player_x_id, session_row.player_o_id) THEN
    RAISE EXCEPTION 'Rock Paper Scissors session is unavailable';
  END IF;
  IF target_choice NOT IN ('rock', 'paper', 'scissors') THEN RAISE EXCEPTION 'Choice is invalid'; END IF;
  INSERT INTO public.tiny_game_choices(session_id, user_id, choice)
  VALUES (target_session_id, caller_id, target_choice)
  ON CONFLICT (session_id, user_id) DO NOTHING
  RETURNING user_id INTO inserted_user;
  IF inserted_user IS NULL THEN RAISE EXCEPTION 'Choice already submitted'; END IF;
  SELECT pg_catalog.count(*) INTO choice_count FROM public.tiny_game_choices WHERE session_id = target_session_id;
  UPDATE public.game_sessions SET revision = revision + 1,
    status = CASE WHEN choice_count = 2 THEN 'completed' ELSE status END,
    updated_at = pg_catalog.now()
    WHERE id = target_session_id;
  RETURN pg_catalog.jsonb_build_object('submitted', true, 'revealed', choice_count = 2, 'submission_count', choice_count);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_tiny_game_rps_choice(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_tiny_game_rps_choice(uuid, text) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tiny_game_states') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tiny_game_states;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tiny_game_choices') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tiny_game_choices;
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.create_game_request(target_recipient_id uuid, target_game_type text DEFAULT 'tic-tac-toe')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := (SELECT auth.uid()); request_row public.game_requests;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Sign in before sending a game request'; END IF;
  IF target_game_type IS NULL OR target_game_type NOT IN ('tic-tac-toe','would-you-rather','question-cards','whos-more-likely','lie-detector','describe-without-saying-it','draw-together','memory-match','rock-paper-scissors','word-chain') THEN
    RAISE EXCEPTION 'Game type is invalid';
  END IF;
  IF caller_id = target_recipient_id OR NOT private.game_relationship_allowed(target_game_type, caller_id, target_recipient_id) THEN
    RAISE EXCEPTION 'Game requests are limited to your partner or confirmed friend';
  END IF;
  UPDATE public.game_requests gr SET status='expired',updated_at=pg_catalog.now()
    WHERE gr.requester_id=caller_id AND gr.recipient_id=target_recipient_id AND gr.game_type=target_game_type AND gr.status='pending' AND gr.expires_at<=pg_catalog.now();
  SELECT gr.* INTO request_row FROM public.game_requests gr
    WHERE gr.requester_id=caller_id AND gr.recipient_id=target_recipient_id AND gr.game_type=target_game_type AND gr.status='pending' AND gr.expires_at>pg_catalog.now();
  IF request_row.id IS NOT NULL THEN RETURN pg_catalog.to_jsonb(request_row)||pg_catalog.jsonb_build_object('wasExisting',true); END IF;
  INSERT INTO public.game_requests(requester_id,recipient_id,game_type) VALUES(caller_id,target_recipient_id,target_game_type)
    ON CONFLICT(requester_id,recipient_id,game_type) WHERE status='pending' DO NOTHING RETURNING * INTO request_row;
  IF request_row.id IS NULL THEN
    SELECT gr.* INTO request_row FROM public.game_requests gr WHERE gr.requester_id=caller_id AND gr.recipient_id=target_recipient_id AND gr.game_type=target_game_type AND gr.status='pending';
    RETURN pg_catalog.to_jsonb(request_row)||pg_catalog.jsonb_build_object('wasExisting',true);
  END IF;
  RETURN pg_catalog.to_jsonb(request_row);
END;
$$;
REVOKE ALL ON FUNCTION public.create_game_request(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_game_request(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_game_request(target_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := (SELECT auth.uid()); request_row public.game_requests; session_row public.game_sessions;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Sign in before accepting a game request'; END IF;
  SELECT gr.* INTO request_row FROM public.game_requests gr
    WHERE gr.id=target_request_id AND gr.recipient_id=caller_id AND gr.status='pending' AND gr.expires_at>pg_catalog.now() FOR UPDATE;
  IF request_row.id IS NULL OR NOT private.game_relationship_allowed(request_row.game_type,request_row.requester_id,request_row.recipient_id) THEN
    RAISE EXCEPTION 'Game request is no longer active';
  END IF;
  UPDATE public.game_requests SET status='accepted',updated_at=pg_catalog.now() WHERE id=target_request_id;
  INSERT INTO public.game_sessions(game_type,player_x_id,player_o_id,deadline_at)
    VALUES(request_row.game_type,request_row.requester_id,request_row.recipient_id,
      CASE WHEN request_row.game_type='would-you-rather' THEN pg_catalog.now()+interval '5 minutes' END)
    RETURNING * INTO session_row;
  RETURN pg_catalog.jsonb_build_object('request',pg_catalog.to_jsonb(request_row),'session_id',session_row.id);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_game_request(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_game_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_game_request(target_request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := (SELECT auth.uid());
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Sign in before declining a game request'; END IF;
  UPDATE public.game_requests gr SET status='declined',updated_at=pg_catalog.now()
    WHERE gr.id=target_request_id AND gr.recipient_id=caller_id AND gr.status='pending' AND gr.expires_at>pg_catalog.now()
      AND private.game_relationship_allowed(gr.game_type,gr.requester_id,gr.recipient_id);
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.decline_game_request(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decline_game_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_tic_tac_toe_move(target_session_id uuid,target_revision integer,target_cell integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE session_row public.game_sessions;
BEGIN
  SELECT gs.* INTO session_row FROM public.game_sessions gs WHERE gs.id=target_session_id;
  IF session_row.id IS NULL
    OR NOT private.game_relationship_allowed(session_row.game_type,session_row.player_x_id,session_row.player_o_id) THEN
    RAISE EXCEPTION 'Game session is unavailable';
  END IF;
  IF session_row.game_type<>'tic-tac-toe' THEN RAISE EXCEPTION 'This session is not a Tic-Tac-Toe game'; END IF;
  RETURN private.submit_tic_tac_toe_move(target_session_id,target_revision,target_cell);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_tic_tac_toe_move(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_tic_tac_toe_move(uuid,integer,integer) TO authenticated;
CREATE OR REPLACE FUNCTION private.submit_tic_tac_toe_move(target_session_id uuid, target_revision integer, target_cell integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  session_row public.game_sessions;
  next_row public.game_sessions;
  next_board jsonb;
  mark text;
  next_status text := 'active';
  next_winner text;
  has_empty_cell boolean;
  has_existing_winner boolean;
  board_cell jsonb;
  cell_index integer;
  x_count integer := 0;
  o_count integer := 0;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before making a move';
  END IF;

  SELECT gs.* INTO session_row
  FROM public.game_sessions gs
  WHERE gs.id = target_session_id
  FOR UPDATE;

  IF session_row.id IS NULL
    OR session_row.game_type <> 'tic-tac-toe'
    OR NOT private.game_relationship_allowed(session_row.game_type, session_row.player_x_id, session_row.player_o_id) THEN
    RAISE EXCEPTION 'Game session is unavailable';
  END IF;
  IF session_row.revision IS DISTINCT FROM target_revision THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'stale_revision';
  END IF;
  IF session_row.status <> 'active' THEN
    RAISE EXCEPTION 'Game is completed';
  END IF;
  IF session_row.board IS NULL OR pg_catalog.jsonb_typeof(session_row.board) <> 'array' THEN
    RAISE EXCEPTION 'Game board is invalid';
  END IF;
  IF pg_catalog.jsonb_array_length(session_row.board) <> 9 THEN
    RAISE EXCEPTION 'Game board is invalid';
  END IF;
  FOR cell_index IN 0..8 LOOP
    board_cell := session_row.board -> cell_index;
    IF board_cell NOT IN ('null'::jsonb, '"X"'::jsonb, '"O"'::jsonb) THEN
      RAISE EXCEPTION 'Game board is invalid';
    ELSIF board_cell = '"X"'::jsonb THEN
      x_count := x_count + 1;
    ELSIF board_cell = '"O"'::jsonb THEN
      o_count := o_count + 1;
    END IF;
  END LOOP;
  IF x_count < o_count OR x_count > o_count + 1
    OR session_row.turn <> (CASE WHEN x_count = o_count THEN 'X' ELSE 'O' END) THEN
    RAISE EXCEPTION 'Game board is invalid';
  END IF;
  has_existing_winner :=
    (session_row.board->>0 = 'X' AND session_row.board->>1 = 'X' AND session_row.board->>2 = 'X')
    OR (session_row.board->>3 = 'X' AND session_row.board->>4 = 'X' AND session_row.board->>5 = 'X')
    OR (session_row.board->>6 = 'X' AND session_row.board->>7 = 'X' AND session_row.board->>8 = 'X')
    OR (session_row.board->>0 = 'X' AND session_row.board->>3 = 'X' AND session_row.board->>6 = 'X')
    OR (session_row.board->>1 = 'X' AND session_row.board->>4 = 'X' AND session_row.board->>7 = 'X')
    OR (session_row.board->>2 = 'X' AND session_row.board->>5 = 'X' AND session_row.board->>8 = 'X')
    OR (session_row.board->>0 = 'X' AND session_row.board->>4 = 'X' AND session_row.board->>8 = 'X')
    OR (session_row.board->>2 = 'X' AND session_row.board->>4 = 'X' AND session_row.board->>6 = 'X')
    OR (session_row.board->>0 = 'O' AND session_row.board->>1 = 'O' AND session_row.board->>2 = 'O')
    OR (session_row.board->>3 = 'O' AND session_row.board->>4 = 'O' AND session_row.board->>5 = 'O')
    OR (session_row.board->>6 = 'O' AND session_row.board->>7 = 'O' AND session_row.board->>8 = 'O')
    OR (session_row.board->>0 = 'O' AND session_row.board->>3 = 'O' AND session_row.board->>6 = 'O')
    OR (session_row.board->>1 = 'O' AND session_row.board->>4 = 'O' AND session_row.board->>7 = 'O')
    OR (session_row.board->>2 = 'O' AND session_row.board->>5 = 'O' AND session_row.board->>8 = 'O')
    OR (session_row.board->>0 = 'O' AND session_row.board->>4 = 'O' AND session_row.board->>8 = 'O')
    OR (session_row.board->>2 = 'O' AND session_row.board->>4 = 'O' AND session_row.board->>6 = 'O');
  IF has_existing_winner THEN
    RAISE EXCEPTION 'Game board is invalid';
  END IF;
  IF target_cell IS NULL OR target_cell < 0 OR target_cell > 8 THEN
    RAISE EXCEPTION 'Move index is invalid';
  END IF;

  mark := CASE
    WHEN session_row.player_x_id = caller_id THEN 'X'
    WHEN session_row.player_o_id = caller_id THEN 'O'
    ELSE NULL
  END;
  IF mark IS NULL THEN
    RAISE EXCEPTION 'User is not a player';
  END IF;
  IF session_row.turn <> mark THEN
    RAISE EXCEPTION 'It is not your turn';
  END IF;
  IF session_row.board -> target_cell <> 'null'::jsonb THEN
    RAISE EXCEPTION 'Square is occupied';
  END IF;

  next_board := pg_catalog.jsonb_set(session_row.board, ARRAY[target_cell::text], pg_catalog.to_jsonb(mark), false);
  IF (next_board->>0 = mark AND next_board->>1 = mark AND next_board->>2 = mark)
    OR (next_board->>3 = mark AND next_board->>4 = mark AND next_board->>5 = mark)
    OR (next_board->>6 = mark AND next_board->>7 = mark AND next_board->>8 = mark)
    OR (next_board->>0 = mark AND next_board->>3 = mark AND next_board->>6 = mark)
    OR (next_board->>1 = mark AND next_board->>4 = mark AND next_board->>7 = mark)
    OR (next_board->>2 = mark AND next_board->>5 = mark AND next_board->>8 = mark)
    OR (next_board->>0 = mark AND next_board->>4 = mark AND next_board->>8 = mark)
    OR (next_board->>2 = mark AND next_board->>4 = mark AND next_board->>6 = mark) THEN
    next_status := 'won';
    next_winner := mark;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.generate_series(0, 8) AS cell
      WHERE next_board -> cell = 'null'::jsonb
    ) INTO has_empty_cell;
    IF NOT has_empty_cell THEN
      next_status := 'draw';
    END IF;
  END IF;

  UPDATE public.game_sessions gs
  SET board = next_board,
      turn = CASE WHEN mark = 'X' THEN 'O' ELSE 'X' END,
      status = next_status,
      winner = next_winner,
      revision = gs.revision + 1,
      updated_at = pg_catalog.now()
  WHERE gs.id = target_session_id
  RETURNING * INTO next_row;

  RETURN pg_catalog.to_jsonb(next_row);
END;
$function$

