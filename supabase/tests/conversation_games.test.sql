begin;
select plan(46);

select has_table('public', 'game_prompts', 'game prompts store categories and provenance');
select has_table('public', 'conversation_game_rounds', 'conversation rounds have public state');
select has_table('public', 'conversation_game_submissions', 'answers use per-round private submissions');
select has_column('public', 'game_sessions', 'current_round', 'sessions track the active conversation round');
select has_function('public', 'start_conversation_game', array['uuid', 'uuid'], 'conversation sessions start through a server RPC');
select has_function('public', 'submit_conversation_game_answer', array['uuid', 'jsonb', 'jsonb'], 'conversation answers use a server RPC');
select has_function('public', 'expire_conversation_game_round', array['uuid'], 'server deadlines safely reveal and rotate rounds');
select has_function('public', 'get_describe_game_word', array['uuid'], 'only the clue giver can fetch a hidden word');
select has_function('public', 'create_couple_question', array['text', 'text'], 'couple-authored questions get couple identity server-side');
select is((select count(*)::integer from public.game_prompts where source_type = 'original' and game_type = 'question-cards'), 12, 'original card prompts seed four categories');
select is((select count(distinct category)::integer from public.game_prompts where game_type = 'question-cards'), 4, 'question cards have four categories');
select is((select count(*)::integer from public.game_prompts where source_type = 'original' and game_type = 'whos-more-likely'), 8, 'Who’s More Likely has original seed prompts');
select is((select count(*)::integer from public.game_prompts where source_type = 'original' and game_type = 'describe-without-saying-it'), 8, 'Describe has original word prompts');
select ok(not has_function_privilege('anon', 'public.start_conversation_game(uuid,uuid)', 'EXECUTE'), 'anonymous users cannot start games');
select ok(not has_function_privilege('anon', 'public.submit_conversation_game_answer(uuid,jsonb,jsonb)', 'EXECUTE'), 'anonymous users cannot submit answers');
select ok(not has_function_privilege('anon', 'public.get_describe_game_word(uuid)', 'EXECUTE'), 'anonymous users cannot fetch secret words');
select ok(has_function_privilege('authenticated', 'public.get_describe_game_word(uuid)', 'EXECUTE'), 'authenticated users can call the role-checked word RPC');

insert into auth.users (id, email) values
 ('00000000-0000-4000-8000-000000000411', 'stage4-a@example.test'),
 ('00000000-0000-4000-8000-000000000412', 'stage4-b@example.test'),
 ('00000000-0000-4000-8000-000000000413', 'stage4-c@example.test');
insert into public.couples (id) values ('00000000-0000-4000-8000-000000000421'), ('00000000-0000-4000-8000-000000000422');
insert into public.couple_members (couple_id, user_id, member_slot) values
 ('00000000-0000-4000-8000-000000000421', '00000000-0000-4000-8000-000000000411', 1),
 ('00000000-0000-4000-8000-000000000421', '00000000-0000-4000-8000-000000000412', 2),
 ('00000000-0000-4000-8000-000000000422', '00000000-0000-4000-8000-000000000413', 1);
insert into public.game_prompts (couple_id, game_type, category, prompt, source_type, source_name, source_license, created_by)
values ('00000000-0000-4000-8000-000000000421', 'question-cards', 'Memories', 'A question for our pair', 'couple', 'Couple authored', null, '00000000-0000-4000-8000-000000000411');

create temporary table stage4_ids (name text primary key, id uuid) on commit drop;
grant select, insert on stage4_ids to authenticated;
create temporary table stage4_seen (name text primary key, passed boolean, detail text) on commit drop;
grant select, insert on stage4_seen to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000411', true);
select ok((select count(*) > 0 from public.game_prompts where source_type = 'original' and game_type = 'question-cards'), 'a couple can read original prompts');
select ok((select count(*) = 1 from public.game_prompts where source_type = 'couple'), 'a couple can read its authored prompt');
insert into stage4_ids values ('created_prompt', ((public.create_couple_question('Future', 'A question saved by the couple')->>'id')::uuid));
select ok((select source_type = 'couple' and source_name = 'Couple authored' from public.game_prompts where id = (select id from stage4_ids where name = 'created_prompt')), 'the server records provenance for a new couple question');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000412', true);
select ok((select count(*) = 2 from public.game_prompts where source_type = 'couple'), 'both partners can read their couple prompts');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000413', true);
select ok((select count(*) = 0 from public.game_prompts where source_type = 'couple'), 'another couple cannot read couple-authored prompts');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000411', true);
insert into stage4_ids values ('q_request', (public.create_game_request('00000000-0000-4000-8000-000000000412', 'question-cards')->>'id')::uuid);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000412', true);
insert into stage4_ids values ('q_session', (public.accept_game_request((select id from stage4_ids where name = 'q_request'))->>'session_id')::uuid);
select ok((select game_type = 'question-cards' from public.game_sessions where id = (select id from stage4_ids where name = 'q_session')), 'the request opens the requested conversation game');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000411', true);
insert into stage4_ids values ('q_round', (public.start_conversation_game((select id from stage4_ids where name = 'q_session'), (select id from public.game_prompts where game_type = 'question-cards' and source_type = 'original' limit 1))).id);
select public.submit_conversation_game_answer((select id from stage4_ids where name = 'q_round'), '{"answer":"A favorite quiet evening"}', null);
select is((select count(*)::integer from public.conversation_game_submissions where round_id = (select id from stage4_ids where name = 'q_round')), 1, 'a player can read their own hidden answer');
do $$ begin
  perform public.submit_conversation_game_answer((select id from stage4_ids where name = 'q_round'), '{"answer":"again"}', null);
  insert into stage4_seen values ('q_duplicate', false, 'duplicate answer accepted');
exception when unique_violation then
  insert into stage4_seen values ('q_duplicate', true, SQLERRM);
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000412', true);
select is((select count(*)::integer from public.conversation_game_submissions where round_id = (select id from stage4_ids where name = 'q_round')), 0, 'the partner cannot read a one-sided answer');
do $$ begin
  perform public.submit_conversation_game_answer((select id from stage4_ids where name = 'q_round'), '{"answer":" "}', null);
  insert into stage4_seen values ('q_invalid', false, 'blank answer accepted');
exception when others then
  insert into stage4_seen values ('q_invalid', SQLERRM ILIKE '%answer is invalid%', SQLERRM);
end $$;
select public.submit_conversation_game_answer((select id from stage4_ids where name = 'q_round'), '{"answer":"A favorite adventure"}', null);
select is((select count(*)::integer from public.conversation_game_submissions where round_id = (select id from stage4_ids where name = 'q_round')), 2, 'both answers are revealed after the second submission');
select ok((select status = 'completed' from public.game_sessions where id = (select id from stage4_ids where name = 'q_session')), 'the paired-answer game completes atomically');
select ok((select passed from stage4_seen where name = 'q_duplicate'), 'the database rejects a duplicate answer');
select ok((select passed from stage4_seen where name = 'q_invalid'), 'the database rejects a blank answer');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000413', true);
select is((select count(*)::integer from public.conversation_game_submissions where round_id = (select id from stage4_ids where name = 'q_round')), 0, 'an unrelated couple cannot read answers');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000411', true);
insert into stage4_ids values ('lie_request', (public.create_game_request('00000000-0000-4000-8000-000000000412', 'lie-detector')->>'id')::uuid);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000412', true);
insert into stage4_ids values ('lie_session', (public.accept_game_request((select id from stage4_ids where name = 'lie_request'))->>'session_id')::uuid);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000411', true);
insert into stage4_ids values ('lie_round1', (public.start_conversation_game((select id from stage4_ids where name = 'lie_session'), null)).id);
select public.submit_conversation_game_answer((select id from stage4_ids where name = 'lie_round1'), '{"lie_index":1}', '{"statements":["I like tea","I have visited Mars","I enjoy walks"]}');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000412', true);
select ok((select jsonb_array_length(public_state->'statements') = 3 from public.conversation_game_rounds where id = (select id from stage4_ids where name = 'lie_round1')), 'the guesser sees the statements before the answer');
select is((select count(*)::integer from public.conversation_game_submissions where round_id = (select id from stage4_ids where name = 'lie_round1')), 0, 'the guesser cannot read the lie index');
do $$ begin
  perform public.submit_conversation_game_answer((select id from stage4_ids where name = 'lie_round1'), '{"guess_index":3}', null);
  insert into stage4_seen values ('lie_invalid', false, 'invalid guess accepted');
exception when others then
  insert into stage4_seen values ('lie_invalid', SQLERRM ILIKE '%guess is invalid%', SQLERRM);
end $$;
select public.submit_conversation_game_answer((select id from stage4_ids where name = 'lie_round1'), '{"guess_index":1}', null);
select is((select creator_id from public.conversation_game_rounds where session_id = (select id from stage4_ids where name = 'lie_session') and round_number = 2), '00000000-0000-4000-8000-000000000412'::uuid, 'the second Lie Detector round swaps the creator');
select ok((select passed from stage4_seen where name = 'lie_invalid'), 'the database rejects an invalid lie guess');
select public.submit_conversation_game_answer((select id from public.conversation_game_rounds where session_id = (select id from stage4_ids where name = 'lie_session') and round_number = 2), '{"lie_index":0}', '{"statements":["I like tea","I have visited Venus","I enjoy walks"]}');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000411', true);
select public.submit_conversation_game_answer((select id from public.conversation_game_rounds where session_id = (select id from stage4_ids where name = 'lie_session') and round_number = 2), '{"guess_index":0}', null);
select ok((select status = 'completed' from public.game_sessions where id = (select id from stage4_ids where name = 'lie_session')), 'Lie Detector completes after both turns');
select is((select count(*)::integer from public.conversation_game_submissions where round_id = (select id from stage4_ids where name = 'lie_round1')), 2, 'the first lie and guess reveal together');

insert into stage4_ids values ('describe_request', (public.create_game_request('00000000-0000-4000-8000-000000000412', 'describe-without-saying-it')->>'id')::uuid);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000412', true);
insert into stage4_ids values ('describe_session', (public.accept_game_request((select id from stage4_ids where name = 'describe_request'))->>'session_id')::uuid);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000411', true);
insert into stage4_ids values ('describe_round1', (public.start_conversation_game((select id from stage4_ids where name = 'describe_session'), null)).id);
select is((select deadline_at from public.conversation_game_rounds where id = (select id from stage4_ids where name = 'describe_round1')), null::timestamptz, 'Describe timer waits until the clue giver starts');
do $$ begin
  perform public.submit_conversation_game_answer((select id from stage4_ids where name = 'describe_round1'), '{}', null);
  insert into stage4_seen values ('start_before_word', false, 'Describe started before showing its word');
exception when others then
  insert into stage4_seen values ('start_before_word', SQLERRM ILIKE '%word%', SQLERRM);
end $$;
select ok((select passed from stage4_seen where name = 'start_before_word'), 'the server requires the clue giver to view the word before starting');
select ok(pg_catalog.length(public.get_describe_game_word((select id from stage4_ids where name = 'describe_round1'))->>'word') > 0, 'the clue giver can fetch the hidden word');
select is((select deadline_at from public.conversation_game_rounds where id = (select id from stage4_ids where name = 'describe_round1')), null::timestamptz, 'viewing the word alone does not start the timer');
select public.submit_conversation_game_answer((select id from stage4_ids where name = 'describe_round1'), '{}', null);
select ok((select deadline_at > pg_catalog.now() and deadline_at <= pg_catalog.now() + interval '61 seconds' and public_state->>'started' = 'true' from public.conversation_game_rounds where id = (select id from stage4_ids where name = 'describe_round1')), 'the 60-second timer starts when the clue giver passes the phone');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000412', true);
do $$ begin
  perform public.get_describe_game_word((select id from stage4_ids where name = 'describe_round1'));
  insert into stage4_seen values ('word_other', false, 'the guesser received the word');
exception when others then
  insert into stage4_seen values ('word_other', SQLERRM ILIKE '%unavailable%', SQLERRM);
end $$;
select is((select count(*)::integer from public.conversation_game_submissions where round_id = (select id from stage4_ids where name = 'describe_round1')), 0, 'the guesser cannot read the clue giver secret');
select ok((select passed from stage4_seen where name = 'word_other'), 'the word RPC rejects the guesser');
reset role;
update public.conversation_game_rounds set deadline_at = pg_catalog.now() - interval '1 second' where id = (select id from stage4_ids where name = 'describe_round1');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000412', true);
select public.expire_conversation_game_round((select id from stage4_ids where name = 'describe_round1'));
select ok((select creator_id = '00000000-0000-4000-8000-000000000412'::uuid and deadline_at is null from public.conversation_game_rounds where session_id = (select id from stage4_ids where name = 'describe_session') and round_number = 2), 'an expired first turn reveals and waits for the partner to start');
reset role;
update public.conversation_game_rounds set deadline_at = pg_catalog.now() - interval '1 second' where session_id = (select id from stage4_ids where name = 'describe_session') and round_number = 2;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000411', true);
select public.expire_conversation_game_round((select id from public.conversation_game_rounds where session_id = (select id from stage4_ids where name = 'describe_session') and round_number = 2));
select ok((select status = 'completed' from public.game_sessions where id = (select id from stage4_ids where name = 'describe_session')), 'Describe completes after the second turn expires');
select is((select count(*)::integer from public.conversation_game_submissions where round_id = (select id from stage4_ids where name = 'describe_round1')), 1, 'the hidden word is revealed after timeout');

reset role;
select * from finish();
rollback;

