BEGIN;
SELECT plan(27);
SELECT has_table('public', 'temporary_location_shares', 'temporary location storage exists');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.temporary_location_shares'::regclass), 'location shares enforce RLS');
SELECT ok(NOT has_table_privilege('anon', 'public.temporary_location_shares', 'SELECT'), 'anonymous users cannot read coordinates');
SELECT has_function('public', 'start_location_share', ARRAY['uuid','double precision','double precision','double precision','integer'], 'start share RPC exists');
SELECT has_function('public', 'update_location_share', ARRAY['uuid','double precision','double precision','double precision'], 'update share RPC exists');
SELECT has_function('public', 'stop_location_share', ARRAY['uuid'], 'stop share RPC exists');
SELECT has_function('public', 'purge_expired_location_shares', ARRAY[]::text[], 'server cleanup function exists');
SELECT ok(EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-temporary-location-shares'), 'expired coordinates are scheduled for deletion');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'Couple members receive location refresh broadcasts'), 'Realtime refresh is couple scoped');

INSERT INTO auth.users (id, email) VALUES
 ('00000000-0000-4000-8000-000000000961', 'stage14-location-a@love-notes.test'),
 ('00000000-0000-4000-8000-000000000962', 'stage14-location-b@love-notes.test'),
 ('00000000-0000-4000-8000-000000000963', 'stage14-location-outside@love-notes.test');
INSERT INTO public.couples (id) VALUES ('00000000-0000-4000-8000-000000000971'), ('00000000-0000-4000-8000-000000000972');
INSERT INTO public.couple_members (couple_id, user_id, member_slot) VALUES
 ('00000000-0000-4000-8000-000000000971', '00000000-0000-4000-8000-000000000961', 1),
 ('00000000-0000-4000-8000-000000000971', '00000000-0000-4000-8000-000000000962', 2),
 ('00000000-0000-4000-8000-000000000972', '00000000-0000-4000-8000-000000000963', 1);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000961', true);
SELECT lives_ok($$SELECT public.start_location_share('00000000-0000-4000-8000-000000000971', 25.03, 121.56, 25, 15)$$, 'member can start a bounded share');
SELECT is((SELECT count(*)::integer FROM public.temporary_location_shares), 1, 'owner can read active share');
SELECT ok((SELECT expires_at - started_at BETWEEN interval '14 minutes' AND interval '15 minutes' FROM public.temporary_location_shares), 'server sets the selected duration');
SELECT lives_ok($$SELECT public.update_location_share('00000000-0000-4000-8000-000000000971', 25.04, 121.57, 20)$$, 'owner can update an active share');
SELECT is((SELECT latitude FROM public.temporary_location_shares), 25.04::double precision, 'update replaces current coordinate');
SELECT throws_ok($$SELECT public.start_location_share('00000000-0000-4000-8000-000000000971', 91, 0, 10, 15)$$, 'P0001', 'Invalid location', 'RPC rejects invalid latitude');
SELECT throws_ok($$SELECT public.start_location_share('00000000-0000-4000-8000-000000000971', 0, 0, 10, 90)$$, 'P0001', 'Unsupported share duration', 'RPC rejects unsupported duration');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000962', true);
SELECT is((SELECT count(*)::integer FROM public.temporary_location_shares), 1, 'partner can read active location');
SELECT throws_ok($$UPDATE public.temporary_location_shares SET latitude = 0$$, '42501', null, 'partner cannot directly modify a share');
SELECT throws_ok($$SELECT public.update_location_share('00000000-0000-4000-8000-000000000971', 0, 0, 5)$$, 'P0001', 'Location share is no longer active', 'partner cannot update another member share');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000963', true);
SELECT is((SELECT count(*)::integer FROM public.temporary_location_shares), 0, 'unrelated user cannot read location');
SELECT throws_ok($$SELECT public.start_location_share('00000000-0000-4000-8000-000000000971', 0, 0, 5, 15)$$, 'P0001', 'Couple membership required', 'unrelated user cannot start a share');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000961', true);
SELECT is(public.stop_location_share('00000000-0000-4000-8000-000000000971'), true, 'owner can stop their share immediately');
SELECT is((SELECT count(*)::integer FROM public.temporary_location_shares), 0, 'stopped coordinates are deleted');
SELECT lives_ok($$SELECT public.start_location_share('00000000-0000-4000-8000-000000000971', 25, 121, 20, 15)$$, 'owner can start another share');
RESET ROLE;
UPDATE public.temporary_location_shares SET started_at = pg_catalog.now() - interval '16 minutes', expires_at = pg_catalog.now() - interval '1 second';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000962', true);
SELECT is((SELECT count(*)::integer FROM public.temporary_location_shares), 0, 'expired coordinates are immediately hidden by RLS');
RESET ROLE;
SELECT is(public.purge_expired_location_shares(), 1, 'server cleanup physically deletes expired coordinates');
SELECT is((SELECT count(*)::integer FROM public.temporary_location_shares), 0, 'expired share has no retained row');
SELECT * FROM finish();
ROLLBACK;
