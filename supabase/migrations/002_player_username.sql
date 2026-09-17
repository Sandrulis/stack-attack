-- Username prompt: keep a chosen display name, do not overwrite it from Google.

alter table public.player_profiles
  add column if not exists name_set boolean not null default false;

update public.player_profiles
set name_set = true
where total_plays > 0 and name_set = false;

create or replace function public.player_stats_json(uid uuid, play_day date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'best_score', p.best_score,
    'total_plays', p.total_plays,
    'today_plays', coalesce(d.plays, 0),
    'global_best', coalesce((select max(best_score) from public.player_profiles), 0),
    'display_name', p.display_name,
    'name_set', p.name_set
  )
  from public.player_profiles p
  left join public.player_play_days d
    on d.user_id = p.user_id and d.play_date = play_day
  where p.user_id = uid;
$$;

create or replace function public.ensure_player(p_name text, p_avatar text, p_day date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  play_day date := coalesce(p_day, (timezone('utc', now()))::date);
  name text := left(trim(coalesce(p_name, '')), 24);
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if name = '' then
    name := 'Player';
  end if;

  insert into public.player_profiles (user_id, display_name, avatar_url, name_set)
  values (uid, name, nullif(p_avatar, ''), false)
  on conflict (user_id) do update
    set avatar_url = coalesce(excluded.avatar_url, public.player_profiles.avatar_url),
        display_name = case
          when public.player_profiles.name_set then public.player_profiles.display_name
          else excluded.display_name
        end,
        updated_at = now();

  return public.player_stats_json(uid, play_day);
end;
$$;

create or replace function public.set_player_name(p_name text, p_day date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  play_day date := coalesce(p_day, (timezone('utc', now()))::date);
  name text := left(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 24);
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if char_length(name) < 2 then
    raise exception 'username too short';
  end if;

  update public.player_profiles
  set display_name = name,
      name_set = true,
      updated_at = now()
  where user_id = uid;

  if not found then
    raise exception 'profile missing';
  end if;

  return public.player_stats_json(uid, play_day);
end;
$$;

create or replace function public.start_player_run(p_name text, p_avatar text, p_day date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  play_day date := coalesce(p_day, (timezone('utc', now()))::date);
  ready boolean;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  select name_set into ready
  from public.player_profiles
  where user_id = uid;

  if ready is not true then
    raise exception 'username required';
  end if;

  update public.player_profiles
  set avatar_url = coalesce(nullif(p_avatar, ''), avatar_url),
      total_plays = total_plays + 1,
      updated_at = now()
  where user_id = uid;

  insert into public.player_play_days (user_id, play_date, plays)
  values (uid, play_day, 1)
  on conflict (user_id, play_date) do update
    set plays = public.player_play_days.plays + 1;

  return public.player_stats_json(uid, play_day);
end;
$$;

create or replace function public.finish_player_run(p_score integer, p_day date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  play_day date := coalesce(p_day, (timezone('utc', now()))::date);
  score integer := greatest(0, coalesce(p_score, 0));
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  update public.player_profiles
  set best_score = greatest(best_score, score),
      updated_at = now()
  where user_id = uid;

  return public.player_stats_json(uid, play_day);
end;
$$;

create or replace function public.player_leaderboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'display_name', display_name,
        'best_score', best_score,
        'total_plays', total_plays,
        'user_id', user_id
      )
      order by best_score desc, total_plays desc, updated_at asc
    ),
    '[]'::jsonb
  )
  from (
    select display_name, best_score, total_plays, updated_at, user_id
    from public.player_profiles
    where name_set
    order by best_score desc, total_plays desc, updated_at asc
    limit 20
  ) ranked;
$$;

revoke all on function public.player_stats_json(uuid, date) from public, anon, authenticated;
revoke all on function public.set_player_name(text, date) from public, anon;
grant execute on function public.set_player_name(text, date) to authenticated;
grant execute on function public.ensure_player(text, text, date) to authenticated;
grant execute on function public.start_player_run(text, text, date) to authenticated;
grant execute on function public.finish_player_run(integer, date) to authenticated;
grant execute on function public.player_leaderboard() to anon, authenticated;
