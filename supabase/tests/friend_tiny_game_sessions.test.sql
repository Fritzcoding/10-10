begin;
select plan(34);

select has_table('public', 'tiny_game_states', 'tiny games expose authorized public state');
select has_table('public', 'tiny_game_choices', 'RPS choices have protected storage');
select has_table('private', 'tiny_game_decks', 'memory deck values stay out of the exposed schema');
select has_function('public', 'submit_tiny_game_action', array['uuid', 'integer', 'jsonb'], 'tiny game actions use a revision-checked RPC');
select has_function('public', 'submit_tiny_game_rps_choice', array['uuid', 'text'], 'RPS choices use an authenticated RPC');
select ok(
  CASE WHEN pg_catalog.to_regclass('private.tiny_game_decks') IS NULL THEN false
  ELSE NOT has_table_privilege('authenticated', 'private.tiny_game_decks', 'SELECT') END,
  'players cannot read the hidden memory deck'
);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000801', 'tiny-one@example.test'),
  ('00000000-0000-4000-8000-000000000802', 'tiny-two@example.test'),
  ('00000000-0000-4000-8000-000000000803', 'tiny-outsider@example.test');
insert into public.friend_requests(requester_id, recipient_id, status, request_type) values
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000802', 'accepted', 'friend'),
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000803', 'pending', 'friend');
create temporary table tiny_fixtures(game_type text primary key, request_id uuid, session_id uuid);
grant select, insert, update on tiny_fixtures to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select lives_ok(
  $$insert into tiny_fixtures(game_type, request_id)
    select 'memory-match', (public.create_game_request('00000000-0000-4000-8000-000000000802', 'memory-match')->>'id')::uuid$$,
  'an accepted friend can receive a Memory Match request'
);
select throws_ok(
  $$select public.create_game_request('00000000-0000-4000-8000-000000000803', 'word-chain')$$,
  'P0001', 'Game requests are limited to your partner or confirmed friend',
  'a pending friend cannot receive a game request'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000802', true);
select lives_ok(
  $$update tiny_fixtures set session_id = (public.accept_game_request(request_id)->>'session_id')::uuid where game_type='memory-match'$$,
  'the accepted friend can accept the game request'
);
select is((select count(*)::integer from public.game_sessions where id=(select session_id from tiny_fixtures where game_type='memory-match')), 1, 'both friends can read the accepted session');
select is((select count(*)::integer from public.tiny_game_states where session_id=(select session_id from tiny_fixtures where game_type='memory-match')), 1, 'both friends can read public game state');
select ok((select (state->'cards'->0->>'pair') is null and (state->'cards'->15->>'pair') is null
  from public.tiny_game_states where session_id=(select session_id from tiny_fixtures where game_type='memory-match')),
  'the shuffled Memory Match deck is hidden in public state');
select throws_ok(
  $$select * from private.tiny_game_decks$$, '42501', null,
  'authenticated players cannot read the hidden deck table'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select lives_ok(
  $$select public.submit_tiny_game_action((select session_id from tiny_fixtures where game_type='memory-match'), 0, '{"type":"flip","index":0}'::jsonb)$$,
  'the current Memory Match player can flip a card'
);
select ok((select state->'cards'->0->>'pair' is not null
  and (select count(*) from pg_catalog.jsonb_array_elements(state->'cards') card where card->>'pair' is not null)=1
  from public.tiny_game_states where session_id=(select session_id from tiny_fixtures where game_type='memory-match')),
  'public Memory Match state reveals only the selected card');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000802', true);
select throws_ok(
  $$select public.submit_tiny_game_action((select session_id from tiny_fixtures where game_type='memory-match'), 1, '{"type":"flip","index":1}'::jsonb)$$,
  'P0001', 'It is not your turn', 'Memory Match keeps the turn until both cards are flipped'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select throws_ok(
  $$select public.submit_tiny_game_action((select session_id from tiny_fixtures where game_type='memory-match'), 1, '{"type":"flip","index":0}'::jsonb)$$,
  'P0001', 'Card is already open', 'the same card cannot be flipped twice'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000803', true);
select is((select count(*)::integer from public.game_sessions), 0, 'an unrelated user cannot read friend sessions');
select is((select count(*)::integer from public.tiny_game_states), 0, 'an unrelated user cannot read friend game state');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select lives_ok(
  $$insert into tiny_fixtures(game_type, request_id)
    select 'rock-paper-scissors', (public.create_game_request('00000000-0000-4000-8000-000000000802', 'rock-paper-scissors')->>'id')::uuid$$,
  'an accepted friend can request Rock Paper Scissors'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000802', true);
select lives_ok(
  $$update tiny_fixtures set session_id=(public.accept_game_request(request_id)->>'session_id')::uuid where game_type='rock-paper-scissors'$$,
  'an accepted friend can accept Rock Paper Scissors'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select lives_ok(
  $$select public.submit_tiny_game_rps_choice((select session_id from tiny_fixtures where game_type='rock-paper-scissors'), 'rock')$$,
  'the first RPS player can submit a private choice'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000802', true);
select is((select count(*)::integer from public.tiny_game_choices where session_id=(select session_id from tiny_fixtures where game_type='rock-paper-scissors')), 0, 'the other player cannot read a hidden RPS choice');
select lives_ok(
  $$select public.submit_tiny_game_rps_choice((select session_id from tiny_fixtures where game_type='rock-paper-scissors'), 'paper')$$,
  'the second RPS player can submit a private choice'
);
select is((select count(*)::integer from public.tiny_game_choices where session_id=(select session_id from tiny_fixtures where game_type='rock-paper-scissors')), 2, 'both RPS choices become readable after the second submission');
select throws_ok(
  $$select public.submit_tiny_game_rps_choice((select session_id from tiny_fixtures where game_type='rock-paper-scissors'), 'paper')$$,
  'P0001', 'Rock Paper Scissors session is unavailable', 'an RPS choice cannot be submitted after reveal'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select lives_ok(
  $$insert into tiny_fixtures(game_type, request_id)
    select 'word-chain', (public.create_game_request('00000000-0000-4000-8000-000000000802', 'word-chain')->>'id')::uuid$$,
  'an accepted friend can request Word Chain'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000802', true);
select lives_ok(
  $$update tiny_fixtures set session_id=(public.accept_game_request(request_id)->>'session_id')::uuid where game_type='word-chain'$$,
  'an accepted friend can accept Word Chain'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select lives_ok(
  $$select public.submit_tiny_game_action((select session_id from tiny_fixtures where game_type='word-chain'), 0, '{"type":"word","word":" cloud "}'::jsonb)$$,
  'the first Word Chain player can submit a valid word'
);
select throws_ok(
  $$select public.submit_tiny_game_action((select session_id from tiny_fixtures where game_type='word-chain'), 1, '{"type":"word","word":"dawn"}'::jsonb)$$,
  'P0001', 'It is not your turn', 'Word Chain alternates turns'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000802', true);
select lives_ok(
  $$select public.submit_tiny_game_action((select session_id from tiny_fixtures where game_type='word-chain'), 1, '{"type":"word","word":"dawn"}'::jsonb)$$,
  'the second Word Chain player can continue the chain'
);
select throws_ok(
  $$select public.submit_tiny_game_action((select session_id from tiny_fixtures where game_type='word-chain'), 1, '{"type":"word","word":"dawn"}'::jsonb)$$,
  '40001', 'stale_revision', 'a stale Word Chain revision is rejected'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000801', true);
select throws_ok(
  $$select public.submit_tiny_game_action((select session_id from tiny_fixtures where game_type='word-chain'), 2, '{"type":"word","word":"CLOUD"}'::jsonb)$$,
  'P0001', 'Word was already used', 'Word Chain rejects repeated words'
);
select ok(
  CASE WHEN pg_catalog.to_regclass('public.tiny_game_choices') IS NULL THEN false
  ELSE NOT has_table_privilege('authenticated', 'public.tiny_game_choices', 'INSERT') END,
  'players cannot insert or overwrite private choices directly'
);

select * from finish();
rollback;
