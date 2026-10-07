CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE TABLE public.temporary_location_shares (
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_meters double precision NOT NULL CHECK (accuracy_meters BETWEEN 0 AND 100000),
  started_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > started_at),
  PRIMARY KEY (couple_id, shared_by)
);
CREATE INDEX temporary_location_shares_expiry ON public.temporary_location_shares(expires_at);
ALTER TABLE public.temporary_location_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.temporary_location_shares FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.temporary_location_shares TO authenticated;
CREATE POLICY "Couples read unexpired location shares" ON public.temporary_location_shares FOR SELECT TO authenticated
  USING ((SELECT public.is_couple_member(couple_id)) AND expires_at > pg_catalog.now());

CREATE FUNCTION public.start_location_share(
  target_couple_id uuid, target_latitude double precision, target_longitude double precision,
  target_accuracy_meters double precision, target_duration_minutes integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL OR NOT public.is_couple_member(target_couple_id) THEN RAISE EXCEPTION 'Couple membership required'; END IF;
  IF target_duration_minutes NOT IN (15, 30, 60) THEN RAISE EXCEPTION 'Unsupported share duration'; END IF;
  IF target_latitude IS NULL OR target_latitude NOT BETWEEN -90 AND 90
    OR target_longitude IS NULL OR target_longitude NOT BETWEEN -180 AND 180
    OR target_accuracy_meters IS NULL OR target_accuracy_meters NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION 'Invalid location';
  END IF;
  INSERT INTO public.temporary_location_shares (couple_id, shared_by, latitude, longitude, accuracy_meters, started_at, updated_at, expires_at)
  VALUES (target_couple_id, caller_id, target_latitude, target_longitude, target_accuracy_meters, pg_catalog.now(), pg_catalog.now(), pg_catalog.now() + pg_catalog.make_interval(mins => target_duration_minutes))
  ON CONFLICT (couple_id, shared_by) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
    accuracy_meters = EXCLUDED.accuracy_meters, started_at = EXCLUDED.started_at, updated_at = EXCLUDED.updated_at, expires_at = EXCLUDED.expires_at;
END;
$$;
REVOKE ALL ON FUNCTION public.start_location_share(uuid, double precision, double precision, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_location_share(uuid, double precision, double precision, double precision, integer) TO authenticated;

CREATE FUNCTION public.update_location_share(
  target_couple_id uuid, target_latitude double precision, target_longitude double precision, target_accuracy_meters double precision
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL OR NOT public.is_couple_member(target_couple_id) THEN RAISE EXCEPTION 'Couple membership required'; END IF;
  IF target_latitude IS NULL OR target_latitude NOT BETWEEN -90 AND 90
    OR target_longitude IS NULL OR target_longitude NOT BETWEEN -180 AND 180
    OR target_accuracy_meters IS NULL OR target_accuracy_meters NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION 'Invalid location';
  END IF;
  UPDATE public.temporary_location_shares SET latitude = target_latitude, longitude = target_longitude,
    accuracy_meters = target_accuracy_meters, updated_at = pg_catalog.now()
  WHERE couple_id = target_couple_id AND shared_by = caller_id AND expires_at > pg_catalog.now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Location share is no longer active'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.update_location_share(uuid, double precision, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_location_share(uuid, double precision, double precision, double precision) TO authenticated;

CREATE FUNCTION public.stop_location_share(target_couple_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL OR NOT public.is_couple_member(target_couple_id) THEN RAISE EXCEPTION 'Couple membership required'; END IF;
  DELETE FROM public.temporary_location_shares WHERE couple_id = target_couple_id AND shared_by = caller_id;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.stop_location_share(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stop_location_share(uuid) TO authenticated;

CREATE FUNCTION public.purge_expired_location_shares()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE removed integer;
BEGIN
  DELETE FROM public.temporary_location_shares WHERE expires_at <= pg_catalog.now();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_expired_location_shares() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('purge-temporary-location-shares', '* * * * *', 'SELECT public.purge_expired_location_shares()');

CREATE POLICY "Couple members receive location refresh broadcasts" ON realtime.messages FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND EXISTS (
    SELECT 1 FROM public.couple_members cm WHERE cm.user_id = (SELECT auth.uid())
      AND realtime.topic() = 'temporary-location:' || cm.couple_id::text
  ));

CREATE FUNCTION public.broadcast_location_refresh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target_couple_id uuid := COALESCE(NEW.couple_id, OLD.couple_id);
BEGIN
  PERFORM realtime.send(pg_catalog.jsonb_build_object('operation', TG_OP), 'location_refresh', 'temporary-location:' || target_couple_id::text, true);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.broadcast_location_refresh() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER broadcast_location_refresh AFTER INSERT OR UPDATE OR DELETE ON public.temporary_location_shares
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_location_refresh();
