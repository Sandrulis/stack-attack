# Developer notes

## Palaist

```bash
npm install
npm run dev
```

Spēle ir Vite + TypeScript + Canvas. Galvenā loģika: `src/game/engine.ts`, zīmēšana: `src/game/render.ts`, mobilais džoistiks: `src/joystick.ts`.

## Versijas un commit

Shippable izmaiņām vispirms bump `package.json`, `README.md` un `CHANGELOG.md`. Commit ziņojums:

```
Īss apraksts. vX.Y.Z
```

Pirms commit: `npm run typecheck` un `npm run build`.
