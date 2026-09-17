# Developer notes

## Palaist

```bash
cp env.example .env.local
npm install
npm run dev
```

Spēle ir Vite + TypeScript + Canvas. Galvenā loģika: `src/game/engine.ts`, zīmēšana: `src/game/render.ts`, mobilais džoistiks: `src/joystick.ts`. Auth un statistika: `src/lib/account.ts`.

## Supabase

1. Izveido projektu un ieslēdz **Google** provider (`Authentication → Providers`).
2. Redirect URL: `http://localhost:3177` un produkcijas origin.
3. `.env.local` (un Vercel) aizpildi: `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Migrācijām lokāli `SUPABASE_DB_PASSWORD` (Database password, ne anon key). Nepievieno Vercel DB paroli vai service role.
4. `npm run db:migrate` — es to palaižu pats pēc jauniem `supabase/migrations/*.sql`.

Tabulas `player_profiles` un `player_play_days` ir ar RLS deny; klients iet caur `ensure_player`, `set_player_name`, `start_player_run`, `finish_player_run`, `player_leaderboard`.

## Versijas un commit

Shippable izmaiņām vispirms bump `package.json`, `README.md` un `CHANGELOG.md`. Commit ziņojums:

```
Īss apraksts. vX.Y.Z
```

Pirms commit: `npm run typecheck` un `npm run build`.

Git author e-pastam jābūt derīgam (ne `datorvārds.local`), citādi Vercel bloķē deploy. Iestati to lokāli (ne čatā ar `git config` agentam):

```
git config --global user.email "nezinams.imeginajums@gmail.com"
git config --global user.name "Sandris Ozols-Ozoliņš"
```

## GitHub drošības pārbaudes

Katram push: **Secret scan** (Gitleaks), **Security audit** (`npm run audit:check`), **Security smoke** (typecheck, build, RLS, nav service role klientā, `vercel.json` galvenes).
