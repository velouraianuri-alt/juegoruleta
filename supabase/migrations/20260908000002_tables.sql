-- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  avatar_url text,
  virtual_balance bigint not null default 10000 check (virtual_balance >= 0),
  games_played integer not null default 0,
  games_won integer not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  last_free_chips_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username ~ '^[a-zA-Z0-9_]{3,20}$'
  )
);

-- friend_requests ("friends" = accepted rows, read from either direction)
create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  status public.friend_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_not_self check (sender_id <> receiver_id)
);

create unique index friend_requests_unique_pair_idx on public.friend_requests (
  least(sender_id, receiver_id),
  greatest(sender_id, receiver_id)
);
create index friend_requests_receiver_idx on public.friend_requests (receiver_id, status);
create index friend_requests_sender_idx on public.friend_requests (sender_id, status);

-- rooms
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  max_players integer not null default 6 check (max_players between 2 and 10),
  allowed_games public.game_type[] not null default array['roulette', 'blackjack']::public.game_type[],
  status public.room_status not null default 'waiting',
  created_at timestamptz not null default now()
);

-- room_players
create table public.room_players (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.room_player_status not null default 'joined',
  seat_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, user_id)
);
create index room_players_user_idx on public.room_players (user_id);

-- room_messages
create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);
create index room_messages_room_idx on public.room_messages (room_id, created_at);

-- game_rounds — one active (non settled/cancelled) round per room at a time.
-- `shoe` and `dealer_hole_card` are deliberately never exposed to clients (see column
-- grants in the RLS migration) so a blackjack shoe/hole card can never be read from the
-- browser network tab.
create table public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  game_type public.game_type not null,
  phase public.round_phase not null default 'betting',
  phase_ends_at timestamptz,
  current_turn_hand_id uuid,
  result jsonb,
  dealer_hand jsonb not null default '[]'::jsonb,
  dealer_hole_card text,
  shoe text[],
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index game_rounds_room_idx on public.game_rounds (room_id, created_at desc);
create unique index game_rounds_one_active_per_room_idx on public.game_rounds (room_id)
  where phase not in ('settled', 'cancelled');

-- roulette_bets
create table public.roulette_bets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  bet_type text not null check (
    bet_type in ('straight', 'red', 'black', 'odd', 'even', 'low', 'high', 'dozen', 'column')
  ),
  bet_value text,
  amount bigint not null check (amount > 0),
  payout bigint,
  created_at timestamptz not null default now()
);
create index roulette_bets_round_idx on public.roulette_bets (round_id);
create index roulette_bets_user_idx on public.roulette_bets (user_id);

-- blackjack_hands
create table public.blackjack_hands (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_hand_id uuid references public.blackjack_hands (id) on delete cascade,
  cards jsonb not null default '[]'::jsonb,
  bet_amount bigint not null check (bet_amount > 0),
  status public.blackjack_hand_status not null default 'playing',
  is_double boolean not null default false,
  payout bigint,
  created_at timestamptz not null default now()
);
create index blackjack_hands_round_idx on public.blackjack_hands (round_id);
create index blackjack_hands_user_idx on public.blackjack_hands (user_id);

alter table public.game_rounds
  add constraint game_rounds_current_turn_hand_fk
  foreign key (current_turn_hand_id) references public.blackjack_hands (id) on delete set null;

-- wallet_transactions — append-only ledger, source of truth for balance history.
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount bigint not null,
  balance_after bigint not null check (balance_after >= 0),
  reason public.wallet_reason not null,
  round_id uuid references public.game_rounds (id) on delete set null,
  created_at timestamptz not null default now()
);
create index wallet_transactions_user_idx on public.wallet_transactions (user_id, created_at desc);
