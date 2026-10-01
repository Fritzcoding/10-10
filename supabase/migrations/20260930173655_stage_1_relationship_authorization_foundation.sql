CREATE TABLE public.couples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.couple_members (
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  member_slot smallint NOT NULL CHECK (member_slot IN (1, 2)),
  UNIQUE (couple_id, member_slot)
);

CREATE OR REPLACE FUNCTION public.is_couple_member(target_couple_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = target_couple_id
        AND cm.user_id = (SELECT auth.uid())
    );
$$;

CREATE OR REPLACE FUNCTION public.are_couple_members(target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.couple_members mine
      JOIN public.couple_members theirs USING (couple_id)
      WHERE mine.user_id = (SELECT auth.uid())
        AND theirs.user_id = target_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.get_couple_partner()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p
  FROM public.couple_members mine
  JOIN public.couple_members partner USING (couple_id)
  JOIN public.profiles p ON p.id = partner.user_id
  WHERE mine.user_id = (SELECT auth.uid())
    AND partner.user_id <> mine.user_id;
$$;

CREATE OR REPLACE FUNCTION public.search_profile(target_query text)
RETURNS TABLE (
  id uuid,
  display_uid bigint,
  email text,
  display_name text,
  partner_id uuid,
  partner_name text,
  avatar_url text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.display_uid, au.email, p.display_name, p.partner_id, p.partner_name, p.avatar_url
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND p.id <> (SELECT auth.uid())
    AND (
      (target_query ~ '^[0-9]+$' AND p.display_uid::text = target_query)
      OR (target_query LIKE '%@%' AND pg_catalog.lower(au.email) = pg_catalog.lower(pg_catalog.btrim(target_query)))
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_friend_request(target_request_id uuid, accept_request boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  request_row public.friend_requests;
  couple_row_id uuid;
  member_count integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before responding to a request';
  END IF;

  SELECT fr.* INTO request_row
  FROM public.friend_requests fr
  WHERE fr.id = target_request_id
    AND fr.recipient_id = caller_id
    AND fr.status = 'pending'
  FOR UPDATE;

  IF request_row.id IS NULL THEN
    RAISE EXCEPTION 'Friend request is no longer pending';
  END IF;

  IF NOT accept_request THEN
    DELETE FROM public.friend_requests WHERE id = target_request_id;
    RETURN jsonb_build_object('status', 'declined');
  END IF;

  PERFORM p.id
  FROM public.profiles p
  WHERE p.id IN (request_row.requester_id, request_row.recipient_id)
  ORDER BY p.id
  FOR UPDATE;

  SELECT count(*) INTO member_count
  FROM public.profiles p
  WHERE p.id IN (request_row.requester_id, request_row.recipient_id);
  IF member_count <> 2 THEN
    RAISE EXCEPTION 'Both profiles must exist before accepting a request';
  END IF;

  IF request_row.request_type = 'partner' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.friend_requests fr
      WHERE fr.request_type = 'friend'
        AND fr.status = 'accepted'
        AND ((fr.requester_id = request_row.requester_id AND fr.recipient_id = request_row.recipient_id)
          OR (fr.requester_id = request_row.recipient_id AND fr.recipient_id = request_row.requester_id))
    ) THEN
      RAISE EXCEPTION 'Accept a friend request before pairing';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id IN (request_row.requester_id, request_row.recipient_id)
    ) THEN
      RAISE EXCEPTION 'A participant already belongs to a couple';
    END IF;

    INSERT INTO public.couples DEFAULT VALUES RETURNING id INTO couple_row_id;
    INSERT INTO public.couple_members (couple_id, user_id, member_slot)
    VALUES (couple_row_id, LEAST(request_row.requester_id, request_row.recipient_id), 1),
           (couple_row_id, GREATEST(request_row.requester_id, request_row.recipient_id), 2);

    UPDATE public.profiles AS p
    SET partner_id = other.id,
        partner_name = COALESCE(other.display_name, other_auth.email)
    FROM public.profiles AS other
    JOIN auth.users AS other_auth ON other_auth.id = other.id
    WHERE p.id IN (request_row.requester_id, request_row.recipient_id)
      AND other.id <> p.id
      AND other.id IN (request_row.requester_id, request_row.recipient_id);
  END IF;

  UPDATE public.friend_requests
  SET status = 'accepted'
  WHERE id = target_request_id;

  RETURN jsonb_build_object('status', 'accepted', 'couple_id', couple_row_id);
END;
$$;

REVOKE ALL ON FUNCTION public.is_couple_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.are_couple_members(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_couple_partner() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_profile(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_friend_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_couple_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_couple_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_couple_partner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_profile(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_friend_request(uuid, boolean) TO authenticated;

ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.couples, public.couple_members FROM anon, authenticated;
GRANT SELECT ON TABLE public.couples, public.couple_members TO authenticated;

CREATE POLICY "couple members can read their couple"
  ON public.couples FOR SELECT TO authenticated
  USING ((SELECT public.is_couple_member(couples.id)));

CREATE POLICY "couple members can read memberships"
  ON public.couple_members FOR SELECT TO authenticated
  USING ((SELECT public.is_couple_member(couple_members.couple_id)));

-- Backfill only explicit, non-conflicting pairs. Reciprocal profile links are
-- sufficient; a one-way link also needs exactly one accepted partner request
-- for the same two users. Any user involved in multiple candidate pairs is skipped.
DO $backfill$
DECLARE
  candidate record;
  new_couple_id uuid;
BEGIN
  FOR candidate IN
    WITH candidates AS (
      SELECT a.id AS user_one, b.id AS user_two
      FROM public.profiles a
      JOIN public.profiles b ON a.id < b.id
      WHERE a.partner_id = b.id AND b.partner_id = a.id

      UNION

      SELECT a.id AS user_one, b.id AS user_two
      FROM public.profiles a
      JOIN public.profiles b ON a.id < b.id
      WHERE (a.partner_id = b.id OR b.partner_id = a.id)
        AND (
          SELECT count(*)
          FROM public.friend_requests fr
          WHERE fr.request_type = 'partner'
            AND fr.status = 'accepted'
            AND ((fr.requester_id = a.id AND fr.recipient_id = b.id)
              OR (fr.requester_id = b.id AND fr.recipient_id = a.id))
        ) = 1
    )
    SELECT c.user_one, c.user_two
    FROM candidates c
    WHERE NOT EXISTS (
      SELECT 1 FROM candidates other
      WHERE (other.user_one, other.user_two) <> (c.user_one, c.user_two)
        AND (other.user_one IN (c.user_one, c.user_two)
          OR other.user_two IN (c.user_one, c.user_two))
    )
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id IN (c.user_one, c.user_two)
          AND p.partner_id IS NOT NULL
          AND p.partner_id NOT IN (c.user_one, c.user_two)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.user_id IN (c.user_one, c.user_two)
      )
  LOOP
    INSERT INTO public.couples DEFAULT VALUES RETURNING id INTO new_couple_id;
    INSERT INTO public.couple_members (couple_id, user_id, member_slot)
    VALUES (new_couple_id, candidate.user_one, 1),
           (new_couple_id, candidate.user_two, 2);

    UPDATE public.profiles AS p
    SET partner_id = other.id,
        partner_name = COALESCE(other.display_name, other.email)
    FROM public.profiles AS other
    WHERE p.id IN (candidate.user_one, candidate.user_two)
      AND other.id <> p.id
      AND other.id IN (candidate.user_one, candidate.user_two);
  END LOOP;
END;
$backfill$;

DROP POLICY IF EXISTS "Authenticated users can discover profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;

CREATE POLICY "Users can read their own and connected profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.are_couple_members(id))
    OR EXISTS (
      SELECT 1 FROM public.friend_requests fr
      WHERE fr.status IN ('pending', 'accepted')
        AND ((fr.requester_id = (SELECT auth.uid()) AND fr.recipient_id = profiles.id)
          OR (fr.recipient_id = (SELECT auth.uid()) AND fr.requester_id = profiles.id))
    )
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create their own friend requests" ON public.friend_requests;
CREATE POLICY "Users can create pending friend requests"
  ON public.friend_requests FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = (SELECT auth.uid())
    AND status = 'pending'
  );

REVOKE UPDATE ON TABLE public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name, avatar_url) ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Participants can read direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;

CREATE POLICY "Couple members can read their direct messages"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (
    (SELECT public.are_couple_members(sender_id))
    AND (SELECT public.are_couple_members(recipient_id))
  );

CREATE POLICY "Couple members can message each other"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND (SELECT public.are_couple_members(recipient_id))
  );

REVOKE ALL ON TABLE public.direct_messages FROM anon;
REVOKE UPDATE, DELETE ON TABLE public.direct_messages FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.direct_messages TO authenticated;

ALTER TABLE public.game_sessions
  ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0);

DROP POLICY IF EXISTS "sessions visible to players" ON public.game_sessions;
DROP POLICY IF EXISTS "players update their sessions" ON public.game_sessions;

CREATE POLICY "Couple members can read their sessions"
  ON public.game_sessions FOR SELECT TO authenticated
  USING (
    (SELECT public.are_couple_members(player_x_id))
    AND (SELECT public.are_couple_members(player_o_id))
  );

DROP POLICY IF EXISTS "game requests visible to participants" ON public.game_requests;
DROP POLICY IF EXISTS "recipients update pending requests" ON public.game_requests;
DROP POLICY IF EXISTS "users create own game requests" ON public.game_requests;

CREATE POLICY "Couple members can read their game requests"
  ON public.game_requests FOR SELECT TO authenticated
  USING (
    (SELECT public.are_couple_members(requester_id))
    AND (SELECT public.are_couple_members(recipient_id))
  );

REVOKE ALL ON TABLE public.game_sessions, public.game_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.game_sessions, public.game_requests FROM authenticated;
GRANT SELECT ON TABLE public.game_sessions, public.game_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.create_game_request(target_recipient_id uuid)
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
  IF caller_id = target_recipient_id OR NOT public.are_couple_members(target_recipient_id) THEN
    RAISE EXCEPTION 'Game requests are limited to your partner';
  END IF;

  UPDATE public.game_requests gr
  SET status = 'expired', updated_at = pg_catalog.now()
  WHERE gr.requester_id = caller_id
    AND gr.recipient_id = target_recipient_id
    AND gr.status = 'pending'
    AND gr.expires_at <= pg_catalog.now();

  SELECT gr.* INTO request_row
  FROM public.game_requests gr
  WHERE gr.requester_id = caller_id
    AND gr.recipient_id = target_recipient_id
    AND gr.status = 'pending'
    AND gr.expires_at > pg_catalog.now();

  IF request_row.id IS NOT NULL THEN
    RETURN pg_catalog.to_jsonb(request_row) || pg_catalog.jsonb_build_object('wasExisting', true);
  END IF;

  INSERT INTO public.game_requests (requester_id, recipient_id)
  VALUES (caller_id, target_recipient_id)
  ON CONFLICT (requester_id, recipient_id, game_type) WHERE status = 'pending' DO NOTHING
  RETURNING * INTO request_row;

  IF request_row.id IS NULL THEN
    SELECT gr.* INTO request_row
    FROM public.game_requests gr
    WHERE gr.requester_id = caller_id
      AND gr.recipient_id = target_recipient_id
      AND gr.status = 'pending';
    RETURN pg_catalog.to_jsonb(request_row) || pg_catalog.jsonb_build_object('wasExisting', true);
  END IF;

  RETURN pg_catalog.to_jsonb(request_row);
END;
$$;

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

  INSERT INTO public.game_sessions (player_x_id, player_o_id)
  VALUES (request_row.requester_id, request_row.recipient_id)
  RETURNING * INTO session_row;

  RETURN pg_catalog.jsonb_build_object('request', pg_catalog.to_jsonb(request_row), 'session_id', session_row.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_game_request(target_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before declining a game request';
  END IF;

  UPDATE public.game_requests gr
  SET status = 'declined', updated_at = pg_catalog.now()
  WHERE gr.id = target_request_id
    AND gr.recipient_id = caller_id
    AND gr.status = 'pending'
    AND gr.expires_at > pg_catalog.now()
    AND public.are_couple_members(gr.requester_id);

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_tic_tac_toe_move(
  target_session_id uuid,
  target_revision integer,
  target_cell integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
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
    OR NOT public.are_couple_members(session_row.player_x_id)
    OR NOT public.are_couple_members(session_row.player_o_id) THEN
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
$$;

REVOKE ALL ON FUNCTION public.create_game_request(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_game_request(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decline_game_request(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_tic_tac_toe_move(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_game_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_game_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_tic_tac_toe_move(uuid, integer, integer) TO authenticated;

REVOKE UPDATE, DELETE ON TABLE public.friend_requests FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.friend_requests TO authenticated;
REVOKE ALL ON TABLE public.game_sessions, public.game_requests, public.friend_requests FROM anon;

CREATE OR REPLACE FUNCTION public.generate_profile_uid()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  alphabet CONSTANT text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  character_position integer;
BEGIN
  LOOP
    candidate := '';
    FOR character_position IN 1..8 LOOP
      candidate := candidate || pg_catalog.substr(
        alphabet,
        pg_catalog.floor(pg_catalog.random() * pg_catalog.length(alphabet) + 1)::integer,
        1
      );
      IF character_position = 4 THEN
        candidate := candidate || '-';
      END IF;
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.uid = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_profile_uid() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_profile_uid() TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
