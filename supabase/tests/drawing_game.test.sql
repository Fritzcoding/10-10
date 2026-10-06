BEGIN;
SELECT plan(28);

SELECT has_table('public', 'drawing_rounds', 'drawing rounds store timer and reference state');
SELECT has_table('public', 'drawing_submissions', 'drawing files are submitted through a private table');
SELECT has_function('public', 'start_drawing_round', ARRAY['uuid', 'integer', 'text', 'text', 'text'], 'requester starts the round with a server timer and prompt');
SELECT has_function('public', 'set_drawing_reference', ARRAY['uuid', 'text'], 'requester shares the reference before the timer starts');
SELECT has_function('public', 'submit_drawing', ARRAY['uuid', 'text'], 'participants submit by round RPC');
SELECT has_function('public', 'expire_drawing_round', ARRAY['uuid'], 'participants can finalize an expired round');
SELECT ok(NOT has_function_privilege('anon', 'public.start_drawing_round(uuid,integer,text,text,text)', 'EXECUTE'), 'anonymous users cannot start drawing rounds');
SELECT ok(NOT has_function_privilege('anon', 'public.submit_drawing(uuid,text)', 'EXECUTE'), 'anonymous users cannot submit drawings');
SELECT ok(NOT has_function_privilege('anon', 'public.expire_drawing_round(uuid)', 'EXECUTE'), 'anonymous users cannot expire drawing rounds');
SELECT ok((SELECT NOT public FROM storage.buckets WHERE id = 'couple-drawings'), 'drawing bucket is private');
SELECT is((SELECT file_size_limit::bigint FROM storage.buckets WHERE id = 'couple-drawings'), 5242880::bigint, 'drawing bucket limits files to 5 MiB');
SELECT ok((SELECT allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp'] FROM storage.buckets WHERE id = 'couple-drawings'), 'drawing bucket accepts JPEG PNG and WebP');

INSERT INTO auth.users (id, email) VALUES
 ('00000000-0000-4000-8000-000000000711', 'drawing-a@example.test'),
 ('00000000-0000-4000-8000-000000000712', 'drawing-b@example.test'),
 ('00000000-0000-4000-8000-000000000713', 'drawing-c@example.test');
INSERT INTO public.couples (id) VALUES ('00000000-0000-4000-8000-000000000721'), ('00000000-0000-4000-8000-000000000722');
INSERT INTO public.couple_members (couple_id, user_id, member_slot) VALUES
 ('00000000-0000-4000-8000-000000000721', '00000000-0000-4000-8000-000000000711', 1),
 ('00000000-0000-4000-8000-000000000721', '00000000-0000-4000-8000-000000000712', 2),
 ('00000000-0000-4000-8000-000000000722', '00000000-0000-4000-8000-000000000713', 1);
INSERT INTO public.game_sessions (id, game_type, player_x_id, player_o_id)
VALUES ('00000000-0000-4000-8000-000000000731', 'draw-together', '00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000712');
INSERT INTO public.drawing_submissions (round_id, user_id, image_path)
SELECT id, '00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000731/drawings/00000000-0000-4000-8000-000000000711.png'
FROM public.drawing_rounds WHERE session_id = '00000000-0000-4000-8000-000000000731';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000711', true);
SELECT is(public.create_game_request('00000000-0000-4000-8000-000000000712', 'draw-together')->>'game_type', 'draw-together', 'paired users can request a drawing game');
SELECT is((SELECT count(*)::integer FROM public.drawing_submissions), 1, 'submitter can read their own private drawing');
SELECT throws_ok($$SELECT public.start_drawing_round('00000000-0000-4000-8000-000000000731', 14, 'Moon', 'Space', NULL)$$, 'P0001', 'Drawing duration must be between 15 and 600 seconds', 'database rejects a duration below the minimum');
SELECT is((SELECT subject FROM public.drawing_rounds WHERE session_id = '00000000-0000-4000-8000-000000000731'), NULL, 'historical waiting round has no prompt');
SELECT throws_ok($$SELECT public.start_drawing_round('00000000-0000-4000-8000-000000000731', 60, ' ', 'Space', NULL)$$, 'P0001', 'Drawing subject must be between 1 and 120 characters', 'database rejects a blank subject');
SELECT throws_ok($$SELECT public.start_drawing_round('00000000-0000-4000-8000-000000000731', 60, 'Moon', repeat('x', 61), NULL)$$, 'P0001', 'Drawing category must be between 1 and 60 characters', 'database rejects an oversized category');
SELECT lives_ok($$SELECT public.start_drawing_round('00000000-0000-4000-8000-000000000731', 60, '  Draw a moon  ', '  Space  ', NULL)$$, 'requester starts without an optional reference image');
SELECT is((SELECT subject FROM public.drawing_rounds WHERE session_id = '00000000-0000-4000-8000-000000000731'), 'Draw a moon', 'database trims and saves subject');
SELECT is((SELECT category FROM public.drawing_rounds WHERE session_id = '00000000-0000-4000-8000-000000000731'), 'Space', 'database trims and saves category');
SELECT is((SELECT reference_path FROM public.drawing_rounds WHERE session_id = '00000000-0000-4000-8000-000000000731'), NULL, 'drawing prompt works with a null reference');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000712', true);
SELECT throws_ok($$SELECT public.start_drawing_round('00000000-0000-4000-8000-000000000731', 60, 'Moon', 'Space', NULL)$$, 'P0001', 'Only the player who sent this request can start the drawing', 'partner cannot mutate the prompt or start the round');
SELECT is((SELECT count(*)::integer FROM public.drawing_submissions), 0, 'partner cannot read the drawing before reveal');
SELECT throws_ok($$SELECT public.set_drawing_reference('00000000-0000-4000-8000-000000000731', NULL)$$, 'P0001', 'Only the requester can set a reference before the drawing starts', 'only the requester can change the shared reference');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000713', true);
SELECT is((SELECT count(*)::integer FROM public.drawing_submissions), 0, 'unrelated users cannot read drawings');
RESET ROLE;
UPDATE public.drawing_rounds SET status = 'active', started_at = now() - interval '20 seconds', deadline_at = now() - interval '1 second'
WHERE session_id = '00000000-0000-4000-8000-000000000731';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000712', true);
SELECT is((SELECT count(*)::integer FROM public.drawing_submissions), 1, 'drawing becomes readable after the database deadline');
SELECT throws_ok($$SELECT public.submit_drawing((SELECT id FROM public.drawing_rounds WHERE session_id = '00000000-0000-4000-8000-000000000731'), 'invalid')$$, 'P0001', 'Drawing round is no longer accepting submissions', 'database rejects submissions after the server deadline');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
