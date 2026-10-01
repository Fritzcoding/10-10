drop function if exists public.create_game_request(uuid);

create or replace function public.create_game_request(target_recipient_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.game_requests;
  existing_row public.game_requests;
begin
  if auth.uid() is null then
    raise exception 'Sign in before sending a game request';
  end if;

  update public.game_requests as gr
  set status = 'expired', updated_at = now()
  where gr.requester_id = auth.uid()
    and gr.recipient_id = target_recipient_id
    and gr.status = 'pending'
    and gr.expires_at <= now();

  select gr.* into existing_row
  from public.game_requests as gr
  where gr.requester_id = auth.uid()
    and gr.recipient_id = target_recipient_id
    and gr.status = 'pending'
    and gr.expires_at > now();

  if existing_row.id is not null then
    return jsonb_build_object('id', existing_row.id, 'requester_id', existing_row.requester_id, 'recipient_id', existing_row.recipient_id, 'game_type', existing_row.game_type, 'status', existing_row.status, 'expires_at', existing_row.expires_at, 'created_at', existing_row.created_at, 'updated_at', existing_row.updated_at, 'wasExisting', true);
  end if;

  insert into public.game_requests (requester_id, recipient_id)
  values (auth.uid(), target_recipient_id)
  returning * into request_row;

  return jsonb_build_object('id', request_row.id, 'requester_id', request_row.requester_id, 'recipient_id', request_row.recipient_id, 'game_type', request_row.game_type, 'status', request_row.status, 'expires_at', request_row.expires_at, 'created_at', request_row.created_at, 'updated_at', request_row.updated_at);
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;
