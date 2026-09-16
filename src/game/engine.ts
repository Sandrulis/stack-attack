import { sfx } from "../audio";
import {
  CANVAS_W,
  CELL,
  COLS,
  CRATE_FALL_MS,
  CRATE_SLIDE_MS,
  DEATH_MS,
  FALL_MS,
  HIGH_SCORE_KEY,
  CRANE_DROP_MS,
  CRUSH_HIT_ROW,
  CRUSH_REST_ROW,
  CRUSH_SETTLE_MS,
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
  crushFrom?: number;
  crushTo?: number;
  crushT?: number;
};

export type Crane = {
  x: number;
  dir: Dir;
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

export type SkyCloud = {
  x: number;
  y: number;
  vx: number;
  scale: number;
  puffs: number;
};

export type GameState = {
  phase: Phase;
  player: Player;
  crates: Crate[];
  cranes: Crane[];
  particles: Particle[];
  popups: Popup[];
  skyClouds: SkyCloud[];
  cloudWait: number;
  score: number;
  best: number;
  recordAtStart: number;
  sunset: number;
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

function craneRightX(extra = 0): number {
  return (CANVAS_W + CELL * 0.85 - ORIGIN_X) / CELL + extra;
}

function craneLeftX(extra = 0): number {
  return (-CELL * 1.1 - ORIGIN_X) / CELL - extra;
}

function randomDir(): Dir {
  return Math.random() < 0.5 ? -1 : 1;
}

function makeCrane(index: number, avoidCol?: number): Crane {
  let dropCol = Math.floor(Math.random() * COLS);
  if (avoidCol !== undefined && dropCol === avoidCol) {
    dropCol = (dropCol + 4) % COLS;
  }
  const dir: Dir = index === 0 ? -1 : randomDir();
  const stagger = index * 1.85 + Math.random() * 0.6;
  return {
    x: dir < 0 ? craneRightX(stagger) : craneLeftX(stagger),
    dir,
    carrying: true,
    dropCol,
    dropping: 0,
  };
}

function recycleCrane(state: GameState, crane: Crane) {
  crane.dir = randomDir();
  const stagger = 0.4 + Math.random() * 1.6;
  crane.x = crane.dir < 0 ? craneRightX(stagger) : craneLeftX(stagger);
  crane.carrying = true;
  crane.dropping = 0;
  crane.dropCol = randomFreeCol(state) ?? Math.floor(Math.random() * COLS);
}

function spawnSkyCloud(onScreen = false): SkyCloud {
  const scale = 0.55 + Math.random() * 1.55;
  const dir: Dir = Math.random() < 0.78 ? -1 : 1;
  const puffs = 3 + Math.floor(Math.random() * 4);
  const width = 22 * puffs * scale;
  return {
    x: onScreen ? -20 + Math.random() * (CANVAS_W - width + 40) : dir < 0 ? CANVAS_W + 40 : -width - 40,
    y: 22 + Math.random() * 168,
    vx: dir * (0.012 + Math.random() * 0.028),
    scale,
    puffs,
  };
}

function updateSkyClouds(state: GameState, dt: number) {
  state.cloudWait -= dt;
  if (state.cloudWait <= 0 && state.skyClouds.length < 4) {
    state.skyClouds.push(spawnSkyCloud());
    state.cloudWait = 2200 + Math.random() * 6200;
  }
  for (const cloud of state.skyClouds) cloud.x += cloud.vx * dt;
  state.skyClouds = state.skyClouds.filter((cloud) => cloud.x > -320 && cloud.x < CANVAS_W + 320);
}

export function createGame(): GameState {
  return {
    phase: "title",
    player: emptyPlayer(),
    crates: [],
    cranes: [makeCrane(0, COLS - 2)],
    particles: [],
    popups: [],
    skyClouds: [spawnSkyCloud(true), spawnSkyCloud(true)],
    cloudWait: 1800 + Math.random() * 2400,
    score: 0,
    best: loadBest(),
    recordAtStart: loadBest(),
    sunset: 0,
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
  state.recordAtStart = state.best;
  state.sunset = 0;
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
  carry = false,
) {
  const leftover = carry ? Math.max(0, Math.min(0.92, actor.animT - 1)) : 0;
  actor.fromCol = actor.col;
  actor.fromRow = actor.row;
  actor.col = col;
  actor.row = row;
  actor.animT = leftover;
  actor.animDur = dur;
  actor.moving = true;
}

function retargetMove(
  actor: { col: number; row: number; fromCol: number; fromRow: number; animT: number; animDur: number; moving: boolean },
  col: number,
  row: number,
  dur: number,
) {
  const vis = visualPos(actor);
  actor.fromCol = vis.col;
  actor.fromRow = vis.row;
  actor.col = col;
  actor.row = row;
  actor.animT = 0;
  actor.animDur = dur;
  actor.moving = true;
}

function crateIsFalling(crate: Crate): boolean {
  return crate.moving && crate.fromRow > crate.row;
}

function stepAnim(actor: { animT: number; animDur: number; moving: boolean }, dt: number): boolean {
  if (!actor.moving) return false;
  const dur = actor.animDur > 0 ? actor.animDur : 1;
  actor.animT += Math.max(0, dt) / dur;
  if (actor.animT >= 1) {
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
    const pace = crane.dropping > 0 ? 0.55 : crane.carrying ? 1 : 2;
    crane.x += (crane.dir * speed * pace * dt) / 1000;

    if (crane.dropping > 0) {
      crane.dropping -= dt;
      if (crane.dropping <= 0 && crane.carrying) {
        const col = Math.max(0, Math.min(COLS - 1, Math.round(crane.x)));
        if (!topBusy(state, col)) spawnCrate(state, col);
        crane.carrying = false;
      }
    } else if (crane.carrying) {
      const atDrop =
        crane.dir < 0
          ? crane.x <= crane.dropCol + 0.18 && crane.x >= crane.dropCol - 0.4
          : crane.x >= crane.dropCol - 0.18 && crane.x <= crane.dropCol + 0.4;
      if (atDrop && !topBusy(state, crane.dropCol)) {
        crane.dropping = CRANE_DROP_MS;
      } else {
        const passed = crane.dir < 0 ? crane.x < crane.dropCol - 0.45 : crane.x > crane.dropCol + 0.45;
        if (passed) {
          const next = randomFreeCol(
            state,
            state.cranes.map((item) => item.dropCol),
          );
          if (next !== null && (crane.dir < 0 ? next < crane.x : next > crane.x)) {
            crane.dropCol = next;
          }
        }
      }
    }

    const offscreen = crane.dir < 0 ? crane.x < craneLeftX() : crane.x > craneRightX();
    if (offscreen) recycleCrane(state, crane);
  }
}

function applyCrateGravity(state: GameState) {
  const ordered = [...state.crates].sort((a, b) => a.row - b.row);
  for (const crate of ordered) {
    if (crate.moving) continue;
    if (supported(state, crate.col, crate.row, crate.id)) continue;
    const dest = crate.row - 1;
    const ontoPlayer =
      state.player.pose !== "dead" &&
      !playerAirborne(state.player) &&
      state.player.col === crate.col &&
      state.player.row === dest;
    beginMove(crate, crate.col, dest, CRATE_FALL_MS, !ontoPlayer);
  }
}

function crateOverlapsPlayer(state: GameState, crate: Crate): boolean {
  const p = state.player;
  return crate.col === p.col && crate.row === p.row;
}

function crateHitsPlayerHead(state: GameState, crate: Crate): boolean {
  const p = state.player;
  if (p.pose === "dead" || playerAirborne(p)) return false;
  if (!crate.moving || crate.fromRow <= crate.row) return false;
  const cv = visualPos(crate);
  const pv = visualPos(p, p.pose === "jump");
  if (Math.abs(cv.col - pv.col) > 0.42) return false;
  if (crate.fromRow < pv.row + 0.45) return false;
  if (cv.row < pv.row - 0.05) return false;
  return cv.row <= pv.row + CRUSH_HIT_ROW;
}

function parkCrateOnPlayer(state: GameState, crate: Crate) {
  const vis = visualPos(crate);
  const rest = state.player.row + CRUSH_REST_ROW;
  crate.moving = false;
  crate.col = state.player.col;
  crate.row = state.player.row;
  crate.fromCol = vis.col;
  crate.fromRow = vis.row;
  crate.animT = 1;
  crate.crushFrom = vis.row;
  crate.crushTo = rest;
  crate.crushT = vis.row <= rest ? 1 : 0;
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
  if (playerAirborne(state.player)) {
    if (!crate.moving && crateOverlapsPlayer(state, crate)) {
      smashCrate(state, crate);
      return "smash";
    }
    return "none";
  }
  if (crateHitsPlayerHead(state, crate)) {
    killPlayer(state, crate);
    return "kill";
  }
  if (!crate.moving && crateOverlapsPlayer(state, crate)) {
    killPlayer(state, crate);
    return "kill";
  }
  return "none";
}

export function crateDrawInFront(state: GameState, crate: Crate): boolean {
  if (crate.crushTo != null) return true;
  const p = state.player;
  const cv = visualPos(crate);
  const pv = visualPos(p, p.pose === "jump");
  if (Math.abs(cv.col - pv.col) > 0.5) return false;
  if (p.pose === "dead" && crate.row >= p.row) return true;
  if (!crate.moving || crate.fromRow <= crate.row) return false;
  return cv.row < pv.row + 1.35 && cv.row > pv.row - 0.35;
}

function killPlayer(state: GameState, crate?: Crate) {
  if (state.phase !== "playing") return;
  state.phase = "dead";
  state.player.pose = "dead";
  state.player.moving = false;
  if (crate) parkCrateOnPlayer(state, crate);
  state.deathT = DEATH_MS;
  state.shake = 14;
  state.flash = 0.55;
  const p = state.player;
  for (let i = 0; i < 14; i += 1) {
    state.particles.push({
      x: p.col + 0.5 + (Math.random() - 0.5) * 0.8,
      y: p.row + 0.15 + Math.random() * 0.3,
      vx: (Math.random() - 0.5) * 0.018,
      vy: 0.004 + Math.random() * 0.014,
      life: 420 + Math.random() * 260,
      max: 700,
    });
  }
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
    const vis = crate.moving ? visualPos(crate) : { col: crate.col, row: crate.row };
    crate.fromCol = vis.col;
    crate.fromRow = vis.row;
    crate.row = Math.max(0, crate.row - 1);
    crate.animT = 0;
    crate.animDur = FALL_MS + 40;
    crate.moving = true;
  }
  const p = state.player;
  if (p.row > 0 && p.pose !== "dead") {
    const vis = p.moving ? visualPos(p, p.pose === "jump") : { col: p.col, row: p.row };
    p.fromCol = vis.col;
    p.fromRow = vis.row;
    p.row -= 1;
    p.animT = 0;
    p.animDur = FALL_MS + 40;
    p.moving = true;
    p.pose = "fall";
    p.jumpT = 0;
  }
  addScore(state, p.col, Math.max(1, p.row + 1));
  state.flash = 1;
  state.shake = 7;
  sfx.clear();
}

function playerGravity(state: GameState) {
  const p = state.player;
  if (p.moving || p.pose === "dead") return;
  if (p.row <= 0) return;
  if (supported(state, p.col, p.row)) return;
  beginMove(p, p.col, p.row - 1, FALL_MS, true);
  p.pose = "fall";
}

function crateCanPush(state: GameState, crate: Crate, dir: Dir): boolean {
  const falling = crateIsFalling(crate);
  if (crate.moving && !falling) return false;
  if (!falling && crateAt(state, crate.col, crate.row + 1)) return false;
  const dest = crate.col + dir;
  if (dest < 0 || dest >= COLS) return false;
  return !blocked(state, dest, crate.row, crate.id);
}

function fallingCrateBeside(state: GameState, dir: Dir): Crate | undefined {
  const p = state.player;
  const col = p.col + dir;
  let best: Crate | undefined;
  let bestDist = 99;
  for (const crate of state.crates) {
    if (!crateIsFalling(crate)) continue;
    const vis = visualPos(crate);
    const beside = crate.col === col || crate.fromCol === col || Math.abs(vis.col - col) <= 0.55;
    if (!beside) continue;
    if (vis.row < p.row - 0.2 || vis.row > p.row + 1.55) continue;
    const dist = Math.abs(vis.row - (p.row + 0.45));
    if (dist < bestDist) {
      bestDist = dist;
      best = crate;
    }
  }
  return best;
}

function shoveCrate(state: GameState, crate: Crate, dir: Dir): boolean {
  if (!crateCanPush(state, crate, dir)) return false;
  const dest = crate.col + dir;
  if (crateIsFalling(crate)) {
    const remain = Math.max(CRATE_FALL_MS, (1 - crate.animT) * crate.animDur);
    retargetMove(crate, dest, crate.row, remain);
  } else {
    beginMove(crate, dest, crate.row, CRATE_SLIDE_MS);
  }
  return true;
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
  const target =
    crateAt(state, nx, feet) ?? crateAt(state, nx, p.row) ?? fallingCrateBeside(state, dir);
  if (target) {
    if (!crateIsFalling(target) && target.row !== feet) return false;
    interruptMove(state);
    p.jumpT = 0;
    if (!shoveCrate(state, target, dir)) return false;
    if (!blocked(state, nx, feet, target.id)) beginMove(p, nx, feet, PUSH_MS);
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
  beginMove(p, p.col, p.row, JUMP_MS);
  startJumpPose(state);
}

function startJumpPose(state: GameState) {
  state.player.pose = "jump";
  state.player.jumpT = state.player.animDur;
  sfx.jump();
}

function columnStandRow(state: GameState, col: number): number {
  let top = -1;
  for (const crate of state.crates) {
    if (crate.col !== col) continue;
    if (crate.row > top) top = crate.row;
  }
  const stand = top + 1;
  if (!inBounds(col, stand)) return Math.max(0, top);
  return Math.max(0, stand);
}

function canLand(state: GameState, col: number, row: number): boolean {
  return inBounds(col, row) && !blocked(state, col, row);
}

function jumpTo(state: GameState, col: number, row: number) {
  const span = Math.abs(col - state.player.col) + Math.abs(row - state.player.row);
  beginMove(state.player, col, row, span > 1.5 ? JUMP_MS + 80 : JUMP_MS);
  startJumpPose(state);
}

function tryLeap(state: GameState, dir: Dir): boolean {
  const p = state.player;
  const from = standRow(p);
  const d1 = p.col + dir;
  const d2 = p.col + 2 * dir;
  const midStand = inBounds(d1, 0) ? columnStandRow(state, d1) : ROWS;
  const land1 = columnStandRow(state, d1);
  const land2 = columnStandRow(state, d2);

  if (canLand(state, d1, land1) && land1 > 0 && land1 <= from) {
    jumpTo(state, d1, land1);
    return true;
  }
  if (canLand(state, d2, land2) && land2 > 0 && land2 <= from && midStand <= from) {
    jumpTo(state, d2, land2);
    return true;
  }
  if (from > 0 && canLand(state, d2, land2) && land2 < from && midStand <= from) {
    jumpTo(state, d2, land2);
    return true;
  }
  if (from > 0 && canLand(state, d1, land1) && land1 < from) {
    jumpTo(state, d1, land1);
    return true;
  }
  if (canLand(state, d1, land1) && land1 === from) {
    jumpTo(state, d1, land1);
    return true;
  }
  return false;
}

function climbOntoCrate(state: GameState, crate: Crate, nx: number) {
  const land = crate.row + 1;
  if (!inBounds(nx, land) || blocked(state, nx, land)) return false;
  beginMove(state.player, nx, land, JUMP_MS);
  startJumpPose(state);
  return true;
}

function jumpPushCrate(state: GameState, crate: Crate, dir: Dir, nx: number) {
  interruptMove(state);
  if (!shoveCrate(state, crate, dir)) return false;
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
  if (climbCrate && crateCanPush(state, climbCrate, dir)) return jumpPushCrate(state, climbCrate, dir, nx);
  return tryLeap(state, dir);
}

export function tryJump(state: GameState, dir: Dir | 0): boolean {
  if (state.phase !== "playing") return false;
  const p = state.player;
  if (p.pose === "dead") return false;
  settleGroundedPose(p);
  if (p.pose === "jump" || p.pose === "fall" || p.jumpT > 0) return false;

  if (dir !== 0) return directedJump(state, dir);
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

export function visualPos(
  actor: {
    col: number;
    row: number;
    fromCol: number;
    fromRow: number;
    animT: number;
    moving: boolean;
    crushFrom?: number;
    crushTo?: number;
    crushT?: number;
  },
  hop = false,
): { col: number; row: number } {
  if (actor.crushFrom != null && actor.crushTo != null) {
    const t = Math.max(0, Math.min(1, actor.crushT ?? 0));
    return {
      col: actor.col,
      row: actor.crushFrom + (actor.crushTo - actor.crushFrom) * t,
    };
  }
  if (!actor.moving) return { col: actor.col, row: actor.row };
  const t = Math.max(0, Math.min(1, actor.animT));
  const col = actor.fromCol + (actor.col - actor.fromCol) * t;
  let row = actor.fromRow + (actor.row - actor.fromRow) * t;
  if (hop) {
    const climb = actor.row - actor.fromRow;
    const span = Math.abs(actor.col - actor.fromCol);
    const arc = climb > 0.1 ? 0.68 : span > 1.1 ? 0.55 : span >= 1 ? 0.5 : 0.42;
    row += arc * 4 * t * (1 - t);
  }
  return { col, row };
}

function stepCrushSettle(crate: Crate, dt: number) {
  if (crate.crushTo == null) return;
  crate.crushT = Math.min(1, (crate.crushT ?? 0) + Math.max(0, dt) / CRUSH_SETTLE_MS);
}

export function updateGame(state: GameState, dt: number) {
  state.time += dt;
  state.shake = Math.max(0, state.shake - dt * 0.028);
  state.flash = Math.max(0, state.flash - dt * 0.004);
  if (state.phase !== "title" && state.phase !== "paused" && state.score > state.recordAtStart) {
    state.sunset = Math.min(1, state.sunset + dt / 1100);
  }
  updateParticles(state, dt);
  if (state.phase !== "paused") updateSkyClouds(state, dt);

  if (state.phase === "title" || state.phase === "paused") return;

  if (state.phase === "dead") {
    stepAnim(state.player, dt);
    for (const crate of state.crates) {
      if (crate.crushTo != null) stepCrushSettle(crate, dt);
      else stepAnim(crate, dt);
    }
    state.deathT -= dt;
    return;
  }

  updateCranes(state, dt);
  state.player.walkHold = Math.max(0, state.player.walkHold - dt);
  state.player.pushHold = Math.max(0, state.player.pushHold - dt);
  state.player.jumpT = Math.max(0, state.player.jumpT - dt);
  settleGroundedPose(state.player);

  for (const crate of [...state.crates]) {
    stepAnim(crate, dt);
    if (resolveCrateHit(state, crate) === "kill") return;
  }

  const playerDone = stepAnim(state.player, dt);
  if (playerDone) {
    if (state.player.pose === "jump" || state.player.pose === "fall") sfx.land();
    if (state.player.pose === "jump") state.player.jumpT = 0;
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

  if (bottomRowFull(state)) burstRow(state);
}

export function isGameOverVisible(state: GameState): boolean {
  return state.phase === "dead" && state.deathT <= 0;
}
