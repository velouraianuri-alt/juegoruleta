-- All financial/game-outcome mutations happen exclusively inside SECURITY DEFINER
-- RPCs (see later migrations). Client-facing RLS policies below are read-only
-- (SELECT) plus a couple of low-stakes direct writes (chat messages) that carry no
-- economic risk. No table grants INSERT/UPDATE/DELETE to `authenticated` directly.

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_messages enable row level security;
alter table public.game_rounds enable row level security;
alter table public.roulette_bets enable row level security;
alter table public.blackjack_hands enable row level security;
alter table public.wallet_transactions enable row level security;

-- profiles: readable by anyone authenticated (needed for search/leaderboard/friends).
create policy profiles_select_all on public.profiles
  for select to authenticated using (true);

-- friend_requests: only the two parties involved can see a request.
create policy friend_requests_select_own on public.friend_requests
  for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- rooms: only members (or the owner) can see a room's row.
create policy rooms_select_member on public.rooms
  for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.room_players rp
      where rp.room_id = rooms.id and rp.user_id = auth.uid()
    )
  );

-- room_players: visible to anyone who is also a player in that room.
create policy room_players_select_member on public.room_players
  for select to authenticated
  using (
    exists (
      select 1 from public.room_players rp2
      where rp2.room_id = room_players.room_id and rp2.user_id = auth.uid()
    )
  );

-- room_messages: readable by room members; sendable directly (no economic stakes).
create policy room_messages_select_member on public.room_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.room_players rp
      where rp.room_id = room_messages.room_id and rp.user_id = auth.uid() and rp.status = 'joined'
    )
  );

create policy room_messages_insert_member on public.room_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.room_players rp
      where rp.room_id = room_messages.room_id and rp.user_id = auth.uid() and rp.status = 'joined'
    )
  );

-- game_rounds / roulette_bets / blackjack_hands: readable by room members only.
create policy game_rounds_select_member on public.game_rounds
  for select to authenticated
  using (
    exists (
      select 1 from public.room_players rp
      where rp.room_id = game_rounds.room_id and rp.user_id = auth.uid()
    )
  );

create policy roulette_bets_select_member on public.roulette_bets
  for select to authenticated
  using (
    exists (
      select 1 from public.game_rounds gr
      join public.room_players rp on rp.room_id = gr.room_id
      where gr.id = roulette_bets.round_id and rp.user_id = auth.uid()
    )
  );

create policy blackjack_hands_select_member on public.blackjack_hands
  for select to authenticated
  using (
    exists (
      select 1 from public.game_rounds gr
      join public.room_players rp on rp.room_id = gr.room_id
      where gr.id = blackjack_hands.round_id and rp.user_id = auth.uid()
    )
  );

-- wallet_transactions: strictly private, own ledger only.
create policy wallet_transactions_select_own on public.wallet_transactions
  for select to authenticated
  using (user_id = auth.uid());

-- Column-level privileges: the blackjack shoe and the dealer's hidden hole card must
-- never be readable from the client (that would let a player predict/see the
-- outcome ahead of time). RPCs are SECURITY DEFINER and run as the table owner, so
-- they bypass these column grants and can read/write everything.
revoke select on public.game_rounds from authenticated;
grant select (
  id, room_id, game_type, phase, phase_ends_at, current_turn_hand_id,
  result, dealer_hand, created_at, settled_at
) on public.game_rounds to authenticated;

-- Realtime: broadcast row changes for everything a room needs to sync live.
alter publication supabase_realtime add table
  public.rooms,
  public.room_players,
  public.room_messages,
  public.game_rounds,
  public.roulette_bets,
  public.blackjack_hands,
  public.profiles;
