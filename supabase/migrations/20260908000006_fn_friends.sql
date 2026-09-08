-- fn_send_friend_request: re-derives auth.uid() server-side, resolves the target by
-- username, and reuses/updates the single row that can ever exist between two users
-- (see the unique index on the unordered pair) instead of accumulating duplicates.
create or replace function public.fn_send_friend_request(p_target_username text)
returns public.friend_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target_id uuid;
  v_existing public.friend_requests;
  v_row public.friend_requests;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_target_id from public.profiles where lower(username) = lower(trim(p_target_username));
  if v_target_id is null then
    raise exception 'User not found';
  end if;
  if v_target_id = v_uid then
    raise exception 'Cannot add yourself';
  end if;

  select * into v_existing from public.friend_requests
  where least(sender_id, receiver_id) = least(v_uid, v_target_id)
    and greatest(sender_id, receiver_id) = greatest(v_uid, v_target_id);

  if v_existing.id is not null then
    if v_existing.status = 'accepted' then
      raise exception 'Already friends';
    elsif v_existing.status = 'pending' then
      raise exception 'Request already pending';
    else
      update public.friend_requests
      set sender_id = v_uid, receiver_id = v_target_id, status = 'pending',
          created_at = now(), responded_at = null
      where id = v_existing.id
      returning * into v_row;
      return v_row;
    end if;
  end if;

  insert into public.friend_requests (sender_id, receiver_id, status)
  values (v_uid, v_target_id, 'pending')
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.fn_send_friend_request(text) from public;
grant execute on function public.fn_send_friend_request(text) to authenticated;

-- fn_respond_friend_request: only the receiver may accept/decline, checked server-side.
create or replace function public.fn_respond_friend_request(p_request_id uuid, p_accept boolean)
returns public.friend_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.friend_requests;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.friend_requests where id = p_request_id for update;
  if v_row.id is null then
    raise exception 'Request not found';
  end if;
  if v_row.receiver_id <> v_uid then
    raise exception 'Not authorized to respond to this request';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Request already resolved';
  end if;

  update public.friend_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_request_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.fn_respond_friend_request(uuid, boolean) from public;
grant execute on function public.fn_respond_friend_request(uuid, boolean) to authenticated;

-- fn_remove_friend: either party can end an accepted friendship.
create or replace function public.fn_remove_friend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.friend_requests
  where status = 'accepted'
    and least(sender_id, receiver_id) = least(v_uid, p_friend_id)
    and greatest(sender_id, receiver_id) = greatest(v_uid, p_friend_id);
end;
$$;

revoke all on function public.fn_remove_friend(uuid) from public;
grant execute on function public.fn_remove_friend(uuid) to authenticated;
