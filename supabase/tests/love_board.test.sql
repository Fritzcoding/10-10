BEGIN;
SELECT plan(34);
SELECT has_table('public', 'love_boards', 'shared love boards exist');
SELECT has_table('public', 'love_board_strokes', 'saved strokes exist');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.love_boards'::regclass), 'board rows enforce RLS');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.love_board_strokes'::regclass), 'stroke rows enforce RLS');
SELECT ok(NOT has_table_privilege('anon', 'public.love_boards', 'SELECT'), 'anonymous users cannot read boards');
SELECT ok(NOT has_table_privilege('anon', 'public.love_board_strokes', 'SELECT'), 'anonymous users cannot read strokes');
SELECT ok(NOT has_table_privilege('authenticated', 'public.love_board_strokes', 'INSERT'), 'members append through validated RPC only');
SELECT has_function('public', 'ensure_love_board', ARRAY['uuid'], 'board initialization RPC exists');
SELECT has_function('public', 'append_love_board_stroke', ARRAY['uuid','integer','jsonb','text','integer'], 'stroke append RPC exists');
SELECT has_function('public', 'undo_love_board_stroke', ARRAY['uuid','integer'], 'stroke undo RPC exists');
SELECT has_function('public', 'clear_love_board', ARRAY['uuid','integer'], 'board clear RPC exists');
SELECT ok(EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages' AND policyname = 'Couple members receive love board refresh broadcasts'), 'Realtime refresh is couple scoped');

INSERT INTO auth.users (id, email) VALUES
 ('00000000-0000-4000-8000-000000000981', 'stage15-board-a@love-notes.test'),
 ('00000000-0000-4000-8000-000000000982', 'stage15-board-b@love-notes.test'),
 ('00000000-0000-4000-8000-000000000983', 'stage15-board-outside@love-notes.test');
INSERT INTO public.couples (id) VALUES ('00000000-0000-4000-8000-000000000991'), ('00000000-0000-4000-8000-000000000992');
INSERT INTO public.couple_members (couple_id, user_id, member_slot) VALUES
 ('00000000-0000-4000-8000-000000000991', '00000000-0000-4000-8000-000000000981', 1),
 ('00000000-0000-4000-8000-000000000991', '00000000-0000-4000-8000-000000000982', 2),
 ('00000000-0000-4000-8000-000000000992', '00000000-0000-4000-8000-000000000983', 1);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000981', true);
SELECT is(public.ensure_love_board('00000000-0000-4000-8000-000000000991'), 1, 'member initializes a board at generation one');
SELECT lives_ok($$SELECT public.append_love_board_stroke('00000000-0000-4000-8000-000000000991', 1, '[{"x":10,"y":20},{"x":30,"y":40}]'::jsonb, '#426f88', 8)$$, 'member can append a valid stroke');
SELECT is((SELECT count(*)::integer FROM public.love_board_strokes), 1, 'stroke is saved');
SELECT is((SELECT created_by FROM public.love_board_strokes), '00000000-0000-4000-8000-000000000981'::uuid, 'stroke author is derived from auth.uid');
SELECT throws_ok($$SELECT public.append_love_board_stroke('00000000-0000-4000-8000-000000000991', 1, '[{"x":1,"y":1}]'::jsonb, '#426f88', 8)$$, 'P0001', 'A stroke needs 2 to 500 points', 'short stroke is rejected');
SELECT throws_ok($$SELECT public.append_love_board_stroke('00000000-0000-4000-8000-000000000991', 1, '[{"x":-1,"y":1},{"x":2,"y":2}]'::jsonb, '#426f88', 8)$$, 'P0001', 'Board point is outside the canvas', 'out-of-bounds point is rejected');
SELECT throws_ok($$SELECT public.append_love_board_stroke('00000000-0000-4000-8000-000000000991', 1, '[{"x":1,"y":1},{"x":2,"y":2}]'::jsonb, 'red', 8)$$, 'P0001', 'Unsupported board color', 'unlisted color is rejected');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000982', true);
SELECT is((SELECT count(*)::integer FROM public.love_boards), 1, 'partner can read the couple board');
SELECT is((SELECT count(*)::integer FROM public.love_board_strokes), 1, 'partner can read saved strokes');
SELECT lives_ok($$SELECT public.append_love_board_stroke('00000000-0000-4000-8000-000000000991', 1, '[{"x":100,"y":100},{"x":200,"y":200}]'::jsonb, '#e5858b', 6)$$, 'partner stroke appends independently');
SELECT is((SELECT count(*)::integer FROM public.love_board_strokes), 2, 'concurrent partner work is retained as separate strokes');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000981', true);
SELECT is(public.undo_love_board_stroke('00000000-0000-4000-8000-000000000991', 1), true, 'member can undo their latest stroke');
SELECT is((SELECT count(*)::integer FROM public.love_board_strokes), 1, 'undo removes one stroke only');
SELECT is((SELECT created_by FROM public.love_board_strokes), '00000000-0000-4000-8000-000000000982'::uuid, 'undo preserves the partner stroke');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000982', true);
SELECT is(public.clear_love_board('00000000-0000-4000-8000-000000000991', 1), 2, 'clear advances the board generation');
SELECT is((SELECT count(*)::integer FROM public.love_board_strokes), 0, 'clear removes saved artwork immediately');
SELECT is((SELECT generation FROM public.love_boards), 2, 'new generation is stored server-side');
SELECT throws_ok($$SELECT public.append_love_board_stroke('00000000-0000-4000-8000-000000000991', 1, '[{"x":1,"y":1},{"x":2,"y":2}]'::jsonb, '#426f88', 8)$$, 'P0001', 'Board changed; refresh before drawing', 'stale generation cannot write after clear');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000983', true);
SELECT is((SELECT count(*)::integer FROM public.love_boards), 0, 'unrelated user cannot read the board');
SELECT is((SELECT count(*)::integer FROM public.love_board_strokes), 0, 'unrelated user cannot read strokes');
SELECT throws_ok($$SELECT public.ensure_love_board('00000000-0000-4000-8000-000000000991')$$, 'P0001', 'Couple membership required', 'unrelated user cannot initialize board');
SELECT throws_ok($$SELECT public.clear_love_board('00000000-0000-4000-8000-000000000991', 2)$$, 'P0001', 'Couple membership required', 'unrelated user cannot clear artwork');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
