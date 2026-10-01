drop function if exists public.accept_game_request(uuid);

create or replace function public.accept_game_request(target_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.game_requests;
  session_row public.game_sessions;
begin
  update public.game_requests as gr
  set status = 'accepted', updated_at = now()
  where gr.id = target_request_id
    and gr.recipient_id = auth.uid()
    and gr.status = 'pending'
    and gr.expires_at > now()
  returning gr.* into request_row;

  if request_row.id is null then
    raise exception 'Game request is no longer active';
  end if;

  insert into public.game_sessions (player_x_id, player_o_id)
  values (request_row.requester_id, request_row.recipient_id)
  returning * into session_row;

  return jsonb_build_object('request', to_jsonb(request_row), 'session_id', session_row.id);
end;
$$;
