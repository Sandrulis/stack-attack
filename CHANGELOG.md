# Changelog

## v0.1.22

- After sign-in, one heart lets you continue once after a crush; the next heart takes 24 hours
- Score, Best, cranes, and hearts stay hidden until login; mute, Settings, Scores, and Pause stay on the right
- Scores lists every player, including 0; equal scores put the newest account first, then A-Z

## v0.1.21

- Cranes can drop into a column while a crate falls lower down, if at least one cell sits between them
- Restart saves a beaten personal or global record before the new run

## v0.1.20

- Phone joystick is a 3-position switch (left / center / right), so a light press no longer walks

## v0.1.19

- On phones, cranes sit under Score and Best, with Settings under the crane block

## v0.1.18

- Game title is BoxDrop; slogan is Push. Stack. Survive.
- All docs, rules, and UI copy are English only

## v0.1.17

- Only one crate falls in a column at a time; cranes and gravity wait until it lands

## v0.1.16

- Settings under the mute button: stats and username, so the start screen stays clean
- Scores with All / own-country filter; country under the name; banner plane in the windows with the leader
- Desktop HUD buttons, Score, and Best share the same height

## v0.1.15

- Mute icon waves and X stay to the right of the speaker, not on top of it

## v0.1.14

- Mobile HUD: Scores under Pause, mute under the crane count

## v0.1.13

- Vercel and local env: `SUPABASE_URL` and `SUPABASE_ANON_KEY` without a `VITE_` prefix

## v0.1.12

- Valid commit author email so Vercel does not block the deploy

## v0.1.11

- GitHub security checks: Gitleaks, npm audit (high+), and a smoke build with RLS/header checks
- Vercel security headers (`X-Frame-Options`, `nosniff`, Referrer-Policy, Permissions-Policy)

## v0.1.10

- Google sign-in, username, and saved records; Scores overlay with top 20 (gold, silver, bronze)
- A global record keeps night and fireworks in the windows; `npm run db:migrate` for Supabase SQL

## v0.1.9

- Playfield 6×10; only a crane uses a seventh row; if blocked, the crane patrols until it can drop
- Up to 4 cranes; occasional storms with rain; after a record the sunset stays with the sun half down

## v0.1.8

- On the top row, a jump can shove a crate sideways at the same height as a crane drop
- After a drop the empty crane leaves twice as fast

## v0.1.7

- White puffy clouds of mixed sizes sometimes drift behind the warehouse windows

## v0.1.6

- A full row clears smoothly without pausing cranes or the rest of the game
- Beating a record shows a red sunset behind the warehouse windows

## v0.1.5

- Mobile joystick 15% narrower so it covers less of the playfield

## v0.1.4

- Forward jump only with an arrow or the joystick; hop from crate to crate; falling crates can be pushed in the air
- Several cranes patrol the full screen both ways; iOS-style green joystick and Jump button
- English-only UI; Score/Best in the desktop header, no logo

## v0.1.3

- Worker in a navy hoodie with a boxy head and cap; jump onto a crate without hanging in the air
- A falling crate crushes from the head, not through the legs
- Same height when walking and idle; feet sit on crates with no gap

## v0.1.2

- Crates get a dark square rim and latch so stacked crates stay distinct
- Smooth crate falls without cell snapping
- On crush the worker flattens under the crate, with head and hands peeking out

## v0.1.1

- Smoother, slower walk and push, with the hand pressing against the crate
- Mobile HUD: score on the left, cranes on the right under Pause; up to 5 cranes
- Crates with no gaps, new latch design; joystick only left and right

## v0.1.0

- First playable version: cranes, crates, pushing, jumping, and bottom-row clears
- LCD warehouse look, sound, high score, and a touch keyboard

## Unreleased

- (none)
