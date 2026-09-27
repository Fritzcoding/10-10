create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default timezone('utc', now()),
  constraint direct_messages_distinct_participants check (sender_id <> recipient_id)
);

create index if not exists direct_messages_conversation_idx
  on public.direct_messages (sender_id, recipient_id, created_at);

alter table public.direct_messages enable row level security;

drop policy if exists "Participants can read direct messages" on public.direct_messages;
create policy "Participants can read direct messages"
  on public.direct_messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users can send direct messages" on public.direct_messages;
create policy "Users can send direct messages"
  on public.direct_messages for insert
  to authenticated
  with check (auth.uid() = sender_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;
