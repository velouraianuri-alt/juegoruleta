-- fn_create_room: generates a unique 6-char code server-side and seats the creator.
create or replace function public.fn_create_room(
  p_name text,
  p_max_players integer,
  p_allowed_games public.game_type[]
)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_code text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Room name required';
  end if;
  if p_max_players < 2 or p_max_players > 10 then
    raise exception 'Invalid max players';
  end if;
  if p_allowed_games is null or array_length(p_allowed_games, 1) is null then
    raise exception 'At least one game required';
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;

  insert into public.rooms (code, name, owner_id, max_players, allowed_games, status)
  values (v_code, trim(p_name), v_uid, p_max_players, p_allowed_games, 'waiting')
  returning * into v_room;

  insert into public.room_players (room_id, user_id, status, seat_ready)
  values (v_room.id, v_uid, 'joined', true);

  return v_room;
end;
$$;

revoke all on function public.fn_create_room(text, integer, public.game_type[]) from public;
grant execute on function public.fn_create_room(text, integer, public.game_type[]) to authenticated;

-- fn_join_room: resolves a room by its private code (RLS alone can't do this lookup,
-- since a non-member can't SELECT a room row they don't know about yet).
create or replace function public.fn_join_room(p_code text)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if v_room.id is null then
    raise exception 'Room not found';
  end if;
  if v_room.status = 'closed' then
    raise exception 'Room is closed';
  end if;

  if exists (select 1 from public.room_players where room_id = v_room.id and user_id = v_uid) then
    update public.room_players set status = 'joined', left_at = null
    where room_id = v_room.id and user_id = v_uid;
    return v_room;
  end if;

  select count(*) into v_count from public.room_players
  where room_id = v_room.id and status = 'joined';
  if v_count >= v_room.max_players then
    raise exception 'Room is full';
  end if;

  insert into public.room_players (room_id, user_id, status, seat_ready)
  values (v_room.id, v_uid, 'joined', false);

  return v_room;
end;
$$;

revoke all on function public.fn_join_room(text) from public;
grant execute on function public.fn_join_room(text) to authenticated;

-- fn_leave_room
create or replace function public.fn_leave_room(p_room_id uuid)
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

  update public.room_players
  set status = 'left', left_at = now()
  where room_id = p_room_id and user_id = v_uid;
end;
$$;

revoke all on function public.fn_leave_room(uuid) from public;
grant execute on function public.fn_leave_room(uuid) to authenticated;

-- fn_toggle_ready
create or replace function public.fn_toggle_ready(p_room_id uuid, p_ready boolean)
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

  update public.room_players
  set seat_ready = p_ready
  where room_id = p_room_id and user_id = v_uid and status = 'joined';
end;
$$;

revoke all on function public.fn_toggle_ready(uuid, boolean) from public;
grant execute on function public.fn_toggle_ready(uuid, boolean) to authenticated;

-- fn_start_game_session / fn_end_game_session: only the room's creator can open or
-- close the table, per the spec ("el creador de la sala puede iniciar/cerrar la
-- partida"). Starting/stopping individual rounds within an active session is open
-- to any seated member (see the roulette/blackjack round RPCs).
create or replace function public.fn_start_game_session(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.id is null then
    raise exception 'Room not found';
  end if;
  if v_room.owner_id <> v_uid then
    raise exception 'Only the room owner can start the game';
  end if;

  update public.rooms set status = 'playing' where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

revoke all on function public.fn_start_game_session(uuid) from public;
grant execute on function public.fn_start_game_session(uuid) to authenticated;

create or replace function public.fn_end_game_session(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.id is null then
    raise exception 'Room not found';
  end if;
  if v_room.owner_id <> v_uid then
    raise exception 'Only the room owner can close the game';
  end if;

  update public.rooms set status = 'closed' where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

revoke all on function public.fn_end_game_session(uuid) from public;
grant execute on function public.fn_end_game_session(uuid) to authenticated;

-- fn_send_room_message: kept as an RPC (rather than a plain RLS insert) so the
-- server can trim/validate consistently; low economic risk either way.
create or replace function public.fn_send_room_message(p_room_id uuid, p_message text)
returns public.room_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.room_messages;
  v_trimmed text := trim(p_message);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_trimmed = '' or char_length(v_trimmed) > 500 then
    raise exception 'Invalid message';
  end if;
  if not exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = v_uid and status = 'joined'
  ) then
    raise exception 'Not a member of this room';
  end if;

  insert into public.room_messages (room_id, user_id, message)
  values (p_room_id, v_uid, v_trimmed)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.fn_send_room_message(uuid, text) from public;
grant execute on function public.fn_send_room_message(uuid, text) to authenticated;
