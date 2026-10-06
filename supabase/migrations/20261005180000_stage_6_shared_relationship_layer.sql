ALTER TABLE public.couples ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';

CREATE TABLE public.daily_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  prompt text NOT NULL CHECK (length(btrim(prompt)) BETWEEN 1 AND 280),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (couple_id, local_date)
);

CREATE TABLE public.daily_question_answers (
  question_id uuid NOT NULL REFERENCES public.daily_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer text NOT NULL CHECK (length(btrim(answer)) BETWEEN 1 AND 1000),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

CREATE TABLE public.bucket_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  completed boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inside_jokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 500),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.relationship_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  event_kind text NOT NULL CHECK (event_kind IN ('game_completed', 'bucket_added', 'bucket_completed')),
  source_id uuid NOT NULL,
  summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 1 AND 240),
  pinned boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (couple_id, event_kind, source_id)
);

CREATE INDEX relationship_timeline_feed ON public.relationship_timeline (couple_id, created_at DESC);

ALTER TABLE public.daily_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bucket_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inside_jokes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationship_timeline ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.daily_questions, public.daily_question_answers, public.bucket_list_items, public.inside_jokes, public.relationship_timeline FROM anon, authenticated;
GRANT SELECT ON public.daily_questions, public.daily_question_answers, public.bucket_list_items, public.inside_jokes, public.relationship_timeline TO authenticated;
GRANT INSERT (couple_id, title) ON public.bucket_list_items TO authenticated;
GRANT UPDATE (title, completed) ON public.bucket_list_items TO authenticated;
GRANT DELETE ON public.bucket_list_items TO authenticated;
GRANT INSERT (couple_id, text) ON public.inside_jokes TO authenticated;
GRANT UPDATE (text) ON public.inside_jokes TO authenticated;
GRANT DELETE ON public.inside_jokes TO authenticated;
GRANT UPDATE (pinned, hidden) ON public.relationship_timeline TO authenticated;

CREATE FUNCTION private.daily_answers_revealed(target_question_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT count(*) FROM public.daily_question_answers a WHERE a.question_id = target_question_id) = 2;
$$;
REVOKE ALL ON FUNCTION private.daily_answers_revealed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.daily_answers_revealed(uuid) TO authenticated;

CREATE POLICY "Couples read their daily questions" ON public.daily_questions FOR SELECT TO authenticated
  USING ((SELECT public.is_couple_member(couple_id)));
CREATE POLICY "Partners read own or revealed daily answers" ON public.daily_question_answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.daily_questions q WHERE q.id = daily_question_answers.question_id
      AND (SELECT public.is_couple_member(q.couple_id))
      AND (daily_question_answers.user_id = (SELECT auth.uid()) OR (SELECT private.daily_answers_revealed(question_id)))
  ));
CREATE POLICY "Couples manage their bucket list" ON public.bucket_list_items FOR ALL TO authenticated
  USING ((SELECT public.is_couple_member(couple_id))) WITH CHECK ((SELECT public.is_couple_member(couple_id)));
CREATE POLICY "Couples manage their inside jokes" ON public.inside_jokes FOR ALL TO authenticated
  USING ((SELECT public.is_couple_member(couple_id))) WITH CHECK ((SELECT public.is_couple_member(couple_id)));
CREATE POLICY "Couples read their timeline" ON public.relationship_timeline FOR SELECT TO authenticated
  USING ((SELECT public.is_couple_member(couple_id)));
CREATE POLICY "Couples curate their timeline" ON public.relationship_timeline FOR UPDATE TO authenticated
  USING ((SELECT public.is_couple_member(couple_id))) WITH CHECK ((SELECT public.is_couple_member(couple_id)));

CREATE FUNCTION public.set_couple_timezone(target_timezone text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE couple_row_id uuid;
BEGIN
  SELECT cm.couple_id INTO couple_row_id FROM public.couple_members cm WHERE cm.user_id = (SELECT auth.uid());
  IF couple_row_id IS NULL THEN RAISE EXCEPTION 'Pair with your partner before setting a timezone'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = target_timezone) THEN
    RAISE EXCEPTION 'Timezone is invalid';
  END IF;
  UPDATE public.couples SET timezone = target_timezone WHERE id = couple_row_id;
  RETURN target_timezone;
END;
$$;
REVOKE ALL ON FUNCTION public.set_couple_timezone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_couple_timezone(text) TO authenticated;

CREATE FUNCTION public.get_or_create_daily_question()
RETURNS public.daily_questions LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  couple_row_id uuid;
  local_day date;
  question_row public.daily_questions;
  prompts text[] := ARRAY[
    'What little moment from today would you like to remember?',
    'When did you feel most at ease with me recently?',
    'What is one kind thing I did that stayed with you?',
    'What ordinary thing would be more fun if we did it together?',
    'What is a place you would like us to visit again?',
    'What new thing would you enjoy learning side by side?',
    'What does a comforting evening together look like to you?',
    'What are you looking forward to this month?',
    'What small tradition should we keep making time for?',
    'What is something about us that makes you smile?',
    'What would make tomorrow feel a little easier?',
    'What meal would you like to make together?',
    'Which song brings back a happy memory of us?',
    'What would you like more of in our everyday life?',
    'What is a little thing you appreciate about our home?',
    'What would your ideal slow weekend together include?',
    'What is something you have changed your mind about lately?',
    'What is one way we make a good team?',
    'What would you like to celebrate soon?',
    'What is a tiny adventure we could take this week?'
  ];
  prompt_index integer;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Sign in to open the daily question'; END IF;
  SELECT cm.couple_id INTO couple_row_id FROM public.couple_members cm WHERE cm.user_id = caller_id;
  IF couple_row_id IS NULL THEN RAISE EXCEPTION 'Pair with your partner to use the daily question'; END IF;
  SELECT (pg_catalog.now() AT TIME ZONE c.timezone)::date INTO local_day FROM public.couples c WHERE c.id = couple_row_id;
  prompt_index := ((pg_catalog.hashtextextended(couple_row_id::text, 0) % pg_catalog.cardinality(prompts)
    + pg_catalog.cardinality(prompts)) % pg_catalog.cardinality(prompts)
    + (local_day - date '1970-01-01') % pg_catalog.cardinality(prompts)) % pg_catalog.cardinality(prompts) + 1;
  INSERT INTO public.daily_questions (couple_id, local_date, prompt)
  VALUES (couple_row_id, local_day, prompts[prompt_index])
  ON CONFLICT (couple_id, local_date) DO NOTHING;
  SELECT * INTO question_row FROM public.daily_questions q WHERE q.couple_id = couple_row_id AND q.local_date = local_day;
  RETURN question_row;
END;
$$;
REVOKE ALL ON FUNCTION public.get_or_create_daily_question() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_daily_question() TO authenticated;

CREATE FUNCTION public.submit_daily_question_answer(target_question_id uuid, target_answer text)
RETURNS public.daily_question_answers LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := (SELECT auth.uid()); answer_row public.daily_question_answers;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Sign in before answering'; END IF;
  IF target_answer IS NULL OR pg_catalog.length(pg_catalog.btrim(target_answer)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Answer must contain 1 to 1000 characters';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.daily_questions q WHERE q.id = target_question_id AND (SELECT public.is_couple_member(q.couple_id))) THEN
    RAISE EXCEPTION 'Daily question is unavailable';
  END IF;
  INSERT INTO public.daily_question_answers (question_id, user_id, answer)
  VALUES (target_question_id, caller_id, pg_catalog.btrim(target_answer)) RETURNING * INTO answer_row;
  RETURN answer_row;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_daily_question_answer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_daily_question_answer(uuid, text) TO authenticated;

CREATE FUNCTION private.add_relationship_timeline_event(target_couple_id uuid, target_kind text, target_source_id uuid, target_summary text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.relationship_timeline (couple_id, event_kind, source_id, summary)
  VALUES (target_couple_id, target_kind, target_source_id, target_summary)
  ON CONFLICT (couple_id, event_kind, source_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION private.add_relationship_timeline_event(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.record_bucket_timeline_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.add_relationship_timeline_event(NEW.couple_id, 'bucket_added', NEW.id, 'Added to the shared bucket list: ' || NEW.title);
    RETURN NEW;
  END IF;
  IF NEW.completed AND NOT OLD.completed THEN
    PERFORM private.add_relationship_timeline_event(NEW.couple_id, 'bucket_completed', NEW.id, 'Completed from the shared bucket list: ' || NEW.title);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.record_bucket_timeline_event() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER bucket_list_timeline_insert AFTER INSERT ON public.bucket_list_items
  FOR EACH ROW EXECUTE FUNCTION private.record_bucket_timeline_event();
CREATE TRIGGER bucket_list_timeline_complete AFTER UPDATE OF completed ON public.bucket_list_items
  FOR EACH ROW WHEN (NEW.completed IS DISTINCT FROM OLD.completed) EXECUTE FUNCTION private.record_bucket_timeline_event();

CREATE FUNCTION private.record_game_timeline_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE couple_row_id uuid;
BEGIN
  IF NEW.status IN ('completed', 'won', 'draw') AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT a.couple_id INTO couple_row_id
    FROM public.couple_members a JOIN public.couple_members b ON b.couple_id = a.couple_id
    WHERE a.user_id = NEW.player_x_id AND b.user_id = NEW.player_o_id;
    IF couple_row_id IS NOT NULL THEN
      PERFORM private.add_relationship_timeline_event(couple_row_id, 'game_completed', NEW.id, 'Finished a game of ' || pg_catalog.replace(NEW.game_type, '-', ' '));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.record_game_timeline_event() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER game_session_timeline_complete AFTER UPDATE OF status ON public.game_sessions
  FOR EACH ROW EXECUTE FUNCTION private.record_game_timeline_event();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'daily_question_answers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_question_answers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bucket_list_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bucket_list_items;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inside_jokes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inside_jokes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'relationship_timeline') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.relationship_timeline;
  END IF;
END;
$$;
