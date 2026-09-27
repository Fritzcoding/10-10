create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  request_type text not null default 'friend' check (request_type in ('friend', 'partner')),
  created_at timestamptz not null default timezone('utc', now()),
  constraint friend_requests_distinct_users check (requester_id <> recipient_id)
);

alter table public.friend_requests
  add column if not exists request_type text not null default 'friend';

create index if not exists friend_requests_requester_idx
  on public.friend_requests (requester_id, status, created_at);

create index if not exists friend_requests_recipient_idx
  on public.friend_requests (recipient_id, status, created_at);

alter table public.profiles enable row level security;

drop policy if exists "Authenticated users can discover profiles" on public.profiles;
create policy "Authenticated users can discover profiles"
  on public.profiles for select
  to authenticated
  using (auth.uid() is not null);

alter table public.friend_requests enable row level security;

drop policy if exists "Users can read related friend requests" on public.friend_requests;
create policy "Users can read related friend requests"
  on public.friend_requests for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists "Users can create their own friend requests" on public.friend_requests;
create policy "Users can create their own friend requests"
  on public.friend_requests for insert
  to authenticated
  with check (auth.uid() = requester_id);

drop policy if exists "Recipients can update friend requests" on public.friend_requests;
create policy "Recipients can update friend requests"
  on public.friend_requests for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

notify pgrst, 'reload schema';
