-- Supabase grants EXECUTE directly to `anon` and `authenticated` by default for every
-- new function (not just to PUBLIC), so `revoke all on function ... from public` in the
-- earlier migrations did NOT actually remove anon's access — anon could still call
-- every RPC (harmlessly, since each one checks auth.uid() first and errors out, but
-- it's needless attack surface and exactly what Supabase's own security advisor flags
-- as lint 0028_anon_security_definer_function_executable). Revoking from `anon`
-- explicitly here closes that gap. `fn_username_available` and
-- `fn_get_email_for_username` are the deliberate exceptions (used pre-login).

revoke all on function public.fn_claim_free_chips() from anon;
revoke all on function public.fn_update_profile(text, text) from anon;
revoke all on function public.fn_send_friend_request(text) from anon;
revoke all on function public.fn_respond_friend_request(uuid, boolean) from anon;
revoke all on function public.fn_remove_friend(uuid) from anon;
revoke all on function public.fn_create_room(text, integer, public.game_type[]) from anon;
revoke all on function public.fn_join_room(text) from anon;
revoke all on function public.fn_leave_room(uuid) from anon;
revoke all on function public.fn_toggle_ready(uuid, boolean) from anon;
revoke all on function public.fn_start_game_session(uuid) from anon;
revoke all on function public.fn_end_game_session(uuid) from anon;
revoke all on function public.fn_send_room_message(uuid, text) from anon;
revoke all on function public.fn_start_roulette_round(uuid) from anon;
revoke all on function public.fn_place_roulette_bet(uuid, text, text, bigint) from anon;
revoke all on function public.fn_settle_roulette_round(uuid) from anon;
revoke all on function public.fn_start_blackjack_round(uuid) from anon;
revoke all on function public.fn_place_blackjack_bet(uuid, bigint) from anon;
revoke all on function public.fn_deal_blackjack(uuid) from anon;
revoke all on function public.fn_blackjack_hit(uuid) from anon;
revoke all on function public.fn_blackjack_stand(uuid) from anon;
revoke all on function public.fn_blackjack_double(uuid) from anon;
revoke all on function public.fn_blackjack_split(uuid) from anon;
revoke all on function public.fn_resolve_blackjack_round(uuid) from anon;

-- fn_handle_new_user is only ever meant to run via the auth.users trigger, never as a
-- direct client RPC call.
revoke all on function public.fn_handle_new_user() from anon, authenticated, public;

-- Internal helpers: never meant to be called directly by any client role, only from
-- other SECURITY DEFINER functions owned by the same role (which bypasses these
-- grants entirely, since object owners always retain their own privileges).
revoke all on function public.fn_bj_hand_value(text[]) from anon, authenticated, public;
revoke all on function public.fn_bj_advance_turn(uuid) from anon, authenticated, public;
