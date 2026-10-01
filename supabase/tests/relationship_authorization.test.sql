begin;
select plan(33);
select has_table('public', 'couples', 'canonical couples table exists');
select has_table('public', 'couple_members', 'couple membership is normalized and unique');
select has_function('public', 'search_profile', array['text'], 'profile discovery is an explicit exact-match RPC');
select has_function('public', 'respond_to_friend_request', array['uuid', 'boolean'], 'partner acceptance is a transactional RPC');
select ok(
  (select p.proargnames = array['target_request_id', 'accept_request']::text[]
   from pg_catalog.pg_proc p
   where p.oid = 'public.respond_to_friend_request(uuid,boolean)'::regprocedure),
  'friend response RPC parameter names match the client payload'
);
select has_column('public', 'game_sessions', 'revision', 'game sessions carry a concurrency revision');
select has_function('public', 'submit_tic_tac_toe_move', array['uuid', 'integer', 'integer'], 'moves use a revision-checked RPC');
select has_function('public', 'get_couple_partner', array[]::text[], 'the current user can resolve only their canonical partner');
select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE'), 'auth trigger function is not a public RPC');
select ok(not has_function_privilege('anon', 'public.generate_profile_uid()', 'EXECUTE'), 'profile UID helper is not callable by anonymous users');
select ok(not has_table_privilege('authenticated', 'public.couples', 'INSERT'), 'clients cannot create couple rows directly');

create temporary table observed_access (name text primary key, allowed boolean, detail text) on commit drop;
grant select, insert on observed_access to authenticated;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000101', 'member-one@example.test'),
  ('00000000-0000-0000-0000-000000000102', 'member-two@example.test'),
  ('00000000-0000-0000-0000-000000000103', 'unrelated@example.test'),
  ('00000000-0000-0000-0000-000000000104', 'new-member@example.test'),
  ('00000000-0000-0000-0000-000000000105', 'new-partner@example.test'),
  ('00000000-0000-0000-0000-000000000106', 'unpaired-player@example.test');
insert into public.couples (id) values ('00000000-0000-0000-0000-000000000201');
insert into public.couple_members (couple_id, user_id, member_slot) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 1),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000102', 2);
insert into public.game_sessions (id, player_x_id, player_o_id) values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000106');
insert into public.game_sessions (id, player_x_id, player_o_id, board)
values ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102', '["Z", null, null, null, null, null, null, null, null]'::jsonb);
insert into public.friend_requests (id, requester_id, recipient_id, status, request_type) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000105', 'accepted', 'friend'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000105', 'pending', 'partner'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000104', 'accepted', 'friend'),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000104', 'pending', 'partner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
do $$
begin
  begin
    insert into observed_access values ('profile_rows',
      (select count(*) = 1 from public.profiles), 'unrelated user profile visibility');
  exception when others then
    insert into observed_access values ('profile_rows', false, SQLERRM);
  end;
  begin
    insert into observed_access values ('couple_rows',
      (select count(*) = 0 from public.couples), 'unrelated user couple visibility');
  exception when others then
    insert into observed_access values ('couple_rows', false, SQLERRM);
  end;
  begin
    insert into observed_access values ('exact_profile_search',
      (select count(*) = 1 from public.search_profile('member-one@example.test')), 'exact email lookup');
  exception when others then
    insert into observed_access values ('exact_profile_search', false, SQLERRM);
  end;
  begin
    insert into observed_access values ('wildcard_profile_search',
      (select count(*) = 0 from public.search_profile('%@example.test')), 'wildcards do not enumerate profiles');
  exception when others then
    insert into observed_access values ('wildcard_profile_search', false, SQLERRM);
  end;
  begin
    insert into observed_access values ('game_read_scope',
      (select count(*) = 0 from public.game_sessions), 'unrelated users cannot read sessions');
  exception when others then
    insert into observed_access values ('game_read_scope', false, SQLERRM);
  end;
  IF to_regprocedure('public.get_couple_partner()') IS NULL THEN
    insert into observed_access values ('unpaired_partner_lookup', false, 'partner lookup RPC missing');
  ELSE
    insert into observed_access values ('unpaired_partner_lookup',
      (select count(*) = 0 from public.get_couple_partner()), 'unpaired user sees no partner profile');
  END IF;
  begin
    perform public.submit_tic_tac_toe_move('00000000-0000-0000-0000-000000000401', 0, 0);
    insert into observed_access values ('unpaired_move', false, 'unpaired user moved another couple game');
  exception when others then
    insert into observed_access values ('unpaired_move', SQLERRM LIKE '%unavailable%', SQLERRM);
  end;
  begin
    insert into public.direct_messages (sender_id, recipient_id, body)
    values ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000101', 'unauthorized');
    insert into observed_access values ('chat_scope', false, 'unrelated recipient insert succeeded');
  exception when others then
    insert into observed_access values ('chat_scope', SQLSTATE = '42501', SQLERRM);
  end;
  begin
    insert into public.friend_requests (requester_id, recipient_id, status, request_type)
    values ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000101', 'accepted', 'friend');
    insert into observed_access values ('forged_friend_acceptance', false, 'caller inserted an accepted relationship');
  exception when others then
    insert into observed_access values ('forged_friend_acceptance', SQLSTATE = '42501', SQLERRM);
  end;
end;
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000105', true);
do $$
begin
  begin
    perform public.respond_to_friend_request('00000000-0000-0000-0000-000000000302', true);
    insert into observed_access values ('atomic_pair_accept',
      (select count(*) = 2 from public.couple_members
       where user_id IN ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000105')),
      'partner acceptance creates exactly two members');
  exception when others then
    insert into observed_access values ('atomic_pair_accept', false, SQLERRM);
  end;
end;
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);
do $$
begin
  begin
    perform public.respond_to_friend_request('00000000-0000-0000-0000-000000000304', true);
    insert into observed_access values ('one_couple_per_user', false, 'second pairing succeeded');
  exception when others then
    insert into observed_access values ('one_couple_per_user', SQLERRM LIKE '%already belongs to a couple%', SQLERRM);
  end;
end;
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
do $$
begin
  IF to_regprocedure('public.get_couple_partner()') IS NULL THEN
    insert into observed_access values ('canonical_partner_lookup', false, 'partner lookup RPC missing');
  ELSE
    insert into observed_access values ('canonical_partner_lookup',
      (select count(*) = 1 from public.get_couple_partner()
       where id = '00000000-0000-0000-0000-000000000102'), 'paired user resolves the other canonical member');
  END IF;
end;
$$;
insert into public.direct_messages (sender_id, recipient_id, body)
values ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000102', 'private test message');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
insert into observed_access values ('chat_read_scope',
  (select count(*) = 0 from public.direct_messages), 'unrelated user cannot read couple chat');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
do $$
declare
  updated_rows integer;
begin
  begin
    update public.game_sessions set turn = 'O'
    where id = '00000000-0000-0000-0000-000000000401';
    get diagnostics updated_rows = row_count;
    insert into observed_access values ('direct_game_update', updated_rows = 0, 'only the move RPC can change session state');
  exception when others then
    insert into observed_access values ('direct_game_update', SQLSTATE = '42501', SQLERRM);
  end;
end;
$$;
do $$
declare
  move_result jsonb;
begin
  if to_regprocedure('public.submit_tic_tac_toe_move(uuid,integer,integer)') is null then
    insert into observed_access values
      ('first_legal_move', false, 'move RPC missing'), ('out_of_turn', false, 'move RPC missing'),
      ('occupied_square', false, 'move RPC missing'), ('win_state', false, 'move RPC missing'),
      ('stale_revision', false, 'move RPC missing'), ('finished_game', false, 'move RPC missing'),
      ('invalid_cell', false, 'move RPC missing'), ('invalid_existing_board', false, 'move RPC missing');
    return;
  end if;
  begin
    perform public.submit_tic_tac_toe_move('00000000-0000-0000-0000-000000000401', 0, 9);
    insert into observed_access values ('invalid_cell', false, 'out-of-range cell was accepted');
  exception when others then
    insert into observed_access values ('invalid_cell', SQLERRM LIKE '%index is invalid%', SQLERRM);
  end;
  begin
    perform public.submit_tic_tac_toe_move('00000000-0000-0000-0000-000000000403', 0, 1);
    insert into observed_access values ('invalid_existing_board', false, 'malformed board was accepted');
  exception when others then
    insert into observed_access values ('invalid_existing_board', SQLERRM LIKE '%board is invalid%', SQLERRM);
  end;
  begin
    move_result := public.submit_tic_tac_toe_move('00000000-0000-0000-0000-000000000401', 0, 0);
    insert into observed_access values ('first_legal_move',
      (move_result->>'revision')::integer = 1 AND move_result->'board'->>0 = 'X' AND move_result->>'turn' = 'O',
      'first legal X move advances the state');
  exception when others then
    insert into observed_access values ('first_legal_move', false, SQLERRM);
  end;
  begin
    perform public.submit_tic_tac_toe_move('00000000-0000-0000-0000-000000000401', 1, 1);
    insert into observed_access values ('out_of_turn', false, 'out-of-turn move succeeded');
  exception when others then
    insert into observed_access values ('out_of_turn', SQLERRM LIKE '%not your turn%', SQLERRM);
  end;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
  begin
    perform public.submit_tic_tac_toe_move('00000000-0000-0000-0000-000000000401', 1, 0);
    insert into observed_access values ('occupied_square', false, 'occupied square was overwritten');
  exception when others then
    insert into observed_access values ('occupied_square', SQLERRM LIKE '%occupied%', SQLERRM);
  end;
  perform public.submit_tic_tac_toe_move('00000000-0000-0000-0000-000000000401', 1, 3);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
  perform public.submit_tic_tac_toe_move('00000000-0000-0000-0000-000000000401', 2, 1);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
  perform public.submit_tic_tac_toe_move('00000000-0000-0000-0000-000000000401', 3, 4);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
  perform public.submit_tic_tac_toe_move('00000000-0000-0000-0000-000000000401', 4, 2);
  insert into observed_access values ('win_state',
    (select revision = 5 AND status = 'won' AND winner = 'X' from public.game_sessions
     where id = '00000000-0000-0000-0000-000000000401'), 'winning move is recorded');
  begin
    perform public.submit_tic_tac_toe_move('00000000-0000-0000-0000-000000000401', 4, 5);
    insert into observed_access values ('stale_revision', false, 'stale revision was accepted');
  exception when others then
    insert into observed_access values ('stale_revision', SQLSTATE = '40001', SQLERRM);
  end;
  begin
    perform public.submit_tic_tac_toe_move('00000000-0000-0000-0000-000000000401', 5, 5);
    insert into observed_access values ('finished_game', false, 'move after win was accepted');
  exception when others then
    insert into observed_access values ('finished_game', SQLERRM LIKE '%completed%', SQLERRM);
  end;
end;
$$;
reset role;
select ok((select allowed from observed_access where name = 'profile_rows'), 'unrelated users cannot list profiles');
select ok((select allowed from observed_access where name = 'couple_rows'), 'unrelated users cannot read couple records');
select ok((select allowed from observed_access where name = 'exact_profile_search'), 'exact email lookup returns one intended profile');
select ok((select allowed from observed_access where name = 'wildcard_profile_search'), 'wildcard profile enumeration is rejected');
select ok((select allowed from observed_access where name = 'game_read_scope'), 'unrelated user cannot read sessions');
select ok((select allowed from observed_access where name = 'unpaired_partner_lookup'), 'unpaired user has no canonical partner');
select ok((select allowed from observed_access where name = 'unpaired_move'), 'unpaired user cannot submit another couple move');
select ok((select allowed from observed_access where name = 'chat_scope'), 'unrelated account cannot message a couple member');
select ok((select allowed from observed_access where name = 'forged_friend_acceptance'), 'clients cannot forge an accepted friend relationship');
select ok((select allowed from observed_access where name = 'chat_read_scope'), 'unrelated account cannot read couple messages');
select ok((select allowed from observed_access where name = 'canonical_partner_lookup'), 'paired user sees only the other canonical member');
select ok((select allowed from observed_access where name = 'direct_game_update'), 'participants cannot bypass the game move RPC');
select ok((select allowed from observed_access where name = 'invalid_cell'), 'out-of-range cell is rejected');
select ok((select allowed from observed_access where name = 'invalid_existing_board'), 'malformed persisted board is rejected');
select ok((select allowed from observed_access where name = 'first_legal_move'), 'a legal move is applied atomically');
select ok((select allowed from observed_access where name = 'out_of_turn'), 'out-of-turn moves are rejected');
select ok((select allowed from observed_access where name = 'occupied_square'), 'occupied squares cannot be overwritten');
select ok((select allowed from observed_access where name = 'win_state'), 'winning move stores the derived result');
select ok((select allowed from observed_access where name = 'stale_revision'), 'stale concurrent submission is rejected');
select ok((select allowed from observed_access where name = 'finished_game'), 'finished games reject later moves');
select diag((select detail from observed_access where name = 'atomic_pair_accept'));
select ok((select allowed from observed_access where name = 'atomic_pair_accept'), 'partner acceptance creates one complete two-member couple');
select ok((select allowed from observed_access where name = 'one_couple_per_user'), 'already-paired user cannot accept another partner');
select * from finish();
rollback;
