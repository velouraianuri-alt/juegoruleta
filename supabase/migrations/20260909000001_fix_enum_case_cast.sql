-- A `case when ... then 'a' else 'b' end` expression with two untyped string
-- literals resolves to `text` by default; assigning that directly to an enum
-- column fails ("column is of type X but expression is of type text") since
-- Postgres only auto-coerces a *bare* literal assigned to a known column type,
-- not the result of a CASE expression. Found live: accepting a friend request
-- errored for every real user. Same pattern existed (untested) in
-- fn_blackjack_double. Fixed by casting the CASE result explicitly.

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
  set status = (case when p_accept then 'accepted' else 'declined' end)::public.friend_request_status,
      responded_at = now()
  where id = p_request_id
  returning * into v_row;

  return v_row;
end;
$$;

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
  set status = (case when v_value > 21 then 'bust' else 'stood' end)::public.blackjack_hand_status
  where id = p_hand_id
  returning * into v_hand;

  perform public.fn_bj_advance_turn(v_round.id);
  return v_hand;
end;
$$;
