-- Heart refill wait is 12 hours.

create or replace function public.apply_player_life_regen(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cap integer := 5;
  wait interval := interval '12 hours';
  cur integer;
  nxt timestamptz;
begin
  select lives, next_life_at into cur, nxt
  from public.player_profiles
  where user_id = uid
  for update;

  if not found then
    return;
  end if;

  if cur < cap and nxt is null then
    nxt := now() + wait;
  end if;

  while cur < cap and nxt is not null and nxt <= now() loop
    cur := cur + 1;
    if cur >= cap then
      nxt := null;
    else
      nxt := nxt + wait;
    end if;
  end loop;

  update public.player_profiles
  set lives = cur,
      next_life_at = nxt
  where user_id = uid;
end;
$$;

create or replace function public.spend_player_life()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  play_day date := (timezone('utc', now()))::date;
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

  if cur is null or cur < 1 then
    raise exception 'no lives';
  end if;

  cur := cur - 1;
  if nxt is null then
    nxt := now() + interval '12 hours';
  end if;

  update public.player_profiles
  set lives = cur,
      next_life_at = nxt,
      updated_at = now()
  where user_id = uid;

  return public.player_stats_json(uid, play_day);
end;
$$;

update public.player_profiles
set next_life_at = now() + interval '12 hours'
where next_life_at is not null
  and next_life_at > now() + interval '12 hours';
