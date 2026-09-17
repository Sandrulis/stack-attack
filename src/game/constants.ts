export const COLS = 10;
export const ROWS = 6;
export const CELL = 80;

export const CANVAS_W = 800;
export const CANVAS_H = 640;

export const ORIGIN_X = 0;
export const ORIGIN_Y = 36 + CELL;

export const WALK_MS = 290;
export const PUSH_MS = 400;
export const JUMP_MS = 360;
export const FALL_MS = 260;
export const CRATE_FALL_MS = 210;
export const CRATE_SLIDE_MS = 400;
export const EXPLODE_MS = 560;
export const DEATH_MS = 900;
export const CRUSH_HIT_ROW = 0.85;
export const CRUSH_REST_ROW = 0.2;
export const CRUSH_SETTLE_MS = 160;
export const CRANE_DROP_MS = 420;
export const CRATE_SCALE = 1;

export const MAX_CRANES = 4;
export const MAX_LIVES = 5;
export const START_LIVES = 1;
export const HEART_REGEN_MS = 24 * 60 * 60 * 1000;
export const HIGH_SCORE_KEY = "stack-attack-highscore";
export const LIVES_KEY = "boxdrop-lives-v2";

export const PALETTE = {
  skyTop: "#78a7ff",
  skyBottom: "#b4d4ff",
  cloud: "#f4f7fb",
  cloudDark: "#d7e0ea",
  sun: "#ffe566",
  sunDark: "#e6b422",
  stone: "#7a7a7a",
  stoneLight: "#9a9a9a",
  stoneDark: "#555555",
  grout: "#3b3b3b",
  grass: "#5d9c3d",
  grassLight: "#79c05a",
  grassDark: "#3d6e28",
  dirt: "#866043",
  dirtDark: "#5c4028",
  dirtLight: "#a07850",
  iron: "#c6c6c6",
  ironDark: "#7a7a7a",
  glass: "rgba(170, 220, 255, 0.28)",
  glassEdge: "rgba(230, 248, 255, 0.55)",
  crate: "#b57922",
  crateDark: "#2e2e2e",
  crateLight: "#c4922a",
  crateBand: "#3a3a3a",
  gold: "#fcee4b",
  goldDark: "#c9a227",
  skin: "#e8bc98",
  skinLight: "#f6d7bd",
  skinDark: "#c99270",
  hair: "#b06c3a",
  hairDark: "#7a4a28",
  shirt: "#2f3650",
  shirtLight: "#4a5470",
  shirtDark: "#232838",
  pants: "#2c3348",
  pantsDark: "#1e2333",
  hat: "#2a3148",
  hatLight: "#4a5470",
  hatDark: "#1a1e2c",
  undershirt: "#efece8",
  shoe: "#f4f5f7",
  shoeDark: "#8b909a",
  crane: "#fcee4b",
  craneDark: "#8b8b8b",
  hook: "#c6c6c6",
  accent: "#55ff55",
  danger: "#ff5555",
  text: "#f4f4f4",
  glow: "#ffe566",
  windowFrame: "#4a4a4a",
};

export function gridToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: ORIGIN_X + col * CELL,
    y: ORIGIN_Y + (ROWS - 1 - row) * CELL,
  };
}

export function craneThreshold(score: number): number {
  if (score >= 65) return 4;
  if (score >= 45) return 3;
  if (score >= 18) return 2;
  return 1;
}

export function windowPane(): { y: number; h: number } {
  return {
    y: ORIGIN_Y - CELL + 10,
    h: (ROWS * CELL + CELL) * 0.52,
  };
}
