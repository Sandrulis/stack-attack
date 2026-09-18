-- Cap hearts at 3.

update public.player_profiles
set next_life_at = case when least(lives, 3) >= 3 then null else next_life_at end,
    lives = least(lives, 3)
where lives > 3;

alter table public.player_profiles
  drop constraint if exists player_profiles_lives_check;

alter table public.player_profiles
  add constraint player_profiles_lives_check check (lives >= 0 and lives <= 3);

create or replace function public.apply_player_life_regen(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cap integer := 3;
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

  if cur > cap then
    cur := cap;
    nxt := null;
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

create or replace function public.gain_player_life()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  play_day date := (timezone('utc', now()))::date;
  cap integer := 3;
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

revoke all on function public.apply_player_life_regen(uuid) from public, anon, authenticated;
revoke all on function public.gain_player_life() from public, anon;
grant execute on function public.gain_player_life() to authenticated;
