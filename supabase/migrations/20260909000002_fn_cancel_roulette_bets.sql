-- New wallet reason for refunds issued by cancelling a bet mid-window. Added in its
-- own statement (not used until a later transaction) to sidestep Postgres' rule
-- against using a brand-new enum value in the same transaction that adds it.
alter type public.wallet_reason add value if not exists 'bet_cancel';

-- fn_cancel_roulette_bet: refunds and deletes a single bet — backs "Deshacer"
-- (undo the caller's most recent bet). Only while the round the bet belongs to is
-- still genuinely in its betting window (server clock, mirrors fn_place_roulette_bet).
create or replace function public.fn_cancel_roulette_bet(p_bet_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_bet public.roulette_bets;
  v_round public.game_rounds;
  v_profile public.profiles;
  v_new_balance bigint;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_bet from public.roulette_bets where id = p_bet_id for update;
  if v_bet.id is null then
    raise exception 'Bet not found';
  end if;
  if v_bet.user_id <> v_uid then
    raise exception 'Not your bet';
  end if;

  select * into v_round from public.game_rounds where id = v_bet.round_id for update;
  if v_round.id is null or v_round.phase <> 'betting' or v_round.phase_ends_at < now() then
    raise exception 'Betting window is closed';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  v_new_balance := v_profile.virtual_balance + v_bet.amount;
  update public.profiles set virtual_balance = v_new_balance where id = v_uid;

  insert into public.wallet_transactions (user_id, amount, balance_after, reason, round_id)
  values (v_uid, v_bet.amount, v_new_balance, 'bet_cancel', v_bet.round_id);

  delete from public.roulette_bets where id = p_bet_id;
end;
$$;

revoke all on function public.fn_cancel_roulette_bet(uuid) from public;
revoke all on function public.fn_cancel_roulette_bet(uuid) from anon;
grant execute on function public.fn_cancel_roulette_bet(uuid) to authenticated;

-- fn_clear_roulette_bets: refunds and deletes every one of the caller's bets on a
-- round in one atomic call — backs "Limpiar", so clearing the table is one request
-- instead of one fn_cancel_roulette_bet per bet (and can't leave a partial state if
-- the client drops mid-loop).
create or replace function public.fn_clear_roulette_bets(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_round public.game_rounds;
  v_profile public.profiles;
  v_total bigint;
  v_new_balance bigint;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_round from public.game_rounds where id = p_round_id for update;
  if v_round.id is null or v_round.phase <> 'betting' or v_round.phase_ends_at < now() then
    raise exception 'Betting window is closed';
  end if;

  select coalesce(sum(amount), 0) into v_total
  from public.roulette_bets
  where round_id = p_round_id and user_id = v_uid;

  if v_total = 0 then
    return;
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  v_new_balance := v_profile.virtual_balance + v_total;
  update public.profiles set virtual_balance = v_new_balance where id = v_uid;

  insert into public.wallet_transactions (user_id, amount, balance_after, reason, round_id)
  values (v_uid, v_total, v_new_balance, 'bet_cancel', p_round_id);

  delete from public.roulette_bets where round_id = p_round_id and user_id = v_uid;
end;
$$;

revoke all on function public.fn_clear_roulette_bets(uuid) from public;
revoke all on function public.fn_clear_roulette_bets(uuid) from anon;
grant execute on function public.fn_clear_roulette_bets(uuid) to authenticated;
