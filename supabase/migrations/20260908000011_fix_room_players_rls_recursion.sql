-- room_players_select_member policy did `exists (select 1 from room_players rp2
-- where ...)` — a policy on room_players querying room_players itself, which
-- Postgres detects as infinite recursion (error 42P17) the moment any query
-- touches room_players. Every other "is this user in this room" policy
-- (rooms, room_messages, game_rounds, roulette_bets, blackjack_hands) hits the
-- same recursion indirectly, since they all subquery room_players too.
--
-- Fix: a SECURITY DEFINER helper function. Called from within an RLS policy, its
-- own internal query runs as the function owner, which bypasses RLS entirely
-- (owners aren't subject to RLS unless FORCE ROW LEVEL SECURITY is set) — so it
-- breaks the self-reference instead of re-triggering the policy.
create or replace function public.fn_is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = auth.uid() and status = 'joined'
  );
$$;

revoke all on function public.fn_is_room_member(uuid) from anon, public;
grant execute on function public.fn_is_room_member(uuid) to authenticated;

drop policy rooms_select_member on public.rooms;
create policy rooms_select_member on public.rooms
  for select to authenticated
  using (owner_id = auth.uid() or public.fn_is_room_member(id));

drop policy room_players_select_member on public.room_players;
create policy room_players_select_member on public.room_players
  for select to authenticated
  using (public.fn_is_room_member(room_id));

drop policy room_messages_select_member on public.room_messages;
create policy room_messages_select_member on public.room_messages
  for select to authenticated
  using (public.fn_is_room_member(room_id));

drop policy room_messages_insert_member on public.room_messages;
create policy room_messages_insert_member on public.room_messages
  for insert to authenticated
  with check (user_id = auth.uid() and public.fn_is_room_member(room_id));

drop policy game_rounds_select_member on public.game_rounds;
create policy game_rounds_select_member on public.game_rounds
  for select to authenticated
  using (public.fn_is_room_member(room_id));

drop policy roulette_bets_select_member on public.roulette_bets;
create policy roulette_bets_select_member on public.roulette_bets
  for select to authenticated
  using (
    exists (
      select 1 from public.game_rounds gr
      where gr.id = roulette_bets.round_id and public.fn_is_room_member(gr.room_id)
    )
  );

drop policy blackjack_hands_select_member on public.blackjack_hands;
create policy blackjack_hands_select_member on public.blackjack_hands
  for select to authenticated
  using (
    exists (
      select 1 from public.game_rounds gr
      where gr.id = blackjack_hands.round_id and public.fn_is_room_member(gr.room_id)
    )
  );
