import { sfx } from "../audio";
import {
  CANVAS_W,
  CELL,
  COLS,
  CRATE_FALL_MS,
  CRATE_SLIDE_MS,
  DEATH_MS,
  EXPLODE_MS,
  FALL_MS,
  HIGH_SCORE_KEY,
  CRANE_DROP_MS,
  JUMP_AIR_MS,
  JUMP_MS,
  MAX_CRANES,
  ORIGIN_X,
  PUSH_MS,
  ROWS,
  WALK_MS,
  craneThreshold,
} from "./constants";

export type Phase = "title" | "playing" | "paused" | "exploding" | "dead";
export type PlayerPose = "idle" | "walk" | "push" | "jump" | "fall" | "dead";
export type Dir = -1 | 1;

export type Crate = {
  id: number;
  col: number;
  row: number;
  fromCol: number;
  fromRow: number;
  animT: number;
  animDur: number;
  moving: boolean;
};

export type Crane = {
  x: number;
  carrying: boolean;
  dropCol: number;
  dropping: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
};

export type Popup = {
  col: number;
  row: number;
  text: string;
  life: number;
};

export type Player = {
  col: number;
  row: number;
  fromCol: number;
  fromRow: number;
  animT: number;
  animDur: number;
  moving: boolean;
  facing: Dir;
  pose: PlayerPose;
  walkFrame: number;
  walkHold: number;
  pushHold: number;
  jumpT: number;
};

export type GameState = {
  phase: Phase;
  player: Player;
  crates: Crate[];
  cranes: Crane[];
  particles: Particle[];
  popups: Popup[];
  score: number;
  best: number;
  shake: number;
  flash: number;
  explodeT: number;
  deathT: number;
  nextId: number;
  time: number;
};

function loadBest(): number {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    /* ignore quota / private mode */
  }
}

function emptyPlayer(): Player {
  const col = COLS - 2;
  return {
    col,
    row: 0,
    fromCol: col,
    fromRow: 0,
    animT: 1,
    animDur: WALK_MS,
    moving: false,
    facing: -1,
    pose: "idle",
    walkFrame: 0,
    walkHold: 0,
    pushHold: 0,
    jumpT: 0,
  };
}

function craneEnterX(index = 0): number {
  return (CANVAS_W + CELL * 0.85 - ORIGIN_X) / CELL + index * 1.85;
}

function craneExitX(): number {
  return (-CELL * 1.1 - ORIGIN_X) / CELL;
}

function makeCrane(index: number, avoidCol?: number): Crane {
  let dropCol = Math.floor(Math.random() * COLS);
  if (avoidCol !== undefined && dropCol === avoidCol) {
    dropCol = (dropCol + 4) % COLS;
  }
  return {
    x: craneEnterX(index),
    carrying: true,
    dropCol,
    dropping: 0,
  };
}

export function createGame(): GameState {
  return {
    phase: "title",
    player: emptyPlayer(),
    crates: [],
    cranes: [makeCrane(0, COLS - 2)],
    particles: [],
    popups: [],
    score: 0,
    best: loadBest(),
    shake: 0,
    flash: 0,
    explodeT: 0,
    deathT: 0,
    nextId: 1,
    time: 0,
  };
}

export function startRun(state: GameState) {
  state.phase = "playing";
  state.player = emptyPlayer();
  state.crates = [];
  state.cranes = [makeCrane(0, COLS - 2)];
  state.particles = [];
  state.popups = [];
  state.score = 0;
  state.shake = 0;
  state.flash = 0;
  state.explodeT = 0;
  state.deathT = 0;
  state.nextId = 1;
  sfx.start();
}

export function togglePause(state: GameState) {
  if (state.phase === "playing") state.phase = "paused";
  else if (state.phase === "paused") state.phase = "playing";
}

function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

function crateAt(state: GameState, col: number, row: number, ignoreId = -1): Crate | undefined {
  return state.crates.find((c) => c.id !== ignoreId && c.col === col && c.row === row);
}

function standRow(player: Player): number {
  if (player.moving && player.animT < 0.5) return player.fromRow;
  return player.row;
}

function blocked(state: GameState, col: number, row: number, ignoreId = -1): boolean {
  if (!inBounds(col, row)) return true;
  return Boolean(crateAt(state, col, row, ignoreId));
}

function supported(state: GameState, col: number, row: number, ignoreId = -1): boolean {
  if (row <= 0) return true;
  return Boolean(crateAt(state, col, row - 1, ignoreId));
}

function beginMove(
  actor: { col: number; row: number; fromCol: number; fromRow: number; animT: number; animDur: number; moving: boolean },
  col: number,
  row: number,
  dur: number,
) {
  actor.fromCol = actor.col;
  actor.fromRow = actor.row;
  actor.col = col;
  actor.row = row;
  actor.animT = 0;
  actor.animDur = dur;
  actor.moving = true;
}

function stepAnim(actor: { animT: number; animDur: number; moving: boolean }, dt: number): boolean {
  if (!actor.moving) return false;
  const dur = actor.animDur > 0 ? actor.animDur : 1;
  actor.animT += Math.max(0, dt) / dur;
  if (actor.animT >= 1) {
    actor.animT = 1;
    actor.moving = false;
    return true;
  }
  return false;
}

function addScore(state: GameState, col: number, row: number, amount = 1) {
  state.score += amount;
  state.popups.push({ col, row, text: `+${amount}`, life: 700 });
  syncCraneCount(state);
}

function spawnCrate(state: GameState, col: number) {
  const top = ROWS - 1;
  if (blocked(state, col, top)) return false;
  const crate: Crate = {
    id: state.nextId++,
    col,
    row: top,
    fromCol: col,
    fromRow: top + 1,
    animT: 0,
    animDur: CRATE_FALL_MS,
    moving: true,
  };
  state.crates.push(crate);
  addScore(state, col, top);
  sfx.drop();
  return true;
}

function topBusy(state: GameState, col: number): boolean {
  return state.crates.some(
    (crate) =>
      crate.col === col &&
      (crate.row >= ROWS - 1 || (crate.moving && Math.max(crate.row, crate.fromRow) >= ROWS - 1)),
  );
}

function randomFreeCol(state: GameState, avoid: number[] = []): number | null {
  const preferred: number[] = [];
  const fallback: number[] = [];
  for (let col = 0; col < COLS; col += 1) {
    if (topBusy(state, col)) continue;
    if (avoid.includes(col)) fallback.push(col);
    else preferred.push(col);
  }
  const options = preferred.length ? preferred : fallback;
  if (!options.length) return null;
  return options[Math.floor(Math.random() * options.length)] ?? null;
}

function syncCraneCount(state: GameState) {
  const want = Math.min(MAX_CRANES, craneThreshold(state.score));
  while (state.cranes.length < want) {
    state.cranes.push(makeCrane(state.cranes.length));
  }
}

function updateCranes(state: GameState, dt: number) {
  syncCraneCount(state);
  const speed = 1.28 + state.score * 0.008;
  for (const crane of state.cranes) {
    const slow = crane.dropping > 0 ? 0.55 : 1;
    crane.x -= (speed * slow * dt) / 1000;

    if (crane.dropping > 0) {
      crane.dropping -= dt;
      if (crane.dropping <= 0 && crane.carrying) {
        const col = Math.max(0, Math.min(COLS - 1, Math.round(crane.x)));
        if (!topBusy(state, col)) spawnCrate(state, col);
        crane.carrying = false;
      }
    } else if (crane.carrying) {
      if (crane.x <= crane.dropCol + 0.18 && crane.x >= crane.dropCol - 0.4 && !topBusy(state, crane.dropCol)) {
        crane.dropping = CRANE_DROP_MS;
      } else if (crane.x < crane.dropCol - 0.45) {
        const next = randomFreeCol(
          state,
          state.cranes.map((item) => item.dropCol),
        );
        if (next !== null && next < crane.x) crane.dropCol = next;
      }
    }

    if (crane.x < craneExitX()) {
      crane.x = craneEnterX();
      crane.carrying = true;
      crane.dropping = 0;
      crane.dropCol = randomFreeCol(state) ?? Math.floor(Math.random() * COLS);
    }
  }
}

function applyCrateGravity(state: GameState) {
  const ordered = [...state.crates].sort((a, b) => a.row - b.row);
  for (const crate of ordered) {
    if (crate.moving) continue;
    if (supported(state, crate.col, crate.row, crate.id)) continue;
    beginMove(crate, crate.col, crate.row - 1, CRATE_FALL_MS);
  }
}

function crateOverlapsPlayer(state: GameState, crate: Crate): boolean {
  const p = state.player;
  return crate.col === p.col && crate.row === p.row;
}

function playerAirborne(player: Player): boolean {
  return player.pose === "jump" || player.jumpT > 0;
}

function smashCrate(state: GameState, crate: Crate) {
  state.crates = state.crates.filter((item) => item.id !== crate.id);
  for (let i = 0; i < 12; i += 1) {
    state.particles.push({
      x: crate.col + 0.5,
      y: crate.row + 0.5,
      vx: (Math.random() - 0.5) * 0.014,
      vy: 0.003 + Math.random() * 0.012,
      life: 360 + Math.random() * 220,
      max: 620,
    });
  }
  addScore(state, crate.col, crate.row);
  state.shake = 5;
  state.flash = 0.45;
  sfx.smash();
}

function resolveCrateHit(state: GameState, crate: Crate): "smash" | "kill" | "none" {
  if (!crateOverlapsPlayer(state, crate)) return "none";
  if (playerAirborne(state.player)) {
    smashCrate(state, crate);
    return "smash";
  }
  killPlayer(state);
  return "kill";
}

function killPlayer(state: GameState) {
  if (state.phase !== "playing") return;
  state.phase = "dead";
  state.player.pose = "dead";
  state.player.moving = false;
  state.deathT = DEATH_MS;
  state.shake = 10;
  sfx.crush();
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
  }
}

function bottomRowFull(state: GameState): boolean {
  for (let col = 0; col < COLS; col += 1) {
    const crate = crateAt(state, col, 0);
    if (!crate || crate.moving) return false;
  }
  return true;
}

function burstRow(state: GameState) {
  for (const crate of state.crates) {
    if (crate.row !== 0) continue;
    for (let i = 0; i < 10; i += 1) {
      state.particles.push({
        x: crate.col + 0.5,
        y: 0.5,
        vx: (Math.random() - 0.5) * 0.012,
        vy: 0.004 + Math.random() * 0.01,
        life: 420 + Math.random() * 280,
        max: 700,
      });
    }
  }
  state.crates = state.crates.filter((c) => c.row !== 0);
  for (const crate of state.crates) {
    crate.fromCol = crate.col;
    crate.fromRow = crate.row;
    crate.row -= 1;
    crate.animT = 0;
    crate.animDur = FALL_MS + 40;
    crate.moving = true;
  }
  const p = state.player;
  if (p.row > 0) {
    p.fromCol = p.col;
    p.fromRow = p.row;
    p.row -= 1;
    p.animT = 0;
    p.animDur = FALL_MS + 40;
    p.moving = true;
    p.pose = "fall";
  }
  addScore(state, p.col, Math.max(1, p.row + 1));
  state.flash = 1;
  state.shake = 7;
  sfx.clear();
}

function updateExploding(state: GameState, dt: number) {
  state.explodeT -= dt;
  if (state.explodeT > 0) return;
  burstRow(state);
  state.phase = "playing";
  applyCrateGravity(state);
  if (bottomRowFull(state) && state.crates.every((c) => !c.moving)) {
    state.phase = "exploding";
    state.explodeT = EXPLODE_MS * 0.7;
  }
}

function playerGravity(state: GameState) {
  const p = state.player;
  if (p.moving || p.pose === "dead") return;
  if (p.row <= 0) return;
  if (supported(state, p.col, p.row)) return;
  beginMove(p, p.col, p.row - 1, FALL_MS);
  p.pose = "fall";
}

function crateCanPush(state: GameState, crate: Crate, dir: Dir): boolean {
  if (crate.moving) return false;
  if (crateAt(state, crate.col, crate.row + 1)) return false;
  const dest = crate.col + dir;
  if (dest < 0 || dest >= COLS) return false;
  return !blocked(state, dest, crate.row, crate.id);
}

function settleGroundedPose(player: Player) {
  if (player.moving || player.jumpT > 0) return;
  if (player.pose === "jump" || player.pose === "fall") player.pose = "idle";
}

export function tryWalk(state: GameState, dir: Dir): boolean {
  if (state.phase !== "playing") return false;
  const p = state.player;
  if (p.pose === "dead") return false;
  settleGroundedPose(p);
  if (p.moving || p.jumpT > 0 || p.pose === "jump" || p.pose === "fall") return false;
  p.facing = dir;
  const nx = p.col + dir;
  if (nx < 0 || nx >= COLS) return false;

  const feet = standRow(p);
  const target = crateAt(state, nx, feet) ?? crateAt(state, nx, p.row);
  if (target) {
    if (target.row !== feet || !crateCanPush(state, target, dir)) return false;
    interruptMove(state);
    p.jumpT = 0;
    beginMove(target, target.col + dir, target.row, CRATE_SLIDE_MS);
    beginMove(p, nx, target.row, PUSH_MS);
    p.pose = "push";
    p.pushHold = 640;
    sfx.push();
    return true;
  }

  interruptMove(state);
  p.jumpT = 0;
  beginMove(p, nx, feet, WALK_MS);
  p.pose = "walk";
  p.walkFrame += 1;
  p.walkHold = 520;
  sfx.walk();
  return true;
}

function interruptMove(state: GameState) {
  const player = state.player;
  if (!player.moving) return;
  if (player.pose === "push") {
    const pushed = state.crates.find(
      (crate) => crate.moving && crate.fromCol === player.col && crate.row === player.row,
    );
    if (pushed) {
      pushed.col = pushed.fromCol;
      pushed.moving = false;
      pushed.animT = 1;
    }
    player.col = player.fromCol;
    player.row = player.fromRow;
    player.moving = false;
    player.animT = 1;
    return;
  }
  if (player.animT < 0.55) {
    player.col = player.fromCol;
    player.row = player.fromRow;
  }
  player.moving = false;
  player.animT = 1;
}

function hopInPlace(state: GameState) {
  const p = state.player;
  interruptMove(state);
  const ny = p.row + 1;
  if (inBounds(p.col, ny) && !blocked(state, p.col, ny)) {
    beginMove(p, p.col, ny, JUMP_MS);
  }
  startJumpPose(state);
}

function startJumpPose(state: GameState) {
  state.player.pose = "jump";
  state.player.jumpT = JUMP_AIR_MS;
  sfx.jump();
}

function climbOntoCrate(state: GameState, crate: Crate, nx: number) {
  const land = crate.row + 1;
  if (!inBounds(nx, land) || blocked(state, nx, land)) return false;
  beginMove(state.player, nx, land, JUMP_MS);
  startJumpPose(state);
  return true;
}

function jumpPushCrate(state: GameState, crate: Crate, dir: Dir, nx: number) {
  if (!crateCanPush(state, crate, dir)) return false;
  interruptMove(state);
  beginMove(crate, crate.col + dir, crate.row, CRATE_SLIDE_MS);
  beginMove(state.player, nx, crate.row, JUMP_MS);
  startJumpPose(state);
  sfx.push();
  return true;
}

function directedJump(state: GameState, dir: Dir): boolean {
  const p = state.player;
  interruptMove(state);
  p.facing = dir;
  const nx = p.col + dir;
  const feet = standRow(p);
  const climbCrate = crateAt(state, nx, feet) ?? crateAt(state, nx, p.row);
  if (climbCrate && climbOntoCrate(state, climbCrate, nx)) return true;
  const stacked = climbCrate ? crateAt(state, nx, climbCrate.row + 1) : crateAt(state, nx, feet + 1);
  if (stacked && crateCanPush(state, stacked, dir)) return jumpPushCrate(state, stacked, dir, nx);
  return false;
}

export function tryJump(state: GameState, dir: Dir | 0): boolean {
  if (state.phase !== "playing") return false;
  const p = state.player;
  if (p.pose === "dead") return false;
  settleGroundedPose(p);

  if (dir !== 0) {
    if (p.moving && p.pose !== "walk" && p.pose !== "push" && p.pose !== "jump" && p.pose !== "fall") {
      return false;
    }
    return directedJump(state, dir);
  }

  if (p.jumpT > 0 || p.pose === "jump") return false;
  if (p.moving && p.pose !== "walk" && p.pose !== "push") return false;
  hopInPlace(state);
  return true;
}

function updateParticles(state: GameState, dt: number) {
  for (const part of state.particles) {
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.vy -= 0.000028 * dt;
    part.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const pop of state.popups) pop.life -= dt;
  state.popups = state.popups.filter((p) => p.life > 0);
}

export function visualPos(actor: {
  col: number;
  row: number;
  fromCol: number;
  fromRow: number;
  animT: number;
  moving: boolean;
}): { col: number; row: number } {
  if (!actor.moving) return { col: actor.col, row: actor.row };
  const t = moveT(actor);
  return {
    col: actor.fromCol + (actor.col - actor.fromCol) * t,
    row: actor.fromRow + (actor.row - actor.fromRow) * t,
  };
}

function moveT(actor: {
  animT: number;
  col: number;
  row: number;
  fromCol: number;
  fromRow: number;
}): number {
  const t = Math.max(0, Math.min(1, actor.animT));
  const horizontal = actor.row === actor.fromRow && actor.col !== actor.fromCol;
  if (horizontal) return t;
  return t * t * (3 - 2 * t);
}

export function updateGame(state: GameState, dt: number) {
  state.time += dt;
  state.shake = Math.max(0, state.shake - dt * 0.028);
  state.flash = Math.max(0, state.flash - dt * 0.004);
  updateParticles(state, dt);

  if (state.phase === "title" || state.phase === "paused") return;

  if (state.phase === "dead") {
    stepAnim(state.player, dt);
    for (const crate of state.crates) stepAnim(crate, dt);
    state.deathT -= dt;
    return;
  }

  if (state.phase === "exploding") {
    updateExploding(state, dt);
    return;
  }

  updateCranes(state, dt);
  state.player.walkHold = Math.max(0, state.player.walkHold - dt);
  state.player.pushHold = Math.max(0, state.player.pushHold - dt);
  state.player.jumpT = Math.max(0, state.player.jumpT - dt);
  settleGroundedPose(state.player);

  for (const crate of [...state.crates]) {
    const done = stepAnim(crate, dt);
    if (done && resolveCrateHit(state, crate) === "kill") return;
  }

  const playerDone = stepAnim(state.player, dt);
  if (playerDone) {
    if (state.player.pose === "jump" || state.player.pose === "fall") sfx.land();
    if (state.player.pose !== "dead" && (state.player.pose === "fall" || state.player.jumpT <= 0)) {
      state.player.pose = "idle";
    }
  }

  applyCrateGravity(state);
  playerGravity(state);

  for (const crate of [...state.crates]) {
    if (crate.moving) continue;
    if (resolveCrateHit(state, crate) === "kill") return;
  }

  const unsettled = state.crates.some((c) => c.moving) || state.player.moving;
  if (!unsettled && bottomRowFull(state)) {
    state.phase = "exploding";
    state.explodeT = EXPLODE_MS;
  }
}

export function isGameOverVisible(state: GameState): boolean {
  return state.phase === "dead" && state.deathT <= 0;
}
