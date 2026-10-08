BEGIN;
SELECT plan(32);
SELECT has_table('private', 'scheduled_surprises', 'scheduled surprise payloads are isolated in the private schema');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'private.scheduled_surprises'::regclass), 'scheduled surprise rows enforce RLS');
SELECT ok(NOT has_table_privilege('authenticated', 'private.scheduled_surprises', 'SELECT'), 'clients cannot query hidden payload rows');
SELECT has_function('public','schedule_surprise',ARRAY['uuid','text','timestamp with time zone','jsonb','text'],'schedule RPC exists');
SELECT has_function('public','cancel_scheduled_surprise',ARRAY['uuid'],'cancel RPC exists');
SELECT has_function('public','get_released_surprises',ARRAY[]::text[],'released content RPC exists');
SELECT has_function('public','get_my_pending_surprises',ARRAY[]::text[],'pending metadata RPC exists');
SELECT ok(NOT has_function_privilege('anon','public.schedule_surprise(uuid,text,timestamp with time zone,jsonb,text)','EXECUTE'),'anonymous callers cannot schedule surprises');
SELECT ok(array_position((SELECT proargnames FROM pg_proc WHERE oid='public.get_my_pending_surprises()'::regprocedure),'payload') IS NULL,'pending metadata never contains the content payload');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='private' AND tablename='scheduled_surprises'),'private payloads are not published to Realtime');
SELECT ok(NOT (SELECT public FROM storage.buckets WHERE id='scheduled-surprise-photos'),'surprise photos stay in a private bucket');

INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-4000-8000-000000001701','surprise-a@example.test'),
 ('00000000-0000-4000-8000-000000001702','surprise-b@example.test'),
 ('00000000-0000-4000-8000-000000001703','surprise-outside@example.test');
INSERT INTO public.couples(id) VALUES ('00000000-0000-4000-8000-000000001711'),('00000000-0000-4000-8000-000000001712');
INSERT INTO public.couple_members(couple_id,user_id,member_slot) VALUES
 ('00000000-0000-4000-8000-000000001711','00000000-0000-4000-8000-000000001701',1),
 ('00000000-0000-4000-8000-000000001711','00000000-0000-4000-8000-000000001702',2),
 ('00000000-0000-4000-8000-000000001712','00000000-0000-4000-8000-000000001703',1);
INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES
 ('scheduled-surprise-photos','00000000-0000-4000-8000-000000001724/00000000-0000-4000-8000-000000001724.jpg','00000000-0000-4000-8000-000000001701','{"mimetype":"image/jpeg","size":16}');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001701',true);
SELECT lives_ok($$INSERT INTO storage.objects(bucket_id,name,owner_id,metadata)
  VALUES ('scheduled-surprise-photos','00000000-0000-4000-8000-000000001725/00000000-0000-4000-8000-000000001725.png','00000000-0000-4000-8000-000000001701','{"mimetype":"image/png","size":16}')$$,
  'creator can upload a bounded private photo before scheduling');
SELECT is(public.schedule_surprise('00000000-0000-4000-8000-000000001721','note',now()+interval '1 day','{"text":"A surprise for tomorrow"}'::jsonb),'00000000-0000-4000-8000-000000001721'::uuid,'member can schedule a surprise');
SELECT is(public.schedule_surprise('00000000-0000-4000-8000-000000001721','note',now()+interval '1 day','{"text":"A surprise for tomorrow"}'::jsonb),'00000000-0000-4000-8000-000000001721'::uuid,'retrying an identical request is idempotent');
SELECT is((SELECT count(*)::integer FROM public.get_released_surprises()),0,'nobody can read payload before release');
SELECT is((SELECT count(*)::integer FROM public.get_my_pending_surprises()),1,'creator sees pending metadata');
SELECT is(public.schedule_surprise('00000000-0000-4000-8000-000000001724','photo',now()+interval '1 day','{"text":""}'::jsonb,'00000000-0000-4000-8000-000000001724/00000000-0000-4000-8000-000000001724.jpg'),'00000000-0000-4000-8000-000000001724'::uuid,'creator can schedule an uploaded photo');
SELECT ok(NOT public.can_read_scheduled_surprise_photo('00000000-0000-4000-8000-000000001724/00000000-0000-4000-8000-000000001724.jpg'),'creator cannot read its photo before release');
SELECT is(public.schedule_surprise('00000000-0000-4000-8000-000000001722','activity',now()+interval '2 days','{"text":"Make tea together"}'::jsonb),'00000000-0000-4000-8000-000000001722'::uuid,'creator can schedule a second surprise');
SELECT is(public.cancel_scheduled_surprise('00000000-0000-4000-8000-000000001722'),true,'creator can cancel a pending surprise');
SELECT is((SELECT count(*)::integer FROM public.get_my_pending_surprises()),2,'cancelled surprise disappears from pending metadata');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001702',true);
SELECT is((SELECT count(*)::integer FROM public.get_my_pending_surprises()),0,'partner cannot inspect creator pending metadata');
SELECT is((SELECT count(*)::integer FROM public.get_released_surprises()),0,'partner cannot read early payload');
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id='scheduled-surprise-photos'),0,'partner cannot fetch an unreleased photo');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001703',true);
SELECT is((SELECT count(*)::integer FROM public.get_released_surprises()),0,'unrelated account cannot read surprise');
SELECT ok(NOT public.can_read_scheduled_surprise_photo('00000000-0000-4000-8000-000000001724/00000000-0000-4000-8000-000000001724.jpg'),'unrelated account cannot read the released photo path');
SELECT is(public.schedule_surprise('00000000-0000-4000-8000-000000001723','note',now()+interval '1 day','{"text":"Our surprise"}'::jsonb),'00000000-0000-4000-8000-000000001723'::uuid,'unrelated account can schedule only within its own couple');
SELECT throws_ok($$SELECT public.cancel_scheduled_surprise('00000000-0000-4000-8000-000000001721')$$,'P0001','Only your unreleased surprise can be cancelled','unrelated account cannot cancel another couple surprise');
RESET ROLE;
UPDATE private.scheduled_surprises SET release_at = now() WHERE id IN ('00000000-0000-4000-8000-000000001721','00000000-0000-4000-8000-000000001724');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001702',true);
SELECT is((SELECT payload->>'text' FROM public.get_released_surprises() WHERE id='00000000-0000-4000-8000-000000001721'),'A surprise for tomorrow','partner receives content at the exact database release boundary');
SELECT ok(public.can_read_scheduled_surprise_photo('00000000-0000-4000-8000-000000001724/00000000-0000-4000-8000-000000001724.jpg'),'partner can read the photo at the release boundary');
SELECT is((SELECT count(*)::integer FROM storage.objects WHERE bucket_id='scheduled-surprise-photos'),1,'Storage returns the photo only after release');
SELECT throws_ok($$SELECT public.cancel_scheduled_surprise('00000000-0000-4000-8000-000000001721')$$,'P0001','Only your unreleased surprise can be cancelled','partner cannot cancel creator surprise');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000001701',true);
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
