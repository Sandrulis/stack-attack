-- Store last IP (private) and country for the public leaderboard.

alter table public.player_profiles
  add column if not exists last_ip inet,
  add column if not exists country text not null default '',
  add column if not exists country_code text not null default '';

create or replace function public.set_player_geo(p_ip text, p_country text, p_country_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ip_addr inet;
  country_name text := left(trim(coalesce(p_country, '')), 56);
  code text := upper(left(regexp_replace(trim(coalesce(p_country_code, '')), '[^a-zA-Z]', '', 'g'), 2));
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  begin
    ip_addr := nullif(btrim(coalesce(p_ip, '')), '')::inet;
  exception when others then
    ip_addr := null;
  end;

  if ip_addr is null and country_name = '' and code = '' then
    return;
  end if;

  update public.player_profiles
  set last_ip = coalesce(ip_addr, last_ip),
      country = case when country_name = '' then country else country_name end,
      country_code = case when code = '' then country_code else code end
  where user_id = uid;
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
    order by best_score desc, total_plays desc, updated_at asc
    limit 20
  ) ranked;
$$;

revoke all on function public.set_player_geo(text, text, text) from public, anon;
grant execute on function public.set_player_geo(text, text, text) to authenticated;
grant execute on function public.player_leaderboard() to anon, authenticated;
