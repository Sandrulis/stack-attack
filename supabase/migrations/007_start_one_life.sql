-- New players start with one heart (one continue, then wait).

alter table public.player_profiles
  alter column lives set default 1;

update public.player_profiles
set lives = 1,
    next_life_at = now() + interval '24 hours'
where lives = 3;
