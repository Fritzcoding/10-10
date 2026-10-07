BEGIN;
SELECT plan(17);
SELECT has_table('public', 'love_notes', 'love notes table exists');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.love_notes'::regclass), 'love note rows enforce RLS');
SELECT ok(NOT has_table_privilege('anon', 'public.love_notes', 'SELECT'), 'anonymous users cannot read love notes');
SELECT ok((SELECT NOT public FROM storage.buckets WHERE id = 'couple-voice-memos'), 'voice memo bucket is private');
SELECT is((SELECT file_size_limit::bigint FROM storage.buckets WHERE id = 'couple-voice-memos'), 5242880::bigint, 'voice memo bucket limits files to 5 MiB');
SELECT ok((SELECT allowed_mime_types @> ARRAY['audio/webm','audio/mp4','audio/ogg'] FROM storage.buckets WHERE id = 'couple-voice-memos'), 'voice memo bucket accepts supported audio formats');

INSERT INTO auth.users (id, email) VALUES
 ('00000000-0000-4000-8000-000000000911', 'stage12-note-a@love-notes.test'),
 ('00000000-0000-4000-8000-000000000912', 'stage12-note-b@love-notes.test'),
 ('00000000-0000-4000-8000-000000000913', 'stage12-note-outside@love-notes.test');
INSERT INTO public.couples (id) VALUES ('00000000-0000-4000-8000-000000000921'), ('00000000-0000-4000-8000-000000000922');
INSERT INTO public.couple_members (couple_id, user_id, member_slot) VALUES
 ('00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000911', 1),
 ('00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000912', 2),
 ('00000000-0000-4000-8000-000000000922', '00000000-0000-4000-8000-000000000913', 1);
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES
 ('couple-voice-memos', '00000000-0000-4000-8000-000000000921/00000000-0000-4000-8000-000000000951.webm', '{"mimetype":"audio/webm","size":32}');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000911', true);
INSERT INTO public.love_notes (couple_id, content) VALUES ('00000000-0000-4000-8000-000000000921', 'I love our rainy walks.') RETURNING id \gset
SELECT is((SELECT created_by FROM public.love_notes WHERE id = :'id'), '00000000-0000-4000-8000-000000000911'::uuid, 'author is derived from the authenticated account');
UPDATE public.love_notes SET audio_path = '00000000-0000-4000-8000-000000000921/00000000-0000-4000-8000-000000000951.webm', audio_duration_ms = 60000 WHERE id = :'id';
SELECT is((SELECT audio_duration_ms FROM public.love_notes WHERE id = :'id'), 60000, 'member can attach a 60 second recording');
SELECT throws_ok($$UPDATE public.love_notes SET audio_duration_ms = 60001$$, '23514', null, 'recording longer than 60 seconds is rejected');
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'couple-voice-memos'), 1, 'couple member can access authorized voice media');
SELECT throws_ok($$INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('couple-voice-memos', '00000000-0000-4000-8000-000000000922/00000000-0000-4000-8000-000000000952.webm', '{"mimetype":"audio/webm","size":32}')$$, '42501', null, 'member cannot upload into another couple folder');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000912', true);
SELECT is((SELECT count(*)::integer FROM public.love_notes), 1, 'partner can read love note');
UPDATE public.love_notes SET content = 'Our rainy walks are my favorite.' WHERE id = :'id';
SELECT is((SELECT content FROM public.love_notes WHERE id = :'id'), 'Our rainy walks are my favorite.', 'partner can edit love note');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Couples delete their voice memo files'), 'couple members have a scoped Storage deletion policy');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000913', true);
SELECT is((SELECT count(*)::integer FROM public.love_notes), 0, 'unrelated user cannot read note metadata');
SELECT throws_ok($$INSERT INTO public.love_notes (couple_id, content) VALUES ('00000000-0000-4000-8000-000000000921', 'Intruding')$$, '42501', null, 'unrelated user cannot add a love note');
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'couple-voice-memos'), 0, 'unrelated user cannot list or fetch couple voice media');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
