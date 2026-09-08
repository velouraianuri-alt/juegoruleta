-- fn_resolve_blackjack_round previously wrote `dealer_hand` to game_rounds once per
-- card drawn (hole-card reveal, then once per card in the draw-to-17 loop) — several
-- separate UPDATEs to the same row inside one transaction. Realtime's Postgres
-- Changes delivery does not reliably relay every intermediate row version in that
-- case (observed live: a 5-card final dealer hand arrived at the client as just the
-- first 1-2 cards), so clients displayed a stale/incomplete dealer hand while the
-- correct final value was already committed. Fix: compute the whole dealer sequence
-- in a local variable and write game_rounds exactly once, in the same final UPDATE
-- that already sets phase/result — one row version, one realtime event, no race.
-- The card-by-card reveal animation now happens purely client-side (PlayingCard's
-- existing per-index stagger delay) once the final array arrives.
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

  v_dealer_value := public.fn_bj_hand_value(v_dealer_cards);
  v_dealer_blackjack := (array_length(v_dealer_cards, 1) = 2 and v_dealer_value = 21);

  if exists (select 1 from public.blackjack_hands where round_id = p_round_id and status in ('stood', 'blackjack')) then
    while v_dealer_value < 17 loop
      v_card := v_shoe[1];
      v_shoe := v_shoe[2:];
      v_dealer_cards := v_dealer_cards || v_card;
      v_dealer_value := public.fn_bj_hand_value(v_dealer_cards);
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
      dealer_hand = to_jsonb(v_dealer_cards),
      result = jsonb_build_object('dealer_value', v_dealer_value, 'dealer_blackjack', v_dealer_blackjack)
  where id = p_round_id;

  select * into v_round from public.game_rounds where id = p_round_id;
  return v_round;
end;
$$;
