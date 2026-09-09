-- Adds split (2-number) and corner (4-number) bets — a real European table lets
-- you bet on the line between adjacent numbers, not just a single number
-- straight-up or the wide outside bets. Grid topology: number n sits at
-- column = ((n-1)/3)+1, position-within-column = ((n-1)%3)+1 (1=bottom row,
-- 3=top row) — i.e. n = (column-1)*3 + position. Two numbers are split-adjacent
-- if they share a column (positions differ by 1) or share a position (columns
-- differ by 1); a corner is the 4 numbers at the intersection of two adjacent
-- columns and two adjacent positions.

alter table public.roulette_bets drop constraint roulette_bets_bet_type_check;
alter table public.roulette_bets add constraint roulette_bets_bet_type_check
  check (bet_type in (
    'straight', 'split', 'corner', 'red', 'black', 'odd', 'even', 'low', 'high', 'dozen', 'column'
  ));

create or replace function public.fn_valid_roulette_split(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[];
  a int;
  b int;
  cola int;
  posa int;
  colb int;
  posb int;
begin
  if p_value is null then return false; end if;
  parts := string_to_array(p_value, ',');
  if array_length(parts, 1) <> 2 then return false; end if;
  if parts[1] !~ '^\d+$' or parts[2] !~ '^\d+$' then return false; end if;
  a := parts[1]::int;
  b := parts[2]::int;
  if a < 1 or a > 36 or b < 1 or b > 36 or a >= b then return false; end if;

  cola := ((a - 1) / 3) + 1;
  posa := ((a - 1) % 3) + 1;
  colb := ((b - 1) / 3) + 1;
  posb := ((b - 1) % 3) + 1;

  return (cola = colb and abs(posa - posb) = 1) or (posa = posb and abs(cola - colb) = 1);
end;
$$;

revoke all on function public.fn_valid_roulette_split(text) from public;
revoke all on function public.fn_valid_roulette_split(text) from anon;

create or replace function public.fn_valid_roulette_corner(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[];
  part text;
  nums int[] := array[]::int[];
  n int;
  cols int[] := array[]::int[];
  poss int[] := array[]::int[];
  distinct_cols int[];
  distinct_poss int[];
  c0 int;
  c1 int;
  p0 int;
  p1 int;
begin
  if p_value is null then return false; end if;
  parts := string_to_array(p_value, ',');
  if array_length(parts, 1) <> 4 then return false; end if;

  foreach part in array parts loop
    if part !~ '^\d+$' then return false; end if;
    n := part::int;
    if n < 1 or n > 36 then return false; end if;
    nums := nums || n;
    cols := cols || (((n - 1) / 3) + 1);
    poss := poss || (((n - 1) % 3) + 1);
  end loop;

  if (select count(distinct x) from unnest(nums) x) <> 4 then return false; end if;

  select array_agg(distinct x order by x) into distinct_cols from unnest(cols) x;
  select array_agg(distinct x order by x) into distinct_poss from unnest(poss) x;

  if array_length(distinct_cols, 1) <> 2 or array_length(distinct_poss, 1) <> 2 then
    return false;
  end if;
  if distinct_cols[2] - distinct_cols[1] <> 1 then return false; end if;
  if distinct_poss[2] - distinct_poss[1] <> 1 then return false; end if;

  c0 := distinct_cols[1];
  c1 := distinct_cols[2];
  p0 := distinct_poss[1];
  p1 := distinct_poss[2];

  return (
    ((c0 - 1) * 3 + p0) = any(nums)
    and ((c0 - 1) * 3 + p1) = any(nums)
    and ((c1 - 1) * 3 + p0) = any(nums)
    and ((c1 - 1) * 3 + p1) = any(nums)
  );
end;
$$;

revoke all on function public.fn_valid_roulette_corner(text) from public;
revoke all on function public.fn_valid_roulette_corner(text) from anon;

-- fn_place_roulette_bet: same as before, plus split/corner shape validation.
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
  if p_bet_type = 'split' and not public.fn_valid_roulette_split(p_bet_value) then
    raise exception 'Invalid split';
  end if;
  if p_bet_type = 'corner' and not public.fn_valid_roulette_corner(p_bet_value) then
    raise exception 'Invalid corner';
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
revoke all on function public.fn_place_roulette_bet(uuid, text, text, bigint) from anon;
grant execute on function public.fn_place_roulette_bet(uuid, text, text, bigint) to authenticated;

-- fn_settle_roulette_round: same as before, plus split (17:1) / corner (8:1) payouts.
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
      when 'split' then
        if v_number::text = any(string_to_array(v_bet.bet_value, ',')) then v_win := true; v_multiplier := 17; end if;
      when 'corner' then
        if v_number::text = any(string_to_array(v_bet.bet_value, ',')) then v_win := true; v_multiplier := 8; end if;
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
revoke all on function public.fn_settle_roulette_round(uuid) from anon;
grant execute on function public.fn_settle_roulette_round(uuid) to authenticated;
