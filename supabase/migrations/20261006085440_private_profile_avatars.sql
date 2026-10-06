INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-avatars', 'profile-avatars', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE FUNCTION private.can_read_profile_avatar(target_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT target_user_id = (SELECT auth.uid())
    OR (SELECT public.are_couple_members(target_user_id))
    OR EXISTS (
      SELECT 1 FROM public.friend_requests fr
      WHERE fr.request_type = 'friend' AND fr.status = 'accepted'
        AND ((fr.requester_id = (SELECT auth.uid()) AND fr.recipient_id = target_user_id)
          OR (fr.recipient_id = (SELECT auth.uid()) AND fr.requester_id = target_user_id))
    );
$$;
REVOKE ALL ON FUNCTION private.can_read_profile_avatar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_read_profile_avatar(uuid) TO authenticated;

CREATE POLICY "profile avatar owner and connections read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND CASE
      WHEN name ~ '^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}/avatar$'
      THEN (SELECT private.can_read_profile_avatar(split_part(name, '/', 1)::uuid))
      ELSE false
    END
  );

CREATE POLICY "profile avatar owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-avatars' AND name = (SELECT auth.uid())::text || '/avatar');

CREATE POLICY "profile avatar owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-avatars' AND name = (SELECT auth.uid())::text || '/avatar')
  WITH CHECK (bucket_id = 'profile-avatars' AND name = (SELECT auth.uid())::text || '/avatar');

CREATE POLICY "profile avatar owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-avatars' AND name = (SELECT auth.uid())::text || '/avatar');
