create extension if not exists "pgcrypto";

create table if not exists public.game_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  game_type text not null default 'tic-tac-toe' check (game_type = 'tic-tac-toe'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  expires_at timestamptz not null default (now() + interval '60 seconds'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);

create unique index if not exists game_requests_pending_unique
  on public.game_requests (requester_id, recipient_id, game_type) where status = 'pending';
create index if not exists game_requests_recipient_idx on public.game_requests (recipient_id, status, expires_at);
create index if not exists game_requests_requester_idx on public.game_requests (requester_id, status);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_type text not null default 'tic-tac-toe' check (game_type = 'tic-tac-toe'),
  player_x_id uuid not null references public.profiles(id) on delete cascade,
  player_o_id uuid not null references public.profiles(id) on delete cascade,
  board jsonb not null default '[null,null,null,null,null,null,null,null,null]'::jsonb,
  turn text not null default 'X' check (turn in ('X', 'O')),
  status text not null default 'active' check (status in ('active', 'won', 'draw', 'abandoned')),
  winner text check (winner in ('X', 'O') or winner is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player_x_id <> player_o_id)
);
create index if not exists game_sessions_players_idx on public.game_sessions (player_x_id, player_o_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind = 'game_request'),
  game_request_id uuid references public.game_requests(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.game_requests enable row level security;
alter table public.game_sessions enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "game requests visible to participants" on public.game_requests for select using (auth.uid() in (requester_id, recipient_id));
create policy "users create own game requests" on public.game_requests for insert with check (auth.uid() = requester_id);
create policy "recipients update pending requests" on public.game_requests for update using (auth.uid() = recipient_id and status = 'pending') with check (status in ('accepted', 'declined', 'expired'));
create policy "sessions visible to players" on public.game_sessions for select using (auth.uid() in (player_x_id, player_o_id));
create policy "players update their sessions" on public.game_sessions for update using (auth.uid() in (player_x_id, player_o_id)) with check (auth.uid() in (player_x_id, player_o_id));
create policy "notifications belong to user" on public.notifications for select using (auth.uid() = user_id);
create policy "users mark own notifications" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subscriptions belong to user" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.accept_game_request(request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare request_row game_requests; session_row game_sessions;
begin
  update game_requests set status = 'accepted', updated_at = now()
  where id = request_id and recipient_id = auth.uid() and status = 'pending' and expires_at > now()
  returning * into request_row;
  if request_row.id is null then raise exception 'Game request is no longer active'; end if;
  insert into game_sessions (player_x_id, player_o_id) values (request_row.requester_id, request_row.recipient_id) returning * into session_row;
  return jsonb_build_object('request', to_jsonb(request_row), 'session_id', session_row.id);
end;
$$;

alter publication supabase_realtime add table public.game_requests;
alter publication supabase_realtime add table public.game_sessions;
alter publication supabase_realtime add table public.notifications;
