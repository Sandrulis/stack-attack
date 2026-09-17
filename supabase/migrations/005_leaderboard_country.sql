-- Country-filtered high scores: All vs the viewer's country.

drop function if exists public.player_leaderboard();

create or replace function public.player_leaderboard(p_country text default null)
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
        'user_id', user_id,
        'country', nullif(country, '')
      )
      order by best_score desc, total_plays desc, updated_at asc
    ),
    '[]'::jsonb
  )
  from (
    select display_name, best_score, total_plays, updated_at, user_id, country
    from public.player_profiles
    where name_set
      and (
        coalesce(btrim(p_country), '') = ''
        or lower(country) = lower(btrim(p_country))
      )
    order by best_score desc, total_plays desc, updated_at asc
    limit 20
  ) ranked;
$$;

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
    'name_set', p.name_set,
    'country', nullif(p.country, '')
  )
  from public.player_profiles p
  left join public.player_play_days d
    on d.user_id = p.user_id and d.play_date = play_day
  where p.user_id = uid;
$$;

grant execute on function public.player_leaderboard(text) to anon, authenticated;
