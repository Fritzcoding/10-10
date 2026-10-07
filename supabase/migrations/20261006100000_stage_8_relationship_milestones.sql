CREATE TABLE public.relationship_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('anniversary','birthday','trip','visit','other')),
  milestone_date date NOT NULL,
  annual boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX relationship_milestones_couple_date ON public.relationship_milestones (couple_id, milestone_date);
CREATE UNIQUE INDEX relationship_milestones_one_featured_per_couple ON public.relationship_milestones (couple_id) WHERE featured;
REVOKE ALL ON public.relationship_milestones FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationship_milestones TO authenticated;
CREATE FUNCTION public.set_featured_milestone(target_milestone_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := auth.uid(); target_couple_id uuid;
BEGIN
  SELECT couple_id INTO target_couple_id FROM public.relationship_milestones WHERE id = target_milestone_id;
  IF caller_id IS NULL OR target_couple_id IS NULL OR NOT public.is_couple_member(target_couple_id) THEN
    RAISE EXCEPTION 'Milestone unavailable';
  END IF;
  UPDATE public.relationship_milestones SET featured = false WHERE couple_id = target_couple_id AND featured;
  UPDATE public.relationship_milestones SET featured = true WHERE id = target_milestone_id;
  RETURN target_milestone_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_featured_milestone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_featured_milestone(uuid) TO authenticated;
CREATE POLICY "Couples manage their milestones" ON public.relationship_milestones
  FOR ALL TO authenticated
  USING ((SELECT public.is_couple_member(couple_id)))
  WITH CHECK ((SELECT public.is_couple_member(couple_id)));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'relationship_milestones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.relationship_milestones;
  END IF;
END $$;
ALTER TABLE public.relationship_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Couple members receive milestone broadcasts" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    extension = 'broadcast'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND realtime.topic() = 'relationship-milestones:' || cm.couple_id::text
    )
  );
CREATE FUNCTION public.broadcast_relationship_milestone_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_couple_id uuid := COALESCE(NEW.couple_id, OLD.couple_id);
BEGIN
  PERFORM realtime.broadcast_changes(
    'relationship-milestones:' || target_couple_id::text,
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.broadcast_relationship_milestone_changes() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER broadcast_relationship_milestone_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.relationship_milestones
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_relationship_milestone_changes();
