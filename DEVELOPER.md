# Developer notes

## Run

```bash
cp env.example .env.local
npm install
npm run dev
```

The game is Vite + TypeScript + Canvas. Core logic: `src/game/engine.ts`, drawing: `src/game/render.ts`, mobile joystick: `src/joystick.ts`. Auth and stats: `src/lib/account.ts`.

## Supabase

1. Create a project and enable the **Google** provider (`Authentication → Providers`).
2. Redirect URL: `http://localhost:3177` and the production origin.
3. Fill `.env.local` (and Vercel) with `SUPABASE_URL`, `SUPABASE_ANON_KEY`. For local migrations, `SUPABASE_DB_PASSWORD` (Database password, not the anon key). Do not put the DB password or service role on Vercel.
4. `npm run db:migrate` — the agent runs this after new `supabase/migrations/*.sql` files.

Tables `player_profiles` and `player_play_days` use RLS deny; the client goes through `ensure_player`, `set_player_name`, `start_player_run`, `finish_player_run`, `player_leaderboard`.

## Versioning and commits

For shippable changes, bump `package.json`, `README.md`, and `CHANGELOG.md` first. Commit message:

```
Short description. vX.Y.Z
```

Before commit: `npm run typecheck` and `npm run build`.

The git author email must be valid (not `hostname.local`), or Vercel blocks the deploy. Set it locally (not via `git config` in chat):

```
git config --global user.email "nezinams.imeginajums@gmail.com"
git config --global user.name "Sandris Ozols-Ozoliņš"
```

## GitHub security checks

On every push: **Secret scan** (Gitleaks), **Security audit** (`npm run audit:check`), **Security smoke** (typecheck, build, RLS, no service role in the client, `vercel.json` headers).
