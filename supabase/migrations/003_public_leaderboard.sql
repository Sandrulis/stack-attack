-- Let anyone view the public high-score list (names and scores only).

grant execute on function public.player_leaderboard() to anon, authenticated;
