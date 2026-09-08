-- fn_claim_free_chips: cooldown-gated free-chip top-up so nobody gets stuck at 0.
create or replace function public.fn_claim_free_chips()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_cooldown constant interval := interval '4 hours';
  v_amount constant bigint := 5000;
  v_new_balance bigint;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  if v_profile.last_free_chips_at is not null and v_profile.last_free_chips_at + v_cooldown > now() then
    raise exception 'free_chips_on_cooldown:%', to_char(v_profile.last_free_chips_at + v_cooldown, 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  v_new_balance := v_profile.virtual_balance + v_amount;

  update public.profiles
  set virtual_balance = v_new_balance, last_free_chips_at = now()
  where id = v_uid;

  insert into public.wallet_transactions (user_id, amount, balance_after, reason)
  values (v_uid, v_amount, v_new_balance, 'free_chips');

  select * into v_profile from public.profiles where id = v_uid;
  return v_profile;
end;
$$;

revoke all on function public.fn_claim_free_chips() from public;
grant execute on function public.fn_claim_free_chips() to authenticated;

-- fn_update_profile: the only client-facing way to change non-financial profile
-- fields. Balance/stat columns are never touched here, so there is no path from the
-- client to those columns at all — only game-settlement RPCs write them.
create or replace function public.fn_update_profile(p_username text, p_avatar_url text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_username is null or p_username !~ '^[a-zA-Z0-9_]{3,20}$' then
    raise exception 'Invalid username format';
  end if;

  update public.profiles
  set username = p_username, avatar_url = p_avatar_url
  where id = v_uid
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.fn_update_profile(text, text) from public;
grant execute on function public.fn_update_profile(text, text) to authenticated;

-- fn_username_available: lets the signup form check availability before calling
-- supabase.auth.signUp, so a taken username surfaces as a friendly form error
-- instead of a failed profile insert from the auth trigger.
create or replace function public.fn_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(p_username)
  );
$$;

revoke all on function public.fn_username_available(text) from public;
grant execute on function public.fn_username_available(text) to anon, authenticated;

-- fn_get_email_for_username: lets the login form accept a username (not just an
-- email) by resolving it to the auth email server-side, then the client calls
-- signInWithPassword with that email as normal. Granted to `anon` since this runs
-- before the user is authenticated. Only ever returns an email for an *existing*
-- username — same information disclosure inherent to any "log in with username"
-- feature, acceptable for a private, invite-only app like this one.
create or replace function public.fn_get_email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.fn_get_email_for_username(text) from public;
grant execute on function public.fn_get_email_for_username(text) to anon, authenticated;
