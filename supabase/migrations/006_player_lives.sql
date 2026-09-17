-- Hearts: 5 slots, start with 3, one regenerates every 24 hours.

alter table public.player_profiles
  add column if not exists lives integer not null default 3;

alter table public.player_profiles
  add column if not exists next_life_at timestamptz;

alter table public.player_profiles
  drop constraint if exists player_profiles_lives_check;

alter table public.player_profiles
  add constraint player_profiles_lives_check check (lives >= 0 and lives <= 5);

create or replace function public.apply_player_life_regen(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cap integer := 5;
  wait interval := interval '24 hours';
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

create or replace function public.player_stats_json(uid uuid, play_day date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.apply_player_life_regen(uid);
  select jsonb_build_object(
    'best_score', p.best_score,
    'total_plays', p.total_plays,
    'today_plays', coalesce(d.plays, 0),
    'global_best', coalesce((select max(best_score) from public.player_profiles), 0),
    'display_name', p.display_name,
    'name_set', p.name_set,
    'country', nullif(p.country, ''),
    'lives', p.lives,
    'next_life_at', p.next_life_at
  )
  into result
  from public.player_profiles p
  left join public.player_play_days d
    on d.user_id = p.user_id and d.play_date = play_day
  where p.user_id = uid;
  return result;
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
    nxt := now() + interval '24 hours';
  end if;

  update public.player_profiles
  set lives = cur,
      next_life_at = nxt,
      updated_at = now()
  where user_id = uid;

  return public.player_stats_json(uid, play_day);
end;
$$;

revoke all on function public.apply_player_life_regen(uuid) from public, anon, authenticated;
revoke all on function public.spend_player_life() from public, anon;
grant execute on function public.spend_player_life() to authenticated;
