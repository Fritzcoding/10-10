CREATE TABLE public.relationship_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  timezone text NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  event_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  milestone_id uuid REFERENCES public.relationship_milestones(id) ON DELETE SET NULL,
  wishlist_item_id uuid REFERENCES public.bucket_list_items(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((all_day AND event_date IS NOT NULL AND starts_at IS NULL AND ends_at IS NULL)
    OR (NOT all_day AND event_date IS NULL AND starts_at IS NOT NULL AND (ends_at IS NULL OR ends_at > starts_at)))
);
CREATE INDEX relationship_events_couple_date ON public.relationship_events(couple_id, event_date, starts_at);
ALTER TABLE public.relationship_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.relationship_events FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_events TO authenticated;
CREATE POLICY "Couples manage their relationship events" ON public.relationship_events
  FOR ALL TO authenticated USING ((SELECT public.is_couple_member(couple_id)))
  WITH CHECK ((SELECT public.is_couple_member(couple_id)));

CREATE FUNCTION public.validate_relationship_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = NEW.timezone) THEN
    RAISE EXCEPTION 'Timezone is invalid';
  END IF;
  IF NEW.milestone_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.relationship_milestones m WHERE m.id = NEW.milestone_id AND m.couple_id = NEW.couple_id
  ) THEN RAISE EXCEPTION 'Milestone must belong to this couple'; END IF;
  IF NEW.wishlist_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.bucket_list_items i WHERE i.id = NEW.wishlist_item_id AND i.couple_id = NEW.couple_id
  ) THEN RAISE EXCEPTION 'Wishlist item must belong to this couple'; END IF;
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_relationship_event() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_relationship_event BEFORE INSERT OR UPDATE ON public.relationship_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_relationship_event();

CREATE POLICY "Couple members receive calendar broadcasts" ON realtime.messages
  FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND EXISTS (
    SELECT 1 FROM public.couple_members cm
    WHERE cm.user_id = (SELECT auth.uid())
      AND realtime.topic() = 'shared-calendar:' || cm.couple_id::text
  ));
CREATE FUNCTION public.broadcast_relationship_event_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_couple_id uuid := COALESCE(NEW.couple_id, OLD.couple_id);
BEGIN
  PERFORM realtime.broadcast_changes(
    'shared-calendar:' || target_couple_id::text,
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.broadcast_relationship_event_changes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER broadcast_relationship_event_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.relationship_events
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_relationship_event_changes();
