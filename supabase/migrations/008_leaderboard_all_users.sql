-- Show every player on the board, including 0-score. Ties: newest account first, then name.

alter table public.player_profiles
  add column if not exists created_at timestamptz;

update public.player_profiles p
set created_at = coalesce(
  (select u.created_at from auth.users u where u.id = p.user_id),
  p.updated_at,
  now()
)
where p.created_at is null;

alter table public.player_profiles
  alter column created_at set default now();

alter table public.player_profiles
  alter column created_at set not null;

create index if not exists player_profiles_leaderboard_idx
  on public.player_profiles (best_score desc, created_at desc, lower(display_name));

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
      order by best_score desc, created_at desc, lower(display_name) asc, display_name asc
    ),
    '[]'::jsonb
  )
  from (
    select display_name, best_score, total_plays, created_at, user_id, country
    from public.player_profiles
    where
      coalesce(btrim(p_country), '') = ''
      or lower(country) = lower(btrim(p_country))
    order by best_score desc, created_at desc, lower(display_name) asc, display_name asc
  ) ranked;
$$;
