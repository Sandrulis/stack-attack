import { sfx } from "../audio";
import {
  CANVAS_W,
  CELL,
  COLS,
  CRATE_FALL_MS,
  CRATE_SLIDE_MS,
  CRUSH_HIT_ROW,
  CRUSH_REST_ROW,
  CRUSH_SETTLE_MS,
  DEATH_MS,
  FALL_MS,
  HEART_ABSORB_MS,
  HEART_DROP_MIN,
  HEART_DROP_RANGE,
  HEART_DROP_STEP,
  HEART_FALL_MS,
  HEART_REGEN_MS,
  HIGH_SCORE_KEY,
  JUMP_MS,
  LIVES_KEY,
  MAX_CRANES,
  MAX_LIVES,
  ORIGIN_X,
  ORIGIN_Y,
  PUSH_MS,
  ROWS,
  WALK_MS,
  craneThreshold,
  windowPane,
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
  cargo: "crate" | "heart";
};

export type FallingHeart = {
  id: number;
  col: number;
  row: number;
  fromCol: number;
  fromRow: number;
  animT: number;
  animDur: number;
  moving: boolean;
  absorbT: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color?: string;
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

export type BannerPlane = {
  x: number;
  y: number;
  vx: number;
  dir: Dir;
  scale: number;
  name: string;
  score: number;
};

export type RainDrop = {
  x: number;
  y: number;
  vy: number;
  len: number;
};

export type FireworkSpark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: "rocket" | "spark";
};

export type GameState = {
  phase: Phase;
  player: Player;
  crates: Crate[];
  cranes: Crane[];
  fallingHearts: FallingHeart[];
  particles: Particle[];
  popups: Popup[];
  skyClouds: SkyCloud[];
  cloudWait: number;
  bannerPlane: BannerPlane | null;
  planeWait: number;
  leaderName: string;
  leaderScore: number;
  rain: RainDrop[];
  storm: number;
  stormWait: number;
  stormHold: number;
  stormFlash: number;
  fireworks: FireworkSpark[];
  fireworkWait: number;
  celebration: number;
  score: number;
  livesReady: boolean;
  lives: number;
  nextLifeAt: number;
  craneTrip: number;
  nextHeartTrip: number;
  heartDropWindow: number;
  pendingLifeGains: number;
  best: number;
  recordAtStart: number;
  globalBestAtStart: number;
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

function saveLives(state: GameState) {
  if (!state.livesReady) return;
  try {
    localStorage.setItem(LIVES_KEY, JSON.stringify({ lives: state.lives, nextLifeAt: state.nextLifeAt }));
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyLifeRegen(state: GameState, now = Date.now()) {
  if (!state.livesReady) return;
  const beforeLives = state.lives;
  const beforeAt = state.nextLifeAt;
  if (state.lives >= MAX_LIVES) {
    state.lives = MAX_LIVES;
    state.nextLifeAt = 0;
  } else {
    if (!state.nextLifeAt) state.nextLifeAt = now + HEART_REGEN_MS;
    if (state.nextLifeAt > now + HEART_REGEN_MS) state.nextLifeAt = now + HEART_REGEN_MS;
    while (state.lives < MAX_LIVES && state.nextLifeAt > 0 && now >= state.nextLifeAt) {
      state.lives += 1;
      if (state.lives >= MAX_LIVES) state.nextLifeAt = 0;
      else state.nextLifeAt += HEART_REGEN_MS;
    }
  }
  if (state.lives !== beforeLives || state.nextLifeAt !== beforeAt) saveLives(state);
}

export function hydrateLives(state: GameState, lives: number, nextLifeAt: number) {
  state.livesReady = true;
  state.lives = Math.max(0, Math.min(MAX_LIVES, lives));
  state.nextLifeAt = state.lives >= MAX_LIVES ? 0 : Math.max(0, nextLifeAt);
  applyLifeRegen(state);
  saveLives(state);
}

export function clearLives(state: GameState) {
  state.livesReady = false;
  state.lives = 0;
  state.nextLifeAt = 0;
}

export function spendLocalLife(state: GameState): boolean {
  applyLifeRegen(state);
  if (state.lives < 1) return false;
  state.lives -= 1;
  if (!state.nextLifeAt) state.nextLifeAt = Date.now() + HEART_REGEN_MS;
  saveLives(state);
  return true;
}

export function gainLocalLife(state: GameState): boolean {
  if (!state.livesReady) return false;
  applyLifeRegen(state);
  if (state.lives >= MAX_LIVES) return false;
  state.lives += 1;
  if (state.lives >= MAX_LIVES) state.nextLifeAt = 0;
  saveLives(state);
  state.pendingLifeGains += 1;
  return true;
}

export function consumePendingLifeGains(state: GameState): number {
  const n = state.pendingLifeGains;
  state.pendingLifeGains = 0;
  return n;
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

function scheduleHeartDrop(state: GameState) {
  const lo = HEART_DROP_MIN + HEART_DROP_STEP * state.heartDropWindow;
  const hi = lo + HEART_DROP_RANGE;
  state.nextHeartTrip = lo + Math.floor(Math.random() * (hi - lo + 1));
  state.heartDropWindow += 1;
}

function armCraneCargo(state: GameState, crane: Crane) {
  state.craneTrip += 1;
  if (state.craneTrip >= state.nextHeartTrip) {
    crane.cargo = "heart";
    crane.dropCol = Math.floor(Math.random() * COLS);
    scheduleHeartDrop(state);
  } else {
    crane.cargo = "crate";
  }
}

function makeCrane(state: GameState, index: number, avoidCol?: number): Crane {
  let dropCol = Math.floor(Math.random() * COLS);
  if (avoidCol !== undefined && dropCol === avoidCol) {
    dropCol = (dropCol + 4) % COLS;
  }
  const dir: Dir = index === 0 ? -1 : randomDir();
  const stagger = index * 1.85 + Math.random() * 0.6;
  const crane: Crane = {
    x: dir < 0 ? craneRightX(stagger) : craneLeftX(stagger),
    dir,
    carrying: true,
    dropCol,
    cargo: "crate",
  };
  armCraneCargo(state, crane);
  return crane;
}

function recycleCrane(state: GameState, crane: Crane) {
  crane.dir = randomDir();
  const stagger = 0.4 + Math.random() * 1.6;
  crane.x = crane.dir < 0 ? craneRightX(stagger) : craneLeftX(stagger);
  crane.carrying = true;
  crane.dropCol = randomFreeCol(state) ?? Math.floor(Math.random() * COLS);
  armCraneCargo(state, crane);
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

function spawnBannerPlane(state: GameState): BannerPlane {
  const dir: Dir = Math.random() < 0.5 ? -1 : 1;
  const scale = 0.78 + Math.random() * 0.32;
  const width = 340 * scale;
  return {
    x: dir < 0 ? CANVAS_W + 36 : -width - 36,
    y: 48 + Math.random() * 168,
    vx: dir * (0.085 + Math.random() * 0.12),
    dir,
    scale,
    name: state.leaderName,
    score: state.leaderScore,
  };
}

function nextPlaneWait(): number {
  return 38000 + Math.random() * 52000;
}

function updateBannerPlane(state: GameState, dt: number) {
  if (state.bannerPlane) {
    state.bannerPlane.x += state.bannerPlane.vx * dt;
    const plane = state.bannerPlane;
    const gone = plane.dir < 0 ? plane.x < -420 : plane.x > CANVAS_W + 420;
    if (gone) {
      state.bannerPlane = null;
      state.planeWait = nextPlaneWait();
    }
    return;
  }
  state.planeWait -= dt;
  if (state.planeWait <= 0 && state.leaderName && state.leaderScore > 0) {
    state.bannerPlane = spawnBannerPlane(state);
  }
}

function nextStormWait(): number {
  return 22000 + Math.random() * 40000;
}

function spawnRainDrop(anywhere = false): RainDrop {
  return {
    x: Math.random() * CANVAS_W,
    y: anywhere ? Math.random() * 280 : -24 - Math.random() * 90,
    vy: 0.52 + Math.random() * 0.38,
    len: 9 + Math.random() * 16,
  };
}

function updateWeather(state: GameState, dt: number) {
  if (state.celebration > 0.04 || state.sunset > 0.04) {
    state.stormHold = 0;
    state.storm = Math.max(0, state.storm - dt / 700);
    state.stormFlash = Math.max(0, state.stormFlash - dt * 0.01);
    if (state.storm <= 0) state.rain = [];
    else updateRain(state, dt);
    return;
  }
  if (state.stormHold > 0) {
    state.stormHold -= dt;
    state.storm = Math.min(1, state.storm + dt / 900);
    if (state.storm > 0.55 && Math.random() < dt * 0.0014) state.stormFlash = 1;
  } else if (state.storm > 0) {
    state.storm = Math.max(0, state.storm - dt / 1100);
    if (state.storm <= 0) {
      state.rain = [];
      state.stormWait = nextStormWait();
    }
  } else {
    state.stormWait -= dt;
    if (state.stormWait <= 0) {
      state.stormHold = 8000 + Math.random() * 10000;
      state.stormWait = nextStormWait();
    }
  }
  state.stormFlash = Math.max(0, state.stormFlash - dt * 0.008);
  updateRain(state, dt);
}

function updateRain(state: GameState, dt: number) {
  if (state.storm < 0.05) {
    state.rain = [];
    return;
  }
  const want = Math.floor(64 * state.storm);
  while (state.rain.length < want) state.rain.push(spawnRainDrop(state.rain.length < 12));
  if (state.rain.length > want) state.rain.length = want;
  for (const drop of state.rain) {
    drop.y += drop.vy * dt;
    if (drop.y > ORIGIN_Y + ROWS * CELL) {
      drop.x = Math.random() * CANVAS_W;
      drop.y = -24 - Math.random() * 70;
      drop.vy = 0.52 + Math.random() * 0.38;
    }
  }
}

export function createGame(): GameState {
  const state: GameState = {
    phase: "title",
    player: emptyPlayer(),
    crates: [],
    cranes: [],
    fallingHearts: [],
    particles: [],
    popups: [],
    skyClouds: [spawnSkyCloud(true), spawnSkyCloud(true)],
    cloudWait: 1800 + Math.random() * 2400,
    bannerPlane: null,
    planeWait: 12000 + Math.random() * 10000,
    leaderName: "",
    leaderScore: 0,
    rain: [],
    storm: 0,
    stormWait: nextStormWait(),
    stormHold: 0,
    stormFlash: 0,
    fireworks: [],
    fireworkWait: 120,
    celebration: 0,
    score: 0,
    livesReady: false,
    lives: 0,
    nextLifeAt: 0,
    craneTrip: 0,
    nextHeartTrip: 0,
    heartDropWindow: 0,
    pendingLifeGains: 0,
    best: loadBest(),
    recordAtStart: loadBest(),
    globalBestAtStart: Number.POSITIVE_INFINITY,
    sunset: 0,
    shake: 0,
    flash: 0,
    explodeT: 0,
    deathT: 0,
    nextId: 1,
    time: 0,
  };
  scheduleHeartDrop(state);
  state.cranes = [makeCrane(state, 0, COLS - 2)];
  return state;
}

export function hydrateBest(state: GameState, best: number) {
  const n = Math.max(0, best);
  state.best = n;
  if (state.phase === "title") state.recordAtStart = n;
  saveBest(n);
}

export function hydrateLeader(state: GameState, name: string, score: number) {
  state.leaderName = name.trim();
  state.leaderScore = Math.max(0, score);
}

export function syncLocalBest(state: GameState) {
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
  }
}

export function runBeatRecord(state: GameState): boolean {
  if (state.phase !== "playing" && state.phase !== "paused") return false;
  return state.score > state.recordAtStart || state.score > state.globalBestAtStart;
}

export function startRun(state: GameState, opts?: { globalBest?: number }) {
  state.phase = "playing";
  state.player = emptyPlayer();
  state.crates = [];
  state.cranes = [];
  state.fallingHearts = [];
  state.craneTrip = 0;
  state.nextHeartTrip = 0;
  state.heartDropWindow = 0;
  state.pendingLifeGains = 0;
  scheduleHeartDrop(state);
  state.cranes = [makeCrane(state, 0, COLS - 2)];
  state.particles = [];
  state.popups = [];
  state.score = 0;
  state.recordAtStart = state.best;
  state.globalBestAtStart = opts?.globalBest ?? Number.POSITIVE_INFINITY;
  state.sunset = 0;
  state.celebration = 0;
  state.fireworks = [];
  state.fireworkWait = 80;
  state.rain = [];
  state.storm = 0;
  state.stormWait = nextStormWait();
  state.stormHold = 0;
  state.stormFlash = 0;
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
  if (dropBlocked(state, col) || blocked(state, col, top)) return false;
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

function spawnFallingHeart(state: GameState, col: number) {
  const top = ROWS - 1;
  state.fallingHearts.push({
    id: state.nextId++,
    col,
    row: top,
    fromCol: col,
    fromRow: top + 1,
    animT: 0,
    animDur: HEART_FALL_MS,
    moving: true,
    absorbT: 0,
  });
  sfx.drop();
}

function burstHeartBits(state: GameState, col: number, row: number) {
  for (let i = 0; i < 12; i += 1) {
    state.particles.push({
      x: col + 0.5,
      y: row + 0.5,
      vx: (Math.random() - 0.5) * 0.014,
      vy: 0.003 + Math.random() * 0.012,
      life: 360 + Math.random() * 220,
      max: 620,
    });
  }
}

function playerUnderHeart(state: GameState, heart: FallingHeart): boolean {
  if (state.phase !== "playing" || state.player.pose === "dead") return false;
  const hv = visualPos(heart);
  const pv = visualPos(state.player, state.player.pose === "jump");
  if (Math.abs(hv.col - pv.col) > 0.42) return false;
  return hv.row <= pv.row + 0.9 && hv.row >= pv.row - 0.35;
}

function catchFallingHeart(state: GameState, heart: FallingHeart) {
  const vis = visualPos(heart);
  heart.fromCol = vis.col;
  heart.fromRow = vis.row;
  heart.moving = false;
  heart.absorbT = 0.001;
  if (gainLocalLife(state)) {
    state.popups.push({ col: vis.col, row: vis.row, text: "+1", life: 700 });
  }
  sfx.heartCatch();
}

function splatFallingHeart(state: GameState, heart: FallingHeart) {
  const vis = visualPos(heart);
  state.fallingHearts = state.fallingHearts.filter((item) => item.id !== heart.id);
  burstHeartBits(state, vis.col, vis.row);
  state.shake = 5;
  state.flash = 0.45;
  sfx.smash();
}

function heartHitsCrate(state: GameState, heart: FallingHeart): boolean {
  const hv = visualPos(heart);
  for (const crate of state.crates) {
    const cv = visualPos(crate);
    if (Math.abs(hv.col - cv.col) > 0.42) continue;
    if (hv.row <= cv.row + 0.95 && hv.row >= cv.row - 0.2) return true;
  }
  return false;
}

function updateFallingHearts(state: GameState, dt: number, canCatch: boolean) {
  for (const heart of [...state.fallingHearts]) {
    if (heart.absorbT > 0) {
      heart.absorbT += dt / HEART_ABSORB_MS;
      if (heart.absorbT >= 1) {
        state.fallingHearts = state.fallingHearts.filter((item) => item.id !== heart.id);
      }
      continue;
    }
    const landed = stepAnim(heart, dt);
    if (canCatch && playerUnderHeart(state, heart)) {
      catchFallingHeart(state, heart);
      continue;
    }
    if (heartHitsCrate(state, heart)) {
      splatFallingHeart(state, heart);
      continue;
    }
    if (heart.moving) continue;
    if (landed && heart.row <= 0) {
      splatFallingHeart(state, heart);
      continue;
    }
    if (heart.row > 0) beginMove(heart, heart.col, heart.row - 1, HEART_FALL_MS);
  }
}

function crateRowsInCol(crate: Crate, col: number): number[] {
  const rows: number[] = [];
  if (crate.col === col) rows.push(crate.row);
  if (crate.moving && crate.fromCol === col && !rows.includes(crate.fromRow)) rows.push(crate.fromRow);
  return rows;
}

function fallingRowsInCol(state: GameState, col: number, ignoreId = -1): number[] {
  const rows: number[] = [];
  for (const crate of state.crates) {
    if (crate.id === ignoreId || !crateIsFalling(crate)) continue;
    for (const row of crateRowsInCol(crate, col)) rows.push(row);
  }
  return rows;
}

function rowsTooClose(a: number[], b: number[]): boolean {
  for (const x of a) {
    for (const y of b) {
      if (Math.abs(x - y) < 2) return true;
    }
  }
  return false;
}

function topBusy(state: GameState, col: number): boolean {
  return state.crates.some(
    (crate) =>
      crate.col === col &&
      (crate.row >= ROWS - 1 || (crate.moving && Math.max(crate.row, crate.fromRow) >= ROWS - 1)),
  );
}

function dropBlocked(state: GameState, col: number): boolean {
  if (topBusy(state, col) || blocked(state, col, ROWS - 1)) return true;
  return rowsTooClose([ROWS - 1, ROWS], fallingRowsInCol(state, col));
}

function randomFreeCol(state: GameState, avoid: number[] = []): number | null {
  const preferred: number[] = [];
  const fallback: number[] = [];
  for (let col = 0; col < COLS; col += 1) {
    if (dropBlocked(state, col)) continue;
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
    state.cranes.push(makeCrane(state, state.cranes.length));
  }
}

function retargetDrop(state: GameState, crane: Crane) {
  if (crane.cargo === "heart") {
    crane.dropCol = Math.floor(Math.random() * COLS);
    return;
  }
  const next = randomFreeCol(state);
  if (next !== null) crane.dropCol = next;
}

function releaseCraneCargo(state: GameState, crane: Crane) {
  const col = Math.max(0, Math.min(COLS - 1, Math.round(crane.x)));
  if (crane.cargo === "heart") {
    spawnFallingHeart(state, col);
    crane.carrying = false;
    sendCraneToNearestEdge(crane);
    return;
  }
  if (spawnCrate(state, col)) {
    crane.carrying = false;
    sendCraneToNearestEdge(crane);
    return;
  }
  retargetDrop(state, crane);
}

function sendCraneToNearestEdge(crane: Crane) {
  crane.dir = crane.x <= (COLS - 1) / 2 ? -1 : 1;
}

function bounceLoadedCrane(state: GameState, crane: Crane) {
  if (crane.dir < 0 && crane.x <= 0.02) {
    crane.x = 0.02;
    crane.dir = 1;
    retargetDrop(state, crane);
  } else if (crane.dir > 0 && crane.x >= COLS - 1.02) {
    crane.x = COLS - 1.02;
    crane.dir = -1;
    retargetDrop(state, crane);
  }
}

function updateCranes(state: GameState, dt: number) {
  syncCraneCount(state);
  const speed = 1.28 + state.score * 0.008;
  for (const crane of state.cranes) {
    const pace = crane.carrying ? 1 : 2;
    crane.x += (crane.dir * speed * pace * dt) / 1000;

    if (crane.carrying) {
      const atDrop =
        crane.dir < 0
          ? crane.x <= crane.dropCol + 0.18 && crane.x >= crane.dropCol - 0.4
          : crane.x >= crane.dropCol - 0.18 && crane.x <= crane.dropCol + 0.4;
      const canDrop = crane.cargo === "heart" || !dropBlocked(state, crane.dropCol);
      if (atDrop && canDrop) {
        releaseCraneCargo(state, crane);
      } else {
        if (crane.cargo !== "heart" && dropBlocked(state, crane.dropCol)) retargetDrop(state, crane);
        const passed = crane.dir < 0 ? crane.x < crane.dropCol - 0.45 : crane.x > crane.dropCol + 0.45;
        if (passed) {
          retargetDrop(state, crane);
          const behind = crane.dir < 0 ? crane.dropCol > crane.x + 0.2 : crane.dropCol < crane.x - 0.2;
          if (behind) crane.dir = crane.dir < 0 ? 1 : -1;
        }
      }
    }

    if (crane.carrying) bounceLoadedCrane(state, crane);
    else {
      const offscreen = crane.dir < 0 ? crane.x < craneLeftX() : crane.x > craneRightX();
      if (offscreen) recycleCrane(state, crane);
    }
  }
}

function applyCrateGravity(state: GameState) {
  const ordered = [...state.crates].sort((a, b) => a.row - b.row);
  for (const crate of ordered) {
    if (crate.moving) continue;
    if (supported(state, crate.col, crate.row, crate.id)) continue;
    const dest = crate.row - 1;
    if (rowsTooClose([crate.row, dest], fallingRowsInCol(state, crate.col, crate.id))) continue;
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
  syncLocalBest(state);
}

export function revivePlayer(state: GameState): boolean {
  if (state.phase !== "dead") return false;
  const crushed = state.crates.find((crate) => crate.crushTo != null);
  if (crushed) {
    state.crates = state.crates.filter((item) => item.id !== crushed.id);
    for (let i = 0; i < 10; i += 1) {
      state.particles.push({
        x: crushed.col + 0.5,
        y: crushed.row + 0.5,
        vx: (Math.random() - 0.5) * 0.014,
        vy: 0.003 + Math.random() * 0.012,
        life: 320 + Math.random() * 180,
        max: 560,
      });
    }
  }
  const p = state.player;
  p.pose = "idle";
  p.moving = false;
  p.animT = 1;
  p.jumpT = 0;
  p.pushHold = 0;
  state.phase = "playing";
  state.deathT = 0;
  state.flash = 0.2;
  state.shake = 4;
  return true;
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
  const p = state.player;
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
  if (falling && rowsTooClose([crate.row, crate.fromRow], fallingRowsInCol(state, dest, crate.id))) return false;
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

const FIREWORK_COLORS = ["#ff4d6d", "#ffd166", "#06d6a0", "#4cc9f0", "#f72585", "#ffffff", "#ffe566"];

function spawnFireworkRocket(state: GameState) {
  const pane = windowPane();
  state.fireworks.push({
    x: 36 + Math.random() * (CANVAS_W - 72),
    y: pane.y + pane.h - 8,
    vx: (Math.random() - 0.5) * 0.05,
    vy: -0.46 - Math.random() * 0.16,
    life: 560,
    max: 560,
    color: "#fff6a8",
    size: 4,
    kind: "rocket",
  });
}

function explodeFirework(state: GameState, rocket: FireworkSpark) {
  const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)] ?? "#ffe566";
  const count = 16 + Math.floor(Math.random() * 12);
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25;
    const speed = 0.11 + Math.random() * 0.2;
    state.fireworks.push({
      x: rocket.x,
      y: rocket.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.72,
      life: 640 + Math.random() * 420,
      max: 980,
      color,
      size: 3 + Math.random() * 3,
      kind: "spark",
    });
  }
}

function updateFireworks(state: GameState, dt: number) {
  if (state.celebration > 0.18 && (state.phase === "playing" || state.phase === "dead")) {
    state.fireworkWait -= dt;
    if (state.fireworkWait <= 0) {
      spawnFireworkRocket(state);
      if (Math.random() < 0.7) spawnFireworkRocket(state);
      if (Math.random() < 0.35) spawnFireworkRocket(state);
      state.fireworkWait = 70 + Math.random() * 140;
    }
  }
  const living: FireworkSpark[] = [];
  const rockets: FireworkSpark[] = [];
  for (const spark of state.fireworks) {
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vy += (spark.kind === "rocket" ? 0.00062 : 0.0003) * dt;
    spark.life -= dt;
    if (spark.kind === "rocket" && (spark.life <= 0 || spark.vy >= -0.04)) rockets.push(spark);
    else if (spark.life > 0) living.push(spark);
  }
  state.fireworks = living;
  for (const rocket of rockets) explodeFirework(state, rocket);
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
  applyLifeRegen(state);
  state.shake = Math.max(0, state.shake - dt * 0.028);
  state.flash = Math.max(0, state.flash - dt * 0.004);
  if (state.phase !== "title" && state.phase !== "paused") {
    if (state.score > state.globalBestAtStart) {
      state.celebration = Math.min(1, state.celebration + dt / 750);
      state.sunset = Math.max(0, state.sunset - dt / 500);
    } else if (state.score > state.recordAtStart) {
      state.sunset = Math.min(1, state.sunset + dt / 1100);
    }
  }
  updateParticles(state, dt);
  if (state.phase !== "paused") {
    updateSkyClouds(state, dt);
    updateBannerPlane(state, dt);
    updateWeather(state, dt);
    updateFireworks(state, dt);
  }

  if (state.phase === "title" || state.phase === "paused") return;

  if (state.phase === "dead") {
    stepAnim(state.player, dt);
    for (const crate of state.crates) {
      if (crate.crushTo != null) stepCrushSettle(crate, dt);
      else stepAnim(crate, dt);
    }
    updateFallingHearts(state, dt, false);
    state.deathT -= dt;
    return;
  }

  updateCranes(state, dt);
  updateFallingHearts(state, dt, true);
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

  if (bottomRowFull(state)) {
    burstRow(state);
    applyCrateGravity(state);
    playerGravity(state);
  }
}

export function isGameOverVisible(state: GameState): boolean {
  return state.phase === "dead" && state.deathT <= 0;
}
