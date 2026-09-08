-- Extensions
create extension if not exists pgcrypto with schema extensions;

-- Enums
create type public.friend_request_status as enum ('pending', 'accepted', 'declined');
create type public.room_status as enum ('waiting', 'playing', 'closed');
create type public.room_player_status as enum ('joined', 'left');
create type public.game_type as enum ('roulette', 'blackjack');
create type public.round_phase as enum (
  'betting',
  'player_turn',
  'dealer_turn',
  'settled',
  'cancelled'
);
create type public.blackjack_hand_status as enum (
  'playing',
  'stood',
  'bust',
  'blackjack'
);
create type public.wallet_reason as enum ('initial', 'bet', 'payout', 'free_chips');
