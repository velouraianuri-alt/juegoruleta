-- fn_bj_hand_value: best blackjack total for a set of 2-char card codes (rank+suit,
-- rank in A,2-9,T,J,Q,K), treating aces as 11 and softening to 1 as needed. Internal
-- helper only — never granted to `authenticated`, called only from other
-- SECURITY DEFINER functions owned by the same role.
create or replace function public.fn_bj_hand_value(p_cards text[])
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_total int := 0;
  v_aces int := 0;
  v_card text;
  v_rank text;
begin
  foreach v_card in array p_cards loop
    v_rank := left(v_card, length(v_card) - 1);
    if v_rank = 'A' then
      v_aces := v_aces + 1;
      v_total := v_total + 11;
    elsif v_rank in ('T', 'J', 'Q', 'K') then
      v_total := v_total + 10;
    else
      v_total := v_total + v_rank::int;
    end if;
  end loop;

  while v_total > 21 and v_aces > 0 loop
    v_total := v_total - 10;
    v_aces := v_aces - 1;
  end loop;

  return v_total;
end;
$$;

-- fn_bj_advance_turn: moves current_turn_hand_id to the next hand still 'playing'
-- (ordered by creation, so split hands play right after their parent), or flips the
-- round to 'dealer_turn' once nothing is left to act on.
create or replace function public.fn_bj_advance_turn(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next uuid;
begin
  select id into v_next from public.blackjack_hands
  where round_id = p_round_id and status = 'playing'
  order by created_at
  limit 1;

  if v_next is null then
    update public.game_rounds set phase = 'dealer_turn', current_turn_hand_id = null where id = p_round_id;
  else
    update public.game_rounds set current_turn_hand_id = v_next where id = p_round_id;
  end if;
end;
$$;

-- fn_start_blackjack_round: shuffles a fresh 6-deck shoe server-side and opens a 15s
-- betting window. The shoe lives in blackjack_secrets (no RLS policies, never
-- realtime-published) so it can never be read from the client.
create or replace function public.fn_start_blackjack_round(p_room_id uuid)
returns public.game_rounds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_round public.game_rounds;
  v_ranks constant text[] := array['A','2','3','4','5','6','7','8','9','T','J','Q','K'];
  v_suits constant text[] := array['S','H','D','C'];
  v_deck text[] := '{}';
  v_r text;
  v_s text;
  v_d int;
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

  for v_d in 1..6 loop
    foreach v_r in array v_ranks loop
      foreach v_s in array v_suits loop
        v_deck := v_deck || (v_r || v_s);
      end loop;
    end loop;
  end loop;
  v_deck := array(select unnest(v_deck) order by random());

  insert into public.game_rounds (room_id, game_type, phase, phase_ends_at, dealer_hand)
  values (p_room_id, 'blackjack', 'betting', now() + interval '15 seconds', '[]'::jsonb)
  returning * into v_round;

  insert into public.blackjack_secrets (round_id, shoe) values (v_round.id, v_deck);

  return v_round;
exception
  when unique_violation then
    raise exception 'A round is already in progress for this room';
end;
$$;

revoke all on function public.fn_start_blackjack_round(uuid) from public;
grant execute on function public.fn_start_blackjack_round(uuid) to authenticated;

-- fn_place_blackjack_bet: one hand per player per round at bet time (splits are
-- created later by fn_blackjack_split). Escrows the bet immediately.
create or replace function public.fn_place_blackjack_bet(p_round_id uuid, p_amount bigint)
returns public.blackjack_hands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_round public.game_rounds;
  v_profile public.profiles;
  v_hand public.blackjack_hands;
  v_new_balance bigint;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid bet amount';
  end if;

  select * into v_round from public.game_rounds where id = p_round_id for update;
  if v_round.id is null or v_round.game_type <> 'blackjack' then
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
  if exists (select 1 from public.blackjack_hands where round_id = p_round_id and user_id = v_uid) then
    raise exception 'Bet already placed for this round';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.virtual_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  v_new_balance := v_profile.virtual_balance - p_amount;
  update public.profiles set virtual_balance = v_new_balance where id = v_uid;
  insert into public.wallet_transactions (user_id, amount, balance_after, reason, round_id)
  values (v_uid, -p_amount, v_new_balance, 'bet', p_round_id);

  insert into public.blackjack_hands (round_id, user_id, bet_amount, cards, status)
  values (p_round_id, v_uid, p_amount, '[]'::jsonb, 'playing')
  returning * into v_hand;

  return v_hand;
end;
$$;

revoke all on function public.fn_place_blackjack_bet(uuid, bigint) from public;
grant execute on function public.fn_place_blackjack_bet(uuid, bigint) to authenticated;

-- fn_deal_blackjack: standard casino deal order (card 1 to each hand, card 1 to
-- dealer face-up, card 2 to each hand, card 2 to dealer face-down/hole).
create or replace function public.fn_deal_blackjack(p_round_id uuid)
returns public.game_rounds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round public.game_rounds;
  v_secrets public.blackjack_secrets;
  v_shoe text[];
  v_card text;
  v_hand record;
  v_first_unresolved uuid;
begin
  select * into v_round from public.game_rounds where id = p_round_id for update;
  if v_round.id is null or v_round.game_type <> 'blackjack' then
    raise exception 'Round not found';
  end if;
  if v_round.phase <> 'betting' then
    raise exception 'Round already dealt';
  end if;
  if v_round.phase_ends_at > now() then
    raise exception 'Betting window still open';
  end if;
  if not exists (select 1 from public.blackjack_hands where round_id = p_round_id) then
    raise exception 'No bets placed';
  end if;

  select * into v_secrets from public.blackjack_secrets where round_id = p_round_id for update;
  v_shoe := v_secrets.shoe;

  for v_hand in
    select id from public.blackjack_hands
    where round_id = p_round_id and parent_hand_id is null
    order by created_at
  loop
    v_card := v_shoe[1];
    v_shoe := v_shoe[2:];
    update public.blackjack_hands set cards = cards || to_jsonb(v_card) where id = v_hand.id;
  end loop;

  v_card := v_shoe[1];
  v_shoe := v_shoe[2:];
  update public.game_rounds set dealer_hand = jsonb_build_array(v_card) where id = p_round_id;

  for v_hand in
    select id from public.blackjack_hands
    where round_id = p_round_id and parent_hand_id is null
    order by created_at
  loop
    v_card := v_shoe[1];
    v_shoe := v_shoe[2:];
    update public.blackjack_hands set cards = cards || to_jsonb(v_card) where id = v_hand.id;
  end loop;

  v_card := v_shoe[1];
  v_shoe := v_shoe[2:];
  update public.blackjack_secrets set dealer_hole_card = v_card, shoe = v_shoe where round_id = p_round_id;

  update public.blackjack_hands
  set status = 'blackjack'
  where round_id = p_round_id
    and parent_hand_id is null
    and public.fn_bj_hand_value(array(select jsonb_array_elements_text(cards))) = 21;

  select id into v_first_unresolved from public.blackjack_hands
  where round_id = p_round_id and status = 'playing'
  order by created_at
  limit 1;

  if v_first_unresolved is null then
    update public.game_rounds set phase = 'dealer_turn', current_turn_hand_id = null where id = p_round_id;
  else
    update public.game_rounds set phase = 'player_turn', current_turn_hand_id = v_first_unresolved where id = p_round_id;
  end if;

  select * into v_round from public.game_rounds where id = p_round_id;
  return v_round;
end;
$$;

revoke all on function public.fn_deal_blackjack(uuid) from public;
grant execute on function public.fn_deal_blackjack(uuid) to authenticated;

-- fn_blackjack_hit
create or replace function public.fn_blackjack_hit(p_hand_id uuid)
returns public.blackjack_hands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hand public.blackjack_hands;
  v_round public.game_rounds;
  v_card text;
  v_value int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_hand from public.blackjack_hands where id = p_hand_id for update;
  if v_hand.id is null or v_hand.user_id <> v_uid then
    raise exception 'Hand not found';
  end if;
  if v_hand.status <> 'playing' then
    raise exception 'Hand is not playable';
  end if;

  select * into v_round from public.game_rounds where id = v_hand.round_id for update;
  if v_round.phase <> 'player_turn' or v_round.current_turn_hand_id <> p_hand_id then
    raise exception 'Not this hand''s turn';
  end if;

  select shoe[1] into v_card from public.blackjack_secrets where round_id = v_round.id;
  update public.blackjack_secrets set shoe = shoe[2:] where round_id = v_round.id;

  update public.blackjack_hands set cards = cards || to_jsonb(v_card) where id = p_hand_id
  returning * into v_hand;

  v_value := public.fn_bj_hand_value(array(select jsonb_array_elements_text(v_hand.cards)));

  if v_value > 21 then
    update public.blackjack_hands set status = 'bust' where id = p_hand_id returning * into v_hand;
    perform public.fn_bj_advance_turn(v_round.id);
  elsif v_value = 21 then
    update public.blackjack_hands set status = 'stood' where id = p_hand_id returning * into v_hand;
    perform public.fn_bj_advance_turn(v_round.id);
  end if;

  return v_hand;
end;
$$;

revoke all on function public.fn_blackjack_hit(uuid) from public;
grant execute on function public.fn_blackjack_hit(uuid) to authenticated;

-- fn_blackjack_stand
create or replace function public.fn_blackjack_stand(p_hand_id uuid)
returns public.blackjack_hands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hand public.blackjack_hands;
  v_round public.game_rounds;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_hand from public.blackjack_hands where id = p_hand_id for update;
  if v_hand.id is null or v_hand.user_id <> v_uid then
    raise exception 'Hand not found';
  end if;
  if v_hand.status <> 'playing' then
    raise exception 'Hand is not playable';
  end if;

  select * into v_round from public.game_rounds where id = v_hand.round_id for update;
  if v_round.phase <> 'player_turn' or v_round.current_turn_hand_id <> p_hand_id then
    raise exception 'Not this hand''s turn';
  end if;

  update public.blackjack_hands set status = 'stood' where id = p_hand_id returning * into v_hand;
  perform public.fn_bj_advance_turn(v_round.id);
  return v_hand;
end;
$$;

revoke all on function public.fn_blackjack_stand(uuid) from public;
grant execute on function public.fn_blackjack_stand(uuid) to authenticated;

-- fn_blackjack_double: duplicates the bet, deals exactly one more card, then
-- auto-resolves the hand (stood or bust) — per standard rules a double is a single
-- extra card, not an open-ended hit.
create or replace function public.fn_blackjack_double(p_hand_id uuid)
returns public.blackjack_hands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hand public.blackjack_hands;
  v_round public.game_rounds;
  v_profile public.profiles;
  v_card text;
  v_value int;
  v_new_balance bigint;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_hand from public.blackjack_hands where id = p_hand_id for update;
  if v_hand.id is null or v_hand.user_id <> v_uid then
    raise exception 'Hand not found';
  end if;
  if v_hand.status <> 'playing' then
    raise exception 'Hand is not playable';
  end if;
  if jsonb_array_length(v_hand.cards) <> 2 then
    raise exception 'Can only double on the first two cards';
  end if;

  select * into v_round from public.game_rounds where id = v_hand.round_id for update;
  if v_round.phase <> 'player_turn' or v_round.current_turn_hand_id <> p_hand_id then
    raise exception 'Not this hand''s turn';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.virtual_balance < v_hand.bet_amount then
    raise exception 'Insufficient balance to double';
  end if;

  v_new_balance := v_profile.virtual_balance - v_hand.bet_amount;
  update public.profiles set virtual_balance = v_new_balance where id = v_uid;
  insert into public.wallet_transactions (user_id, amount, balance_after, reason, round_id)
  values (v_uid, -v_hand.bet_amount, v_new_balance, 'bet', v_round.id);

  select shoe[1] into v_card from public.blackjack_secrets where round_id = v_round.id;
  update public.blackjack_secrets set shoe = shoe[2:] where round_id = v_round.id;

  update public.blackjack_hands
  set cards = cards || to_jsonb(v_card), bet_amount = bet_amount * 2, is_double = true
  where id = p_hand_id
  returning * into v_hand;

  v_value := public.fn_bj_hand_value(array(select jsonb_array_elements_text(v_hand.cards)));
  update public.blackjack_hands
  set status = case when v_value > 21 then 'bust' else 'stood' end
  where id = p_hand_id
  returning * into v_hand;

  perform public.fn_bj_advance_turn(v_round.id);
  return v_hand;
end;
$$;

revoke all on function public.fn_blackjack_double(uuid) from public;
grant execute on function public.fn_blackjack_double(uuid) to authenticated;

-- fn_blackjack_split: up to 2 splits (3 hands total). The original hand keeps its
-- first card and draws a replacement second card; the new hand gets the other
-- original card plus its own new card. Auto-stands a split hand that lands on 21
-- (no natural-blackjack bonus after a split, per common house rules).
create or replace function public.fn_blackjack_split(p_hand_id uuid)
returns public.blackjack_hands
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hand public.blackjack_hands;
  v_round public.game_rounds;
  v_profile public.profiles;
  v_new_balance bigint;
  v_card1 text;
  v_card2 text;
  v_card text;
  v_rank1 text;
  v_rank2 text;
  v_new_hand public.blackjack_hands;
  v_split_count int;
  v_val int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_hand from public.blackjack_hands where id = p_hand_id for update;
  if v_hand.id is null or v_hand.user_id <> v_uid then
    raise exception 'Hand not found';
  end if;
  if v_hand.status <> 'playing' then
    raise exception 'Hand is not playable';
  end if;
  if jsonb_array_length(v_hand.cards) <> 2 then
    raise exception 'Can only split on the first two cards';
  end if;

  select count(*) into v_split_count from public.blackjack_hands
  where round_id = v_hand.round_id and user_id = v_uid;
  if v_split_count >= 3 then
    raise exception 'Maximum of 3 hands (2 splits) reached';
  end if;

  v_card1 := v_hand.cards ->> 0;
  v_card2 := v_hand.cards ->> 1;
  v_rank1 := left(v_card1, length(v_card1) - 1);
  v_rank2 := left(v_card2, length(v_card2) - 1);
  if v_rank1 <> v_rank2 then
    raise exception 'Cards must match to split';
  end if;

  select * into v_round from public.game_rounds where id = v_hand.round_id for update;
  if v_round.phase <> 'player_turn' or v_round.current_turn_hand_id <> p_hand_id then
    raise exception 'Not this hand''s turn';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.virtual_balance < v_hand.bet_amount then
    raise exception 'Insufficient balance to split';
  end if;

  v_new_balance := v_profile.virtual_balance - v_hand.bet_amount;
  update public.profiles set virtual_balance = v_new_balance where id = v_uid;
  insert into public.wallet_transactions (user_id, amount, balance_after, reason, round_id)
  values (v_uid, -v_hand.bet_amount, v_new_balance, 'bet', v_round.id);

  update public.blackjack_hands set cards = jsonb_build_array(v_card1) where id = p_hand_id;

  insert into public.blackjack_hands (round_id, user_id, parent_hand_id, cards, bet_amount, status)
  values (v_round.id, v_uid, p_hand_id, jsonb_build_array(v_card2), v_hand.bet_amount, 'playing')
  returning * into v_new_hand;

  select shoe[1] into v_card from public.blackjack_secrets where round_id = v_round.id;
  update public.blackjack_secrets set shoe = shoe[2:] where round_id = v_round.id;
  update public.blackjack_hands set cards = cards || to_jsonb(v_card) where id = p_hand_id
  returning * into v_hand;

  select shoe[1] into v_card from public.blackjack_secrets where round_id = v_round.id;
  update public.blackjack_secrets set shoe = shoe[2:] where round_id = v_round.id;
  update public.blackjack_hands set cards = cards || to_jsonb(v_card) where id = v_new_hand.id
  returning * into v_new_hand;

  v_val := public.fn_bj_hand_value(array(select jsonb_array_elements_text(v_hand.cards)));
  if v_val = 21 then
    update public.blackjack_hands set status = 'stood' where id = p_hand_id returning * into v_hand;
    perform public.fn_bj_advance_turn(v_round.id);
  end if;

  return v_hand;
end;
$$;

revoke all on function public.fn_blackjack_split(uuid) from public;
grant execute on function public.fn_blackjack_split(uuid) to authenticated;

-- fn_resolve_blackjack_round: reveals the hole card, plays the dealer's hand
-- (stands on all 17+, per the spec), and settles every hand's payout — blackjack
-- pays 3:2, a normal win pays 2:1 (stake returned + even money), a push returns
-- the stake, a loss (including any bust) pays nothing.
create or replace function public.fn_resolve_blackjack_round(p_round_id uuid)
returns public.game_rounds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round public.game_rounds;
  v_secrets public.blackjack_secrets;
  v_shoe text[];
  v_dealer_cards text[];
  v_dealer_value int;
  v_dealer_blackjack boolean;
  v_card text;
  v_hand record;
  v_hand_value int;
  v_payout bigint;
  v_win boolean;
  v_push boolean;
  v_profile public.profiles;
  v_new_balance bigint;
begin
  select * into v_round from public.game_rounds where id = p_round_id for update;
  if v_round.id is null or v_round.game_type <> 'blackjack' then
    raise exception 'Round not found';
  end if;
  if v_round.phase <> 'dealer_turn' then
    raise exception 'Round is not ready to resolve';
  end if;

  select * into v_secrets from public.blackjack_secrets where round_id = p_round_id for update;
  v_shoe := v_secrets.shoe;
  v_dealer_cards := array(select jsonb_array_elements_text(v_round.dealer_hand)) || v_secrets.dealer_hole_card;
  update public.game_rounds set dealer_hand = to_jsonb(v_dealer_cards) where id = p_round_id;

  v_dealer_value := public.fn_bj_hand_value(v_dealer_cards);
  v_dealer_blackjack := (array_length(v_dealer_cards, 1) = 2 and v_dealer_value = 21);

  if exists (select 1 from public.blackjack_hands where round_id = p_round_id and status in ('stood', 'blackjack')) then
    while v_dealer_value < 17 loop
      v_card := v_shoe[1];
      v_shoe := v_shoe[2:];
      v_dealer_cards := v_dealer_cards || v_card;
      v_dealer_value := public.fn_bj_hand_value(v_dealer_cards);
      update public.game_rounds set dealer_hand = to_jsonb(v_dealer_cards) where id = p_round_id;
    end loop;
  end if;

  update public.blackjack_secrets set shoe = v_shoe where round_id = p_round_id;

  for v_hand in select * from public.blackjack_hands where round_id = p_round_id loop
    v_hand_value := public.fn_bj_hand_value(array(select jsonb_array_elements_text(v_hand.cards)));
    v_win := false;
    v_push := false;

    if v_hand.status = 'bust' then
      v_payout := 0;
    elsif v_hand.status = 'blackjack' and not v_dealer_blackjack then
      v_payout := v_hand.bet_amount + (v_hand.bet_amount * 3 / 2);
      v_win := true;
    elsif v_hand.status = 'blackjack' and v_dealer_blackjack then
      v_payout := v_hand.bet_amount;
      v_push := true;
    elsif v_dealer_value > 21 then
      v_payout := v_hand.bet_amount * 2;
      v_win := true;
    elsif v_hand_value > v_dealer_value then
      v_payout := v_hand.bet_amount * 2;
      v_win := true;
    elsif v_hand_value = v_dealer_value then
      v_payout := v_hand.bet_amount;
      v_push := true;
    else
      v_payout := 0;
    end if;

    update public.blackjack_hands set payout = v_payout where id = v_hand.id;

    select * into v_profile from public.profiles where id = v_hand.user_id for update;
    v_new_balance := v_profile.virtual_balance + v_payout;

    update public.profiles
    set virtual_balance = v_new_balance,
        games_played = games_played + 1,
        games_won = games_won + (case when v_win then 1 else 0 end),
        current_streak = case when v_win then current_streak + 1 when v_push then current_streak else 0 end,
        best_streak = greatest(best_streak, case when v_win then current_streak + 1 else best_streak end)
    where id = v_hand.user_id;

    if v_payout > 0 then
      insert into public.wallet_transactions (user_id, amount, balance_after, reason, round_id)
      values (v_hand.user_id, v_payout, v_new_balance, 'payout', p_round_id);
    end if;
  end loop;

  update public.game_rounds
  set phase = 'settled',
      settled_at = now(),
      result = jsonb_build_object('dealer_value', v_dealer_value, 'dealer_blackjack', v_dealer_blackjack)
  where id = p_round_id;

  select * into v_round from public.game_rounds where id = p_round_id;
  return v_round;
end;
$$;

revoke all on function public.fn_resolve_blackjack_round(uuid) from public;
grant execute on function public.fn_resolve_blackjack_round(uuid) to authenticated;
