begin;
select plan(24);

select has_table('public', 'game_submissions', 'hidden answers have a dedicated table');
select has_column('public', 'game_sessions', 'deadline_at', 'sessions have a server deadline');
select has_function('public', 'submit_hidden_game_answer', array['uuid', 'text'], 'hidden answers use an authenticated RPC');
select ok(
  CASE WHEN to_regprocedure('public.submit_hidden_game_answer(uuid,text)') IS NULL THEN false
       ELSE NOT has_function_privilege('anon', 'public.submit_hidden_game_answer(uuid,text)', 'EXECUTE') END,
  'anonymous users cannot submit answers'
);
select ok(not has_function_privilege('authenticated', 'public.generate_profile_uid()', 'EXECUTE'), 'profile UID generation is trigger-only');
select ok(not exists (
  select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE')
), 'anonymous users cannot execute security-definer functions');
select ok(not exists (
  select 1 from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and p.prosecdef
    and not coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
), 'all security-definer functions pin an empty search path');

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000311', 'stage3-a@example.test'),
  ('00000000-0000-4000-8000-000000000312', 'stage3-b@example.test'),
  ('00000000-0000-4000-8000-000000000313', 'stage3-c@example.test'),
  ('00000000-0000-4000-8000-000000000314', 'stage3-d@example.test');
insert into public.couples (id) values ('00000000-0000-4000-8000-000000000321');
insert into public.couple_members (couple_id, user_id, member_slot) values
  ('00000000-0000-4000-8000-000000000321', '00000000-0000-4000-8000-000000000311', 1),
  ('00000000-0000-4000-8000-000000000321', '00000000-0000-4000-8000-000000000312', 2);
insert into public.couples (id) values ('00000000-0000-4000-8000-000000000322');
insert into public.couple_members (couple_id, user_id, member_slot) values
  ('00000000-0000-4000-8000-000000000322', '00000000-0000-4000-8000-000000000313', 1),
  ('00000000-0000-4000-8000-000000000322', '00000000-0000-4000-8000-000000000314', 2);
insert into public.game_sessions (id, game_type, player_x_id, player_o_id)
values ('00000000-0000-4000-8000-000000000332', 'would-you-rather', '00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000312');

create temporary table stage3_ids (name text primary key, id uuid) on commit drop;
grant select, insert, update on stage3_ids to authenticated;
create temporary table stage3_observed (name text primary key, passed boolean, detail text) on commit drop;
grant select, insert on stage3_observed to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000311', true);
insert into stage3_ids values ('wyr_request', (public.create_game_request('00000000-0000-4000-8000-000000000312', 'would-you-rather')->>'id')::uuid);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000312', true);
insert into stage3_ids values ('wyr_session', (public.accept_game_request((select id from stage3_ids where name = 'wyr_request'))->>'session_id')::uuid);
select ok((select game_type = 'would-you-rather' and deadline_at > pg_catalog.now() from public.game_sessions where id = (select id from stage3_ids where name = 'wyr_session')), 'acceptance creates the requested game with a database deadline');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000311', true);
select public.submit_hidden_game_answer((select id from stage3_ids where name = 'wyr_session'), 'left');
select ok((select count(*) = 1 from public.game_submissions where session_id = (select id from stage3_ids where name = 'wyr_session')), 'submitter can read their own answer while it is hidden');
do $$ begin
  perform public.submit_hidden_game_answer((select id from stage3_ids where name = 'wyr_session'), 'right');
  insert into stage3_observed values ('duplicate', false, 'duplicate answer accepted');
exception when unique_violation then
  insert into stage3_observed values ('duplicate', true, SQLERRM);
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000312', true);
select ok((select count(*) = 0 from public.game_submissions where session_id = (select id from stage3_ids where name = 'wyr_session')), 'partner cannot read the one-sided answer');
do $$ begin
  perform public.submit_hidden_game_answer((select id from stage3_ids where name = 'wyr_session'), 'neither');
  insert into stage3_observed values ('invalid_answer', false, 'invalid answer accepted');
exception when others then
  insert into stage3_observed values ('invalid_answer', SQLERRM ILIKE '%answer is invalid%', SQLERRM);
end $$;
select public.submit_hidden_game_answer((select id from stage3_ids where name = 'wyr_session'), 'right');
select ok((select count(*) = 2 from public.game_submissions where session_id = (select id from stage3_ids where name = 'wyr_session')), 'both answers become visible after both submit');
select ok((select status = 'completed' from public.game_sessions where id = (select id from stage3_ids where name = 'wyr_session')), 'the server completes the round after the second answer');
do $$ begin
  perform public.submit_hidden_game_answer((select id from stage3_ids where name = 'wyr_session'), 'left');
  insert into stage3_observed values ('completed', false, 'completed round accepted another answer');
exception when others then
  insert into stage3_observed values ('completed', SQLERRM ILIKE '%completed%', SQLERRM);
end $$;

reset role;
insert into public.game_sessions (id, game_type, player_x_id, player_o_id, deadline_at)
values ('00000000-0000-4000-8000-000000000331', 'would-you-rather', '00000000-0000-4000-8000-000000000311', '00000000-0000-4000-8000-000000000312', pg_catalog.now() + interval '1 hour');
insert into public.game_submissions (session_id, user_id, answer)
values ('00000000-0000-4000-8000-000000000331', '00000000-0000-4000-8000-000000000311', 'left');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000312', true);
select ok((select count(*) = 0 from public.game_submissions where session_id = '00000000-0000-4000-8000-000000000331'), 'a future deadline keeps the lone answer hidden');
reset role;
update public.game_sessions set deadline_at = pg_catalog.now() - interval '1 second' where id = '00000000-0000-4000-8000-000000000331';
set local role authenticated;
select ok((select count(*) = 1 from public.game_submissions where session_id = '00000000-0000-4000-8000-000000000331'), 'database time reveals answers after the deadline');
do $$ begin
  perform public.submit_hidden_game_answer('00000000-0000-4000-8000-000000000331', 'right');
  insert into stage3_observed values ('deadline', false, 'answer accepted after deadline');
exception when others then
  insert into stage3_observed values ('deadline', SQLERRM LIKE '%deadline%', SQLERRM);
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000313', true);
select ok((select count(*) = 0 from public.game_submissions where session_id = '00000000-0000-4000-8000-000000000331'), 'an unrelated couple cannot read submissions');
do $$ begin
  perform public.submit_hidden_game_answer('00000000-0000-4000-8000-000000000331', 'right');
  insert into stage3_observed values ('cross_couple', false, 'unrelated couple submitted an answer');
exception when others then
  insert into stage3_observed values ('cross_couple', SQLERRM LIKE '%unavailable%', SQLERRM);
end $$;
do $$ begin
  insert into public.game_submissions (session_id, user_id, answer)
  values ('00000000-0000-4000-8000-000000000331', '00000000-0000-4000-8000-000000000313', 'right');
  insert into stage3_observed values ('direct_insert', false, 'client wrote a submission directly');
exception when insufficient_privilege then
  insert into stage3_observed values ('direct_insert', true, SQLERRM);
end $$;
select ok((select passed from stage3_observed where name = 'duplicate'), 'a participant cannot submit twice');
select ok((select passed from stage3_observed where name = 'invalid_answer'), 'unsupported answers are rejected');
select ok((select passed from stage3_observed where name = 'deadline'), 'the RPC rejects submissions after the server deadline');
select ok((select passed from stage3_observed where name = 'cross_couple'), 'an unrelated couple cannot submit to the session');
select ok((select passed from stage3_observed where name = 'direct_insert'), 'clients cannot bypass the submission RPC');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000312', true);
insert into stage3_ids values ('ttt_request', (public.create_game_request('00000000-0000-4000-8000-000000000311')->>'id')::uuid);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000311', true);
insert into stage3_ids values ('ttt_session', (public.accept_game_request((select id from stage3_ids where name = 'ttt_request'))->>'session_id')::uuid);
select ok((select game_type = 'tic-tac-toe' and deadline_at IS NULL from public.game_sessions where id = (select id from stage3_ids where name = 'ttt_session')), 'one-argument requests still accept into a Tic-Tac-Toe session');
do $$ begin
  perform public.submit_hidden_game_answer((select id from stage3_ids where name = 'ttt_session'), 'left');
  insert into stage3_observed values ('invalid_game', false, 'hidden answer accepted for Tic-Tac-Toe');
exception when others then
  insert into stage3_observed values ('invalid_game', SQLERRM ILIKE '%unavailable%', SQLERRM);
end $$;
select ok((select passed from stage3_observed where name = 'completed'), 'completed sessions reject additional answers');
select ok((select passed from stage3_observed where name = 'invalid_game'), 'hidden answers are rejected for other game types');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000311', true);
do $$
declare
  before_session public.game_sessions;
  after_session public.game_sessions;
begin
  select * into before_session from public.game_sessions where id = '00000000-0000-4000-8000-000000000332';
  begin
    perform public.submit_tic_tac_toe_move(before_session.id, before_session.revision, 0);
    insert into stage3_observed values ('ttt_wrong_game', false, 'Tic-Tac-Toe RPC accepted a Would You Rather session');
  exception when others then
    select * into after_session from public.game_sessions where id = before_session.id;
    insert into stage3_observed values (
      'ttt_wrong_game',
      SQLERRM ILIKE '%not a Tic-Tac-Toe game%'
        AND after_session.board = before_session.board
        AND after_session.turn = before_session.turn
        AND after_session.status = before_session.status
        AND after_session.revision = before_session.revision,
      SQLERRM
    );
  end;
end $$;
select ok((select passed from stage3_observed where name = 'ttt_wrong_game'), 'Tic-Tac-Toe RPC rejects Would You Rather sessions without mutation');

reset role;
select * from finish();
rollback;
