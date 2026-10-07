BEGIN;
SELECT plan(16);
SELECT has_table('public', 'photo_memories', 'photo memories table exists');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.photo_memories'::regclass), 'photo memory rows enforce RLS');
SELECT ok(NOT has_table_privilege('anon', 'public.photo_memories', 'SELECT'), 'anonymous users cannot read photo memories');
SELECT ok((SELECT NOT public FROM storage.buckets WHERE id = 'couple-memories'), 'memory bucket is private');
SELECT is((SELECT file_size_limit::bigint FROM storage.buckets WHERE id = 'couple-memories'), 5242880::bigint, 'memory bucket limits files to 5 MiB');
SELECT ok((SELECT allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp'] FROM storage.buckets WHERE id = 'couple-memories'), 'memory bucket accepts JPEG PNG and WebP');

INSERT INTO auth.users (id, email) VALUES
 ('00000000-0000-4000-8000-000000000811', 'stage11-memory-a@photo-memories.test'),
 ('00000000-0000-4000-8000-000000000812', 'stage11-memory-b@photo-memories.test'),
 ('00000000-0000-4000-8000-000000000813', 'stage11-memory-outside@photo-memories.test');
INSERT INTO public.couples (id) VALUES ('00000000-0000-4000-8000-000000000821'), ('00000000-0000-4000-8000-000000000822');
INSERT INTO public.couple_members (couple_id, user_id, member_slot) VALUES
 ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000811', 1),
 ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000812', 2),
 ('00000000-0000-4000-8000-000000000822', '00000000-0000-4000-8000-000000000813', 1);
INSERT INTO public.relationship_timeline (id, couple_id, event_kind, source_id, summary) VALUES
 ('00000000-0000-4000-8000-000000000831', '00000000-0000-4000-8000-000000000821', 'game_completed', '00000000-0000-4000-8000-000000000841', 'Shared memory link'),
 ('00000000-0000-4000-8000-000000000832', '00000000-0000-4000-8000-000000000822', 'game_completed', '00000000-0000-4000-8000-000000000842', 'Other couple link');
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES
 ('couple-memories', '00000000-0000-4000-8000-000000000821/00000000-0000-4000-8000-000000000851.jpg', '{"mimetype":"image/jpeg","size":32}');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000811', true);
INSERT INTO public.photo_memories (couple_id, object_path, caption, memory_date, timeline_event_id)
VALUES ('00000000-0000-4000-8000-000000000821',
 '00000000-0000-4000-8000-000000000821/00000000-0000-4000-8000-000000000851.jpg', 'First trip', '2025-10-07', '00000000-0000-4000-8000-000000000831');
SELECT is((SELECT count(*)::integer FROM public.photo_memories), 1, 'member can create a couple photo memory');
SELECT throws_ok($$INSERT INTO public.photo_memories (couple_id, object_path, memory_date, timeline_event_id) VALUES ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000821/00000000-0000-4000-8000-000000000852.png', '2025-10-07', '00000000-0000-4000-8000-000000000832')$$, 'P0001', 'Timeline entry must belong to this couple', 'memory cannot link to another couple timeline');
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'couple-memories'), 1, 'couple member can read the authorized media object');
SELECT throws_ok($$INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('couple-memories', '00000000-0000-4000-8000-000000000822/00000000-0000-4000-8000-000000000852.jpg', '{"mimetype":"image/jpeg","size":32}')$$, '42501', null, 'member cannot upload into another couple folder');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000812', true);
SELECT is((SELECT count(*)::integer FROM public.photo_memories), 1, 'partner can read photo memory metadata');
UPDATE public.photo_memories SET caption = 'Our first trip' WHERE object_path = '00000000-0000-4000-8000-000000000821/00000000-0000-4000-8000-000000000851.jpg';
SELECT is((SELECT caption FROM public.photo_memories WHERE object_path = '00000000-0000-4000-8000-000000000821/00000000-0000-4000-8000-000000000851.jpg'), 'Our first trip', 'partner can edit caption');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Couples delete their photo memory files'), 'couple members have a scoped Storage API deletion policy');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000813', true);
SELECT is((SELECT count(*)::integer FROM public.photo_memories), 0, 'unrelated user cannot read metadata');
SELECT throws_ok($$INSERT INTO public.photo_memories (couple_id, object_path, memory_date) VALUES ('00000000-0000-4000-8000-000000000821', '00000000-0000-4000-8000-000000000821/00000000-0000-4000-8000-000000000853.jpg', '2025-10-07')$$, '42501', null, 'unrelated user cannot add a photo memory');
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'couple-memories'), 0, 'unrelated user cannot list or fetch couple media');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
