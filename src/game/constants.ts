export const COLS = 10;
export const ROWS = 7;
export const CELL = 80;

export const CANVAS_W = 800;
export const CANVAS_H = 640;

export const ORIGIN_X = 0;
export const ORIGIN_Y = 36;

export const WALK_MS = 290;
export const PUSH_MS = 400;
export const JUMP_MS = 420;
export const FALL_MS = 260;
export const CRATE_FALL_MS = 210;
export const CRATE_SLIDE_MS = 400;
export const EXPLODE_MS = 560;
export const DEATH_MS = 900;
export const JUMP_AIR_MS = 840;
export const CRANE_DROP_MS = 420;
export const CRATE_SCALE = 1;

export const MAX_CRANES = 5;
export const HIGH_SCORE_KEY = "stack-attack-highscore";

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
  crate: "#c4922a",
  crateDark: "#6b4a14",
  crateLight: "#d4a54a",
  crateBand: "#2c2418",
  gold: "#fcee4b",
  goldDark: "#c9a227",
  skin: "#c48a5a",
  skinLight: "#e0b080",
  skinDark: "#9a6840",
  hair: "#2a1a0c",
  shirt: "#00aaaa",
  shirtDark: "#007878",
  pants: "#3c44aa",
  pantsDark: "#2a3080",
  shoe: "#2b2b2b",
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
  if (score >= 90) return 5;
  if (score >= 65) return 4;
  if (score >= 45) return 3;
  if (score >= 18) return 2;
  return 1;
}
