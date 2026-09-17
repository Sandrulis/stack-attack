-- Persist a heart caught during a run, capped at 5.

create or replace function public.gain_player_life()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  play_day date := (timezone('utc', now()))::date;
  cap integer := 5;
  cur integer;
  nxt timestamptz;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  perform public.apply_player_life_regen(uid);

  select lives, next_life_at into cur, nxt
  from public.player_profiles
  where user_id = uid
  for update;

  if cur is null then
    raise exception 'no profile';
  end if;

  if cur < cap then
    cur := cur + 1;
    if cur >= cap then
      nxt := null;
    end if;
    update public.player_profiles
    set lives = cur,
        next_life_at = nxt,
        updated_at = now()
    where user_id = uid;
  end if;

  return public.player_stats_json(uid, play_day);
end;
$$;

revoke all on function public.gain_player_life() from public, anon;
grant execute on function public.gain_player_life() to authenticated;
