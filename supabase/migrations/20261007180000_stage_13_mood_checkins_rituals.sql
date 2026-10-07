CREATE TABLE public.relationship_mood_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mood text NOT NULL CHECK (mood IN ('happy','loved','calm','okay','low','stressed','tired','excited')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX relationship_mood_checkins_couple_created ON public.relationship_mood_checkins(couple_id, created_at DESC);
ALTER TABLE public.relationship_mood_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.relationship_mood_checkins FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.relationship_mood_checkins TO authenticated;
GRANT INSERT (couple_id, mood, note, shared) ON public.relationship_mood_checkins TO authenticated;
GRANT UPDATE (mood, note, shared) ON public.relationship_mood_checkins TO authenticated;
CREATE POLICY "Authors and partners read shared moods" ON public.relationship_mood_checkins FOR SELECT TO authenticated
  USING ((SELECT public.is_couple_member(couple_id)) AND (created_by = (SELECT auth.uid()) OR shared));
CREATE POLICY "Members create their own mood check-ins" ON public.relationship_mood_checkins FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_couple_member(couple_id)) AND created_by = (SELECT auth.uid()));
CREATE POLICY "Authors update their mood check-ins" ON public.relationship_mood_checkins FOR UPDATE TO authenticated
  USING ((SELECT public.is_couple_member(couple_id)) AND created_by = (SELECT auth.uid()))
  WITH CHECK ((SELECT public.is_couple_member(couple_id)) AND created_by = (SELECT auth.uid()));
CREATE POLICY "Authors delete their mood check-ins" ON public.relationship_mood_checkins FOR DELETE TO authenticated
  USING ((SELECT public.is_couple_member(couple_id)) AND created_by = (SELECT auth.uid()));

CREATE TABLE public.couple_rituals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 100),
  prompt text NOT NULL DEFAULT '' CHECK (length(prompt) <= 500),
  participation_mode text NOT NULL DEFAULT 'both' CHECK (participation_mode IN ('either','both')),
  reminders_enabled boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, couple_id)
);
CREATE INDEX couple_rituals_couple_created ON public.couple_rituals(couple_id, created_at DESC);
ALTER TABLE public.couple_rituals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.couple_rituals FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.couple_rituals TO authenticated;
CREATE POLICY "Couples manage their rituals" ON public.couple_rituals FOR ALL TO authenticated
  USING ((SELECT public.is_couple_member(couple_id))) WITH CHECK ((SELECT public.is_couple_member(couple_id)));

CREATE TABLE public.ritual_checkins (
  ritual_id uuid NOT NULL,
  couple_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ritual_id, week_start, user_id),
  FOREIGN KEY (ritual_id, couple_id) REFERENCES public.couple_rituals(id, couple_id) ON DELETE CASCADE
);
CREATE INDEX ritual_checkins_couple_week ON public.ritual_checkins(couple_id, week_start);
ALTER TABLE public.ritual_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ritual_checkins FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.ritual_checkins TO authenticated;
CREATE POLICY "Couples read ritual check-ins" ON public.ritual_checkins FOR SELECT TO authenticated
  USING ((SELECT public.is_couple_member(couple_id)));
CREATE POLICY "Members check in for themselves" ON public.ritual_checkins FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_couple_member(couple_id)) AND user_id = (SELECT auth.uid()));
CREATE POLICY "Members remove their own check-in" ON public.ritual_checkins FOR DELETE TO authenticated
  USING ((SELECT public.is_couple_member(couple_id)) AND user_id = (SELECT auth.uid()));

CREATE POLICY "Couple members receive relationship broadcasts" ON realtime.messages FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND EXISTS (
    SELECT 1 FROM public.couple_members cm
    WHERE cm.user_id = (SELECT auth.uid())
      AND realtime.topic() = 'relationship-rituals:' || cm.couple_id::text
  ));

CREATE FUNCTION public.broadcast_relationship_mood_refresh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_couple_id uuid := COALESCE(NEW.couple_id, OLD.couple_id);
DECLARE should_broadcast boolean :=
  CASE TG_OP WHEN 'DELETE' THEN OLD.shared
    WHEN 'UPDATE' THEN OLD.shared OR NEW.shared ELSE NEW.shared END;
BEGIN
  IF should_broadcast THEN
    PERFORM realtime.send(jsonb_build_object('operation', TG_OP), 'mood_refresh', 'relationship-rituals:' || target_couple_id::text, true);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.broadcast_relationship_mood_refresh() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER broadcast_relationship_mood_refresh AFTER INSERT OR UPDATE OR DELETE ON public.relationship_mood_checkins
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_relationship_mood_refresh();

CREATE FUNCTION public.broadcast_relationship_ritual_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_couple_id uuid := COALESCE(NEW.couple_id, OLD.couple_id);
BEGIN
  PERFORM realtime.broadcast_changes('relationship-rituals:' || target_couple_id::text, TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.broadcast_relationship_ritual_changes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER broadcast_couple_ritual_changes AFTER INSERT OR UPDATE OR DELETE ON public.couple_rituals
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_relationship_ritual_changes();
CREATE TRIGGER broadcast_ritual_checkin_changes AFTER INSERT OR DELETE ON public.ritual_checkins
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_relationship_ritual_changes();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'relationship_mood_checkins') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.relationship_mood_checkins;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'couple_rituals') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.couple_rituals;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ritual_checkins') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ritual_checkins;
  END IF;
END $$;
