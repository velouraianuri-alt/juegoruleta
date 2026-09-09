-- Realtime's postgres_changes filter (round_id=eq.X) can't be evaluated on a DELETE
-- event under the default replica identity, because Postgres only puts the primary
-- key in the WAL's "old" row then — round_id (the filtered column) is simply absent,
-- so Realtime silently drops the event instead of delivering it. Found live: cancelling
-- a bet (fn_cancel_roulette_bet / fn_clear_roulette_bets) correctly deleted the row and
-- refunded the stake, but every client's local bet list never heard about the delete.
-- FULL identity puts the whole old row in the WAL, so the filter has round_id to match.
alter table public.roulette_bets replica identity full;
