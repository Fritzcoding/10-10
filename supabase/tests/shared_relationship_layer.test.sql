begin;
select plan(27);

select has_table('public', 'daily_questions', 'daily question rows are couple scoped');
select has_table('public', 'daily_question_answers', 'daily answers are stored separately');
select has_table('public', 'bucket_list_items', 'couples have a shared bucket list');
select has_table('public', 'inside_jokes', 'couples have a shared inside joke list');
select has_table('public', 'relationship_timeline', 'shared activity has a timeline');
select has_function('public', 'set_couple_timezone', array['text'], 'timezone changes use a validated RPC');
select has_function('public', 'get_or_create_daily_question', array[]::text[], 'daily question creation is atomic and server dated');
select has_function('public', 'submit_daily_question_answer', array['uuid', 'text'], 'answers are submitted through the server');
select ok(not has_function_privilege('anon', 'public.submit_daily_question_answer(uuid,text)', 'EXECUTE'), 'anonymous users cannot submit an answer');
select ok(not has_function_privilege('anon', 'public.set_couple_timezone(text)', 'EXECUTE'), 'anonymous users cannot change the timezone');
select has_column('public', 'couples', 'timezone', 'couples store their daily question timezone');

insert into auth.users (id, email) values
 ('00000000-0000-4000-8000-000000000611', 'relationship-a@example.test'),
 ('00000000-0000-4000-8000-000000000612', 'relationship-b@example.test'),
 ('00000000-0000-4000-8000-000000000613', 'relationship-outside@example.test');
insert into public.couples (id) values ('00000000-0000-4000-8000-000000000621'), ('00000000-0000-4000-8000-000000000622');
insert into public.couple_members (couple_id, user_id, member_slot) values
 ('00000000-0000-4000-8000-000000000621', '00000000-0000-4000-8000-000000000611', 1),
 ('00000000-0000-4000-8000-000000000621', '00000000-0000-4000-8000-000000000612', 2),
 ('00000000-0000-4000-8000-000000000622', '00000000-0000-4000-8000-000000000613', 1);
insert into public.game_sessions (id, player_x_id, player_o_id)
values ('00000000-0000-4000-8000-000000000631', '00000000-0000-4000-8000-000000000611', '00000000-0000-4000-8000-000000000612');
update public.game_sessions set status = 'completed' where id = '00000000-0000-4000-8000-000000000631';

create temporary table relationship_test_ids (name text primary key, id uuid) on commit drop;
grant select, insert on relationship_test_ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000611', true);
insert into relationship_test_ids values ('daily', (public.get_or_create_daily_question()).id);
select ok((select length(prompt) > 0 from public.daily_questions where id = (select id from relationship_test_ids where name = 'daily')), 'a couple can create its daily question');
select public.set_couple_timezone('Asia/Taipei');
select is((select timezone from public.couples where id = '00000000-0000-4000-8000-000000000621'), 'Asia/Taipei', 'either partner can set their shared timezone');
select throws_ok($$select public.set_couple_timezone('Not/AZone')$$, 'P0001', 'Timezone is invalid', 'invalid timezone values are rejected');
select ok((select count(*) = 1 from public.relationship_timeline where event_kind = 'game_completed' and source_id = '00000000-0000-4000-8000-000000000631'), 'completed shared games create one timeline event');
with created as (insert into public.bucket_list_items (couple_id, title) values ('00000000-0000-4000-8000-000000000621', 'Take a night train') returning id)
insert into relationship_test_ids select 'bucket', id from created;
select ok((select count(*) = 1 from public.relationship_timeline where event_kind = 'bucket_added' and source_id = (select id from relationship_test_ids where name = 'bucket')), 'adding a bucket item creates a timeline event');
update public.bucket_list_items set completed = true where id = (select id from relationship_test_ids where name = 'bucket');
select ok((select count(*) = 1 from public.relationship_timeline where event_kind = 'bucket_completed' and source_id = (select id from relationship_test_ids where name = 'bucket')), 'completing a bucket item creates a timeline event');
insert into public.inside_jokes (couple_id, text) values ('00000000-0000-4000-8000-000000000621', 'The tiny umbrella story');
insert into relationship_test_ids values ('answer-a', (public.submit_daily_question_answer((select id from relationship_test_ids where name = 'daily'), 'A quiet walk together.')).question_id);
select is((select count(*)::integer from public.daily_question_answers where question_id = (select id from relationship_test_ids where name = 'daily')), 1, 'the first answer is saved');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000612', true);
select is((select count(*)::integer from public.daily_question_answers where question_id = (select id from relationship_test_ids where name = 'daily')), 0, 'the other partner cannot read a hidden answer');
select public.submit_daily_question_answer((select id from relationship_test_ids where name = 'daily'), 'A picnic by the water.');
select is((select count(*)::integer from public.daily_question_answers where question_id = (select id from relationship_test_ids where name = 'daily')), 2, 'both answers become readable after both submit');
select is((select count(*)::integer from public.bucket_list_items where couple_id = '00000000-0000-4000-8000-000000000621'), 1, 'both partners see the shared bucket item');
select ok((select count(*) = 1 from public.inside_jokes where couple_id = '00000000-0000-4000-8000-000000000621'), 'both partners see inside jokes');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000613', true);
select is((select count(*)::integer from public.daily_questions), 0, 'another couple cannot read the daily question');
select is((select count(*)::integer from public.daily_question_answers), 0, 'another couple cannot read either answer');
select is((select count(*)::integer from public.bucket_list_items), 0, 'another couple cannot read bucket items');
select is((select count(*)::integer from public.inside_jokes), 0, 'another couple cannot read inside jokes');
select is((select count(*)::integer from public.relationship_timeline), 0, 'another couple cannot read timeline events');
reset role;
select * from finish();
rollback;
