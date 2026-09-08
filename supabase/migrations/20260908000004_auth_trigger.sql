-- Auto-creates a profile (with the starting 10,000-chip balance) whenever a new
-- auth.users row is created. Username comes from signup metadata; the client is
-- responsible for checking availability before calling supabase.auth.signUp so the
-- error surfaces at the form, not as a failed insert here.
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
  v_starting_balance constant bigint := 10000;
begin
  v_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    'jugador_' || substr(new.id::text, 1, 8)
  );

  insert into public.profiles (id, username, avatar_url, virtual_balance)
  values (new.id, v_username, new.raw_user_meta_data->>'avatar_url', v_starting_balance);

  insert into public.wallet_transactions (user_id, amount, balance_after, reason)
  values (new.id, v_starting_balance, v_starting_balance, 'initial');

  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();
