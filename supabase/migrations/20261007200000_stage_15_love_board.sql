CREATE TABLE public.love_boards (
  couple_id uuid PRIMARY KEY REFERENCES public.couples(id) ON DELETE CASCADE,
  generation integer NOT NULL DEFAULT 1 CHECK (generation > 0),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
ALTER TABLE public.love_boards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.love_boards FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.love_boards TO authenticated;
CREATE POLICY "Couples read their love board" ON public.love_boards FOR SELECT TO authenticated
  USING ((SELECT public.is_couple_member(couple_id)));

CREATE TABLE public.love_board_strokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  generation integer NOT NULL CHECK (generation > 0),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points jsonb NOT NULL,
  color text NOT NULL CHECK (color IN ('#426f88','#e5858b','#f2b66d','#6f8d68')),
  width integer NOT NULL CHECK (width BETWEEN 2 AND 20),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CHECK (pg_catalog.jsonb_typeof(points) = 'array' AND pg_catalog.jsonb_array_length(points) BETWEEN 2 AND 500)
);
CREATE INDEX love_board_strokes_current ON public.love_board_strokes(couple_id, generation, created_at, id);
ALTER TABLE public.love_board_strokes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.love_board_strokes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.love_board_strokes TO authenticated;
CREATE POLICY "Couples read their love board strokes" ON public.love_board_strokes FOR SELECT TO authenticated
  USING ((SELECT public.is_couple_member(couple_id)));

CREATE FUNCTION public.ensure_love_board(target_couple_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := auth.uid();
DECLARE board_generation integer;
BEGIN
  IF caller_id IS NULL OR NOT public.is_couple_member(target_couple_id) THEN RAISE EXCEPTION 'Couple membership required'; END IF;
  INSERT INTO public.love_boards (couple_id) VALUES (target_couple_id) ON CONFLICT (couple_id) DO NOTHING;
  SELECT generation INTO board_generation FROM public.love_boards WHERE couple_id = target_couple_id;
  RETURN board_generation;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_love_board(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_love_board(uuid) TO authenticated;

CREATE FUNCTION public.append_love_board_stroke(target_couple_id uuid, target_generation integer, target_points jsonb, target_color text, target_width integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := auth.uid();
DECLARE current_generation integer;
DECLARE point_value jsonb;
DECLARE point_x double precision;
DECLARE point_y double precision;
BEGIN
  IF caller_id IS NULL OR NOT public.is_couple_member(target_couple_id) THEN RAISE EXCEPTION 'Couple membership required'; END IF;
  SELECT generation INTO current_generation FROM public.love_boards WHERE couple_id = target_couple_id FOR UPDATE;
  IF current_generation IS NULL OR current_generation <> target_generation THEN RAISE EXCEPTION 'Board changed; refresh before drawing'; END IF;
  IF pg_catalog.jsonb_typeof(target_points) <> 'array' OR pg_catalog.jsonb_array_length(target_points) NOT BETWEEN 2 AND 500 THEN RAISE EXCEPTION 'A stroke needs 2 to 500 points'; END IF;
  IF target_color NOT IN ('#426f88','#e5858b','#f2b66d','#6f8d68') THEN RAISE EXCEPTION 'Unsupported board color'; END IF;
  IF target_width NOT BETWEEN 2 AND 20 THEN RAISE EXCEPTION 'Unsupported stroke width'; END IF;
  FOR point_value IN SELECT value FROM pg_catalog.jsonb_array_elements(target_points) LOOP
    IF pg_catalog.jsonb_typeof(point_value) <> 'object' OR pg_catalog.jsonb_typeof(point_value->'x') <> 'number' OR pg_catalog.jsonb_typeof(point_value->'y') <> 'number' THEN
      RAISE EXCEPTION 'Invalid board point';
    END IF;
    BEGIN
      point_x := (point_value->>'x')::double precision;
      point_y := (point_value->>'y')::double precision;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Invalid board point';
    END;
    IF point_x NOT BETWEEN 0 AND 1000 OR point_y NOT BETWEEN 0 AND 1000 THEN RAISE EXCEPTION 'Board point is outside the canvas'; END IF;
  END LOOP;
  IF (SELECT pg_catalog.count(*) FROM public.love_board_strokes WHERE couple_id = target_couple_id AND generation = current_generation) >= 1000 THEN
    RAISE EXCEPTION 'Board is full; clear it before adding more strokes';
  END IF;
  INSERT INTO public.love_board_strokes (couple_id, generation, created_by, points, color, width)
  VALUES (target_couple_id, current_generation, caller_id, target_points, target_color, target_width);
  UPDATE public.love_boards SET updated_at = pg_catalog.now() WHERE couple_id = target_couple_id;
END;
$$;
REVOKE ALL ON FUNCTION public.append_love_board_stroke(uuid, integer, jsonb, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_love_board_stroke(uuid, integer, jsonb, text, integer) TO authenticated;

CREATE FUNCTION public.undo_love_board_stroke(target_couple_id uuid, target_generation integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := auth.uid();
DECLARE current_generation integer;
BEGIN
  IF caller_id IS NULL OR NOT public.is_couple_member(target_couple_id) THEN RAISE EXCEPTION 'Couple membership required'; END IF;
  SELECT generation INTO current_generation FROM public.love_boards WHERE couple_id = target_couple_id FOR UPDATE;
  IF current_generation IS NULL OR current_generation <> target_generation THEN RAISE EXCEPTION 'Board changed; refresh before undoing'; END IF;
  DELETE FROM public.love_board_strokes WHERE id = (
    SELECT id FROM public.love_board_strokes WHERE couple_id = target_couple_id AND generation = current_generation AND created_by = caller_id
    ORDER BY created_at DESC, id DESC LIMIT 1
  );
  IF FOUND THEN UPDATE public.love_boards SET updated_at = pg_catalog.now() WHERE couple_id = target_couple_id; END IF;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.undo_love_board_stroke(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_love_board_stroke(uuid, integer) TO authenticated;

CREATE FUNCTION public.clear_love_board(target_couple_id uuid, target_generation integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := auth.uid();
DECLARE current_generation integer;
BEGIN
  IF caller_id IS NULL OR NOT public.is_couple_member(target_couple_id) THEN RAISE EXCEPTION 'Couple membership required'; END IF;
  SELECT generation INTO current_generation FROM public.love_boards WHERE couple_id = target_couple_id FOR UPDATE;
  IF current_generation IS NULL OR current_generation <> target_generation THEN RAISE EXCEPTION 'Board changed; refresh before clearing'; END IF;
  DELETE FROM public.love_board_strokes WHERE couple_id = target_couple_id;
  UPDATE public.love_boards SET generation = current_generation + 1, updated_at = pg_catalog.now() WHERE couple_id = target_couple_id;
  RETURN current_generation + 1;
END;
$$;
REVOKE ALL ON FUNCTION public.clear_love_board(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_love_board(uuid, integer) TO authenticated;

CREATE POLICY "Couple members receive love board refresh broadcasts" ON realtime.messages FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND EXISTS (
    SELECT 1 FROM public.couple_members cm WHERE cm.user_id = (SELECT auth.uid())
      AND realtime.topic() = 'love-board:' || cm.couple_id::text
  ));

CREATE FUNCTION public.broadcast_love_board_refresh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_couple_id uuid := COALESCE(NEW.couple_id, OLD.couple_id);
BEGIN
  PERFORM realtime.send(pg_catalog.jsonb_build_object('operation', TG_OP), 'board_refresh', 'love-board:' || target_couple_id::text, true);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.broadcast_love_board_refresh() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER broadcast_love_board_stroke_refresh AFTER INSERT OR DELETE ON public.love_board_strokes
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_love_board_refresh();
CREATE TRIGGER broadcast_love_board_refresh AFTER INSERT OR UPDATE ON public.love_boards
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_love_board_refresh();
