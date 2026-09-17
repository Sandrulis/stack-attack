# BoxDrop

**Current version:** `0.1.18`

**BoxDrop** is a 2D warehouse game in the browser. Slogan: *Push. Stack. Survive.* Push crates, dodge drops from overhead cranes, and clear a full bottom row for +1.

## Run

```bash
cp env.example .env.local
npm install
npm run dev
```

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env.local` (same names on Vercel Environment Variables). Open [http://localhost:3177](http://localhost:3177).

Sign in with Google before you play. After login, username and play counts are in **Settings** (gear under the mute button). **Scores** opens the top 20 (All or your country): 1st gold, 2nd silver, 3rd bronze.

## Controls

| Input | Action |
|---|---|
| `←` `→` | Walk and push a crate (desktop) |
| `←`/`→` + `Space` | Jump forward, onto a crate, or off it (desktop) |
| Joystick | Walk and push left or right (phone) |
| **Jump** | Hop in place; with the joystick, jump forward (phone) |
| `Esc` / **Pause** | Pause |
| Mute | Toggle sound (under the crane count) |
| Gear | Settings: today's/total plays and username |

## Rules

- Cranes travel the full rail (with several, in both directions) and drop crates at random. If a column is blocked, the crane patrols until it can drop; after a drop the empty crane leaves twice as fast.
- The playfield is **6×10**; only a crane uses a seventh row.
- Crates fall until they hit the floor or another crate. Only one crate may fall in a column at a time - the next starts after it lands.
- A falling crate can crush you - then the game is over.
- When the bottom row is full it clears at once, play continues, crates above fall one at a time per column, and you score **+1**.
- Score brings up to **4 cranes**, and drops get faster.
- White puffy clouds sometimes drift behind the windows. After long gaps a storm can bring darkness and rain.
- Beat your own record and the windows stay on a red sunset (sun half below the sill) until the run ends.
- Beat the global high score and the windows stay night with fireworks.
- Scores list a country under each name (from IP). A banner plane sometimes flies past with the leader name and score.

## Commands

```bash
npm run typecheck
npm run build
npm run db:migrate
npm run audit:check
```
