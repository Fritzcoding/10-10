BEGIN;
SELECT plan(22);
SELECT has_table('public', 'relationship_mood_checkins', 'mood check-ins table exists');
SELECT has_table('public', 'couple_rituals', 'couple rituals table exists');
SELECT has_table('public', 'ritual_checkins', 'weekly ritual check-ins table exists');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.relationship_mood_checkins'::regclass), 'mood check-ins enforce RLS');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.couple_rituals'::regclass), 'rituals enforce RLS');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ritual_checkins'::regclass), 'ritual check-ins enforce RLS');
SELECT ok(NOT has_table_privilege('anon', 'public.relationship_mood_checkins', 'SELECT'), 'anonymous users cannot read moods');

INSERT INTO auth.users (id, email) VALUES
 ('00000000-0000-4000-8000-000000000931', 'stage13-mood-a@love-notes.test'),
 ('00000000-0000-4000-8000-000000000932', 'stage13-mood-b@love-notes.test'),
 ('00000000-0000-4000-8000-000000000933', 'stage13-mood-outside@love-notes.test');
INSERT INTO public.couples (id) VALUES ('00000000-0000-4000-8000-000000000941'), ('00000000-0000-4000-8000-000000000942');
INSERT INTO public.couple_members (couple_id, user_id, member_slot) VALUES
 ('00000000-0000-4000-8000-000000000941', '00000000-0000-4000-8000-000000000931', 1),
 ('00000000-0000-4000-8000-000000000941', '00000000-0000-4000-8000-000000000932', 2),
 ('00000000-0000-4000-8000-000000000942', '00000000-0000-4000-8000-000000000933', 1);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000931', true);
INSERT INTO public.relationship_mood_checkins (couple_id, mood, note, shared) VALUES
 ('00000000-0000-4000-8000-000000000941', 'calm', 'Private note', false),
 ('00000000-0000-4000-8000-000000000941', 'loved', 'Shared note', true);
SELECT is((SELECT count(*)::integer FROM public.relationship_mood_checkins), 2, 'author can read private and shared moods');
SELECT is((SELECT count(*)::integer FROM public.relationship_mood_checkins WHERE created_by = auth.uid()), 2, 'mood authorship comes from auth.uid');
INSERT INTO public.couple_rituals (id, couple_id, title, prompt, participation_mode, reminders_enabled)
VALUES ('00000000-0000-4000-8000-000000000951', '00000000-0000-4000-8000-000000000941', 'Sunday check-in', 'Share one good thing.', 'both', true);
INSERT INTO public.ritual_checkins (ritual_id, couple_id, week_start) VALUES
 ('00000000-0000-4000-8000-000000000951', '00000000-0000-4000-8000-000000000941', '2026-10-05');
SELECT is((SELECT user_id FROM public.ritual_checkins), '00000000-0000-4000-8000-000000000931'::uuid, 'ritual check-in user is derived from auth.uid');
SELECT throws_ok($$INSERT INTO public.ritual_checkins (ritual_id, couple_id, week_start) VALUES ('00000000-0000-4000-8000-000000000951', '00000000-0000-4000-8000-000000000941', '2026-10-05')$$, '23505', null, 'one user cannot check in twice for the same ritual week');
SELECT throws_ok($$INSERT INTO public.ritual_checkins (ritual_id, couple_id, week_start) VALUES ('00000000-0000-4000-8000-000000000951', '00000000-0000-4000-8000-000000000941', '2026-10-06')$$, '23514', null, 'ritual week must start on Monday');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000932', true);
SELECT is((SELECT count(*)::integer FROM public.relationship_mood_checkins), 1, 'partner sees only shared moods');
SELECT is((SELECT count(*)::integer FROM public.couple_rituals), 1, 'partner can read couple rituals');
INSERT INTO public.ritual_checkins (ritual_id, couple_id, week_start) VALUES
 ('00000000-0000-4000-8000-000000000951', '00000000-0000-4000-8000-000000000941', '2026-10-05');
SELECT is((SELECT count(*)::integer FROM public.ritual_checkins), 2, 'partner can add their own weekly check-in');
UPDATE public.relationship_mood_checkins SET shared = false WHERE mood = 'loved';
SELECT is((SELECT count(*)::integer FROM public.relationship_mood_checkins), 1, 'partner cannot update another member mood');
DELETE FROM public.relationship_mood_checkins WHERE mood = 'loved';
SELECT is((SELECT count(*)::integer FROM public.relationship_mood_checkins), 1, 'partner cannot delete another member mood');
SELECT is((SELECT count(*)::integer FROM public.ritual_checkins), 2, 'partner reads shared ritual check-ins');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000933', true);
SELECT is((SELECT count(*)::integer FROM public.relationship_mood_checkins), 0, 'unrelated user cannot read moods');
SELECT is((SELECT count(*)::integer FROM public.couple_rituals), 0, 'unrelated user cannot read rituals');
SELECT is((SELECT count(*)::integer FROM public.ritual_checkins), 0, 'unrelated user cannot read ritual check-ins');
SELECT throws_ok($$INSERT INTO public.relationship_mood_checkins (couple_id, mood, note) VALUES ('00000000-0000-4000-8000-000000000941', 'happy', '')$$, '42501', null, 'unrelated user cannot add a mood to another couple');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
