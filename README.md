# BoxDrop

**Current version:** `0.1.26`

**BoxDrop** is a 2D warehouse game in the browser. Slogan: *Push. Stack. Survive.* Push crates, dodge drops from overhead cranes, and clear a full bottom row for +1.

## Run

```bash
cp env.example .env.local
npm install
npm run dev
```

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env.local` (same names on Vercel Environment Variables). Open [http://localhost:3177](http://localhost:3177).

Sign in with Google before you play. After login, username and play counts are in **Settings**. On phones, cranes and Settings sit under Score and Best; **Scores** lists every player (All or your country), including 0: 1st gold, 2nd silver, 3rd bronze. Equal scores put the newest account first, then A-Z.

## Controls

| Input | Action |
|---|---|
| `←` `→` | Walk and push a crate (desktop) |
| `←`/`→` + `Space` | Jump forward, onto a crate, or off it (desktop) |
| Joystick | 3-position: left, center, right (phone) |
| **Jump** | Hop in place; with the joystick, jump forward (phone) |
| `Esc` / **Pause** | Pause |
| Mute | Toggle sound |
| Gear | Settings: today's/total plays and username |

## Rules

- Cranes travel the full rail (with several, in both directions) and drop crates at random from travel height. If a crate is already falling in that column, the crane patrols until it can drop; after a drop the empty crane leaves twice as fast.
- The playfield is **6×10**; only a crane uses a seventh row.
- Crates fall until they hit the floor or another crate. Two crates in one column may fall or drop at once only if at least one empty cell sits between them.
- A falling crate can crush you - then the game is over.
- When the bottom row is full it clears at once, play continues, crates above fall one at a time per column, and you score **+1**.
- Score brings up to **4 cranes**, and drops get faster.
- After sign-in, Score, Best, cranes, and three hearts appear (1 filled at the start). After a crush you can spend that heart once to continue; then you wait. The 12h countdown starts on sign-in, left of the hearts on desktop and under them on phones. **Use heart** stays off when none are left. A heart crane shows up on a random trip between 75 and 150, then the next window is 200 later (275-350, and so on). Stand under it to absorb +1; it bursts like a crate on the floor or on a crate.
- White puffy clouds sometimes drift behind the windows. After long gaps a storm can bring darkness and rain.
- Beat your own record and the windows stay on a red sunset (sun half below the sill) until the run ends. Restart keeps a beaten personal or global record before the new run.
- Beat the global high score and the windows stay night with fireworks.
- Scores list every player, including 0. Equal scores put the newest account first, then A-Z. A country sits under each name (from IP). A banner plane sometimes flies past with the leader name and score.

## Commands

```bash
npm run typecheck
npm run build
npm run db:migrate
npm run audit:check
```
