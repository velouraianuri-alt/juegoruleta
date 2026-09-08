-- fn_start_roulette_round: opens a 20s betting window. Any seated member can start
-- one (the owner already gates the session itself via fn_start_game_session), and
-- the partial unique index game_rounds_one_active_per_room_idx guarantees only one
-- round can ever be in flight per room.
create or replace function public.fn_start_roulette_round(p_room_id uuid)
returns public.game_rounds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_round public.game_rounds;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = v_uid and status = 'joined'
  ) then
    raise exception 'Not a member of this room';
  end if;
  if not exists (select 1 from public.rooms where id = p_room_id and status = 'playing') then
    raise exception 'Room is not in an active game session';
  end if;

  insert into public.game_rounds (room_id, game_type, phase, phase_ends_at)
  values (p_room_id, 'roulette', 'betting', now() + interval '20 seconds')
  returning * into v_round;

  return v_round;
exception
  when unique_violation then
    raise exception 'A round is already in progress for this room';
end;
$$;

revoke all on function public.fn_start_roulette_round(uuid) from public;
grant execute on function public.fn_start_roulette_round(uuid) to authenticated;

-- fn_place_roulette_bet: deducts chips immediately (escrow) and validates the bet
-- shape server-side. The client can never write virtual_balance directly — this is
-- the only path that moves chips out of a wallet for a roulette bet.
create or replace function public.fn_place_roulette_bet(
  p_round_id uuid,
  p_bet_type text,
  p_bet_value text,
  p_amount bigint
)
returns public.roulette_bets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_round public.game_rounds;
  v_profile public.profiles;
  v_bet public.roulette_bets;
  v_new_balance bigint;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid bet amount';
  end if;

  select * into v_round from public.game_rounds where id = p_round_id for update;
  if v_round.id is null or v_round.game_type <> 'roulette' then
    raise exception 'Round not found';
  end if;
  if v_round.phase <> 'betting' or v_round.phase_ends_at < now() then
    raise exception 'Betting window is closed';
  end if;
  if not exists (
    select 1 from public.room_players
    where room_id = v_round.room_id and user_id = v_uid and status = 'joined'
  ) then
    raise exception 'Not a member of this room';
  end if;

  if p_bet_type = 'straight' and (p_bet_value is null or p_bet_value !~ '^\d+$' or p_bet_value::int not between 0 and 36) then
    raise exception 'Invalid straight number';
  end if;
  if p_bet_type = 'dozen' and (p_bet_value is null or p_bet_value not in ('1', '2', '3')) then
    raise exception 'Invalid dozen';
  end if;
  if p_bet_type = 'column' and (p_bet_value is null or p_bet_value not in ('1', '2', '3')) then
    raise exception 'Invalid column';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.virtual_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  v_new_balance := v_profile.virtual_balance - p_amount;
  update public.profiles set virtual_balance = v_new_balance where id = v_uid;

  insert into public.wallet_transactions (user_id, amount, balance_after, reason, round_id)
  values (v_uid, -p_amount, v_new_balance, 'bet', p_round_id);

  insert into public.roulette_bets (round_id, user_id, bet_type, bet_value, amount)
  values (p_round_id, v_uid, p_bet_type, p_bet_value, p_amount)
  returning * into v_bet;

  return v_bet;
end;
$$;

revoke all on function public.fn_place_roulette_bet(uuid, text, text, bigint) from public;
grant execute on function public.fn_place_roulette_bet(uuid, text, text, bigint) to authenticated;

-- fn_settle_roulette_round: the whole point of the exercise. The winning number is
-- generated here, from pgcrypto's CSPRNG, only after the betting window has
-- genuinely closed (server clock, not the caller's) — nothing about the outcome is
-- ever computed on, or knowable to, the client beforehand.
create or replace function public.fn_settle_roulette_round(p_round_id uuid)
returns public.game_rounds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round public.game_rounds;
  v_number int;
  v_color text;
  v_is_even boolean;
  v_dozen int;
  v_column int;
  v_bet record;
  v_win boolean;
  v_multiplier numeric;
  v_payout bigint;
  v_profile public.profiles;
  v_new_balance bigint;
  v_red_numbers constant int[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  v_rand_bytes bytea;
begin
  select * into v_round from public.game_rounds where id = p_round_id for update;
  if v_round.id is null or v_round.game_type <> 'roulette' then
    raise exception 'Round not found';
  end if;
  if v_round.phase <> 'betting' then
    raise exception 'Round is not in betting phase';
  end if;
  if v_round.phase_ends_at > now() then
    raise exception 'Betting window still open';
  end if;

  v_rand_bytes := extensions.gen_random_bytes(4);
  v_number := (
    get_byte(v_rand_bytes, 0)::bigint * 16777216
    + get_byte(v_rand_bytes, 1)::bigint * 65536
    + get_byte(v_rand_bytes, 2)::bigint * 256
    + get_byte(v_rand_bytes, 3)::bigint
  ) % 37;

  if v_number = 0 then
    v_color := 'green';
  elsif v_number = any(v_red_numbers) then
    v_color := 'red';
  else
    v_color := 'black';
  end if;
  v_is_even := v_number <> 0 and v_number % 2 = 0;
  v_dozen := case when v_number = 0 then 0 when v_number <= 12 then 1 when v_number <= 24 then 2 else 3 end;
  v_column := case when v_number = 0 then 0 when v_number % 3 = 1 then 1 when v_number % 3 = 2 then 2 else 3 end;

  update public.game_rounds
  set phase = 'settled',
      settled_at = now(),
      result = jsonb_build_object('number', v_number, 'color', v_color)
  where id = p_round_id;

  for v_bet in select * from public.roulette_bets where round_id = p_round_id loop
    v_win := false;
    v_multiplier := 0;
    case v_bet.bet_type
      when 'straight' then
        if v_bet.bet_value::int = v_number then v_win := true; v_multiplier := 35; end if;
      when 'red' then
        if v_color = 'red' then v_win := true; v_multiplier := 1; end if;
      when 'black' then
        if v_color = 'black' then v_win := true; v_multiplier := 1; end if;
      when 'odd' then
        if v_number <> 0 and not v_is_even then v_win := true; v_multiplier := 1; end if;
      when 'even' then
        if v_is_even then v_win := true; v_multiplier := 1; end if;
      when 'low' then
        if v_number between 1 and 18 then v_win := true; v_multiplier := 1; end if;
      when 'high' then
        if v_number between 19 and 36 then v_win := true; v_multiplier := 1; end if;
      when 'dozen' then
        if v_dozen <> 0 and v_bet.bet_value::int = v_dozen then v_win := true; v_multiplier := 2; end if;
      when 'column' then
        if v_column <> 0 and v_bet.bet_value::int = v_column then v_win := true; v_multiplier := 2; end if;
      else
        v_win := false;
    end case;

    v_payout := case when v_win then v_bet.amount + (v_bet.amount * v_multiplier)::bigint else 0 end;
    update public.roulette_bets set payout = v_payout where id = v_bet.id;

    select * into v_profile from public.profiles where id = v_bet.user_id for update;
    v_new_balance := v_profile.virtual_balance + v_payout;

    update public.profiles
    set virtual_balance = v_new_balance,
        games_played = games_played + 1,
        games_won = games_won + (case when v_win then 1 else 0 end),
        current_streak = case when v_win then current_streak + 1 else 0 end,
        best_streak = greatest(best_streak, case when v_win then current_streak + 1 else best_streak end)
    where id = v_bet.user_id;

    if v_payout > 0 then
      insert into public.wallet_transactions (user_id, amount, balance_after, reason, round_id)
      values (v_bet.user_id, v_payout, v_new_balance, 'payout', p_round_id);
    end if;
  end loop;

  select * into v_round from public.game_rounds where id = p_round_id;
  return v_round;
end;
$$;

revoke all on function public.fn_settle_roulette_round(uuid) from public;
grant execute on function public.fn_settle_roulette_round(uuid) to authenticated;
