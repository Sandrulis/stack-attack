import {
  CANVAS_H,
  CANVAS_W,
  CELL,
  COLS,
  CRATE_SCALE,
  ORIGIN_X,
  ORIGIN_Y,
  PALETTE,
  ROWS,
  gridToScreen,
} from "./constants";
import type { GameState, Player } from "./engine";
import { visualPos } from "./engine";

function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  mid: string,
  light?: string,
  dark?: string,
) {
  ctx.fillStyle = mid;
  ctx.fillRect(x, y, w, h);
  if (light) {
    ctx.fillStyle = light;
    ctx.fillRect(x, y, w, Math.max(2, Math.round(h * 0.12)));
    ctx.fillRect(x, y, Math.max(2, Math.round(w * 0.1)), h);
  }
  if (dark) {
    ctx.fillStyle = dark;
    ctx.fillRect(x + w - Math.max(2, Math.round(w * 0.12)), y, Math.max(2, Math.round(w * 0.12)), h);
    ctx.fillRect(x, y + h - Math.max(2, Math.round(h * 0.1)), w, Math.max(2, Math.round(h * 0.1)));
  }
}

export function drawGame(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.imageSmoothingEnabled = false;
  const shakeX = state.shake ? (Math.random() - 0.5) * state.shake : 0;
  const shakeY = state.shake ? (Math.random() - 0.5) * state.shake : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawWorld(ctx);
  drawCranes(ctx, state);
  drawCrates(ctx, state);
  if (state.phase === "exploding") drawExplosion(ctx, state);
  drawPlayer(ctx, state.player, state.time);
  drawParticles(ctx, state);
  drawPopups(ctx, state);
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 229, 102, ${state.flash * 0.28})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  box(ctx, 620, 18, 42, 42, PALETTE.sun, "#fff6a8", PALETTE.sunDark);
  drawCloud(ctx, 70, 22, 3);
  drawCloud(ctx, 280, 10, 4);
  drawCloud(ctx, 510, 28, 3);

  drawStoneWall(ctx);
  drawWindows(ctx);
  drawRails(ctx);
  drawGrassFloor(ctx);

  for (let col = 0; col <= COLS; col += 1) {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(ORIGIN_X + col * CELL, ORIGIN_Y, 1, ROWS * CELL);
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, n: number) {
  for (let i = 0; i < n; i += 1) {
    box(ctx, x + i * 22, y + (i % 2) * 8, 28, 18, PALETTE.cloud, "#ffffff", PALETTE.cloudDark);
  }
}

function drawStoneWall(ctx: CanvasRenderingContext2D) {
  const t = 20;
  for (let row = 0, y = 0; y < CANVAS_H; y += t, row += 1) {
    const ox = row % 2 === 0 ? 0 : -t / 2;
    for (let x = ox; x < CANVAS_W; x += t) {
      const n = hash(row * 97 + x * 13);
      const mid = n > 0.66 ? PALETTE.stoneLight : n > 0.33 ? PALETTE.stone : PALETTE.stoneDark;
      ctx.fillStyle = PALETTE.grout;
      ctx.fillRect(x, y, t, t);
      ctx.fillStyle = mid;
      ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
      if (n > 0.8) {
        ctx.fillStyle = PALETTE.stoneLight;
        ctx.fillRect(x + 3, y + 3, 4, 3);
      }
    }
  }
}

function drawWindows(ctx: CanvasRenderingContext2D) {
  const pad = 10;
  const gaps = 8;
  const count = 3;
  const totalW = CANVAS_W - pad * 2;
  const winW = (totalW - gaps * (count - 1)) / count;
  const winH = ROWS * CELL * 0.52;
  const winY = ORIGIN_Y + 10;
  for (let i = 0; i < count; i += 1) {
    const x = pad + i * (winW + gaps);
    box(ctx, x - 6, winY - 6, winW + 12, winH + 12, PALETTE.windowFrame, PALETTE.iron, PALETTE.grout);
    const sky = ctx.createLinearGradient(x, winY, x, winY + winH);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(x, winY, winW, winH);
    ctx.fillStyle = PALETTE.glass;
    ctx.fillRect(x, winY, winW, winH);
    ctx.fillStyle = PALETTE.glassEdge;
    ctx.fillRect(x, winY, winW, 8);
    ctx.fillStyle = PALETTE.windowFrame;
    ctx.fillRect(x + winW / 2 - 2, winY, 4, winH);
    ctx.fillRect(x, winY + winH / 2 - 2, winW, 4);
  }
}

function drawRails(ctx: CanvasRenderingContext2D) {
  const y = ORIGIN_Y - 28;
  ctx.fillStyle = PALETTE.grout;
  ctx.fillRect(0, y + 6, CANVAS_W, 10);
  ctx.fillStyle = PALETTE.ironDark;
  ctx.fillRect(0, y + 8, CANVAS_W, 3);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(0, y + 12, CANVAS_W, 2);
  for (let x = 8; x < CANVAS_W; x += 28) {
    box(ctx, x, y, 8, 18, PALETTE.iron, PALETTE.iron, PALETTE.ironDark);
  }
}

function drawGrassFloor(ctx: CanvasRenderingContext2D) {
  const floorY = ORIGIN_Y + ROWS * CELL;
  const t = 20;
  for (let x = 0; x < CANVAS_W; x += t) {
    const n = hash(x * 7);
    box(ctx, x, floorY, t, CANVAS_H - floorY, PALETTE.dirt, PALETTE.dirtLight, PALETTE.dirtDark);
    ctx.fillStyle = n > 0.5 ? PALETTE.grassLight : PALETTE.grass;
    ctx.fillRect(x, floorY, t, 10);
    ctx.fillStyle = PALETTE.grassDark;
    ctx.fillRect(x, floorY + 8, t, 3);
  }
}

function drawCranes(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const crane of state.cranes) {
    const x = ORIGIN_X + crane.x * CELL;
    if (x < -CELL || x > CANVAS_W + CELL) continue;
    const railY = ORIGIN_Y - 40;
    box(ctx, x - 4, railY, CELL + 8, 22, PALETTE.iron, PALETTE.iron, PALETTE.ironDark);
    box(ctx, x + 10, railY - 10, CELL - 20, 14, PALETTE.gold, "#fff6a8", PALETTE.goldDark);
    const hookY = railY + (crane.dropping > 0 ? 52 : 30);
    ctx.fillStyle = PALETTE.ironDark;
    ctx.fillRect(x + CELL / 2 - 2, railY + 22, 4, hookY - railY - 14);
    box(ctx, x + CELL / 2 - 12, hookY, 24, 10, PALETTE.iron, PALETTE.iron, PALETTE.grout);
    if (crane.carrying) {
      drawCrateSprite(ctx, x, hookY + 8, CRATE_SCALE);
    }
  }
}

function drawCrates(ctx: CanvasRenderingContext2D, state: GameState) {
  const sorted = [...state.crates].sort((a, b) => b.row - a.row);
  for (const crate of sorted) {
    if (state.phase === "exploding" && crate.row === 0) continue;
    const pos = visualPos(crate);
    const { x, y } = gridToScreen(pos.col, pos.row);
    drawCrateSprite(ctx, x, y, CRATE_SCALE);
  }
}

function drawCrateSprite(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const s = CELL * scale;
  const r = Math.max(8, Math.round(s * 0.12));
  const strapH = Math.max(6, Math.round(s * 0.08));
  const strapY = y + Math.round(s * 0.36);
  const latchW = Math.max(8, Math.round(s * 0.12));
  const latchH = Math.max(18, Math.round(s * 0.24));
  const latchX = x + (s - latchW) / 2;
  const latchY = strapY + strapH / 2 - latchH / 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, r);
  ctx.fillStyle = PALETTE.crate;
  ctx.fill();
  ctx.clip();

  ctx.fillStyle = PALETTE.crateBand;
  ctx.fillRect(x, strapY, s, strapH);

  ctx.fillStyle = "#6a6a6a";
  ctx.fillRect(latchX, latchY, latchW / 2, latchH);
  ctx.fillStyle = "#d0d0d0";
  ctx.fillRect(latchX + latchW / 2, latchY, Math.ceil(latchW / 2), latchH);
  ctx.fillStyle = "#8d8d8d";
  ctx.fillRect(latchX + latchW / 2 - 1, latchY, 2, latchH);
  ctx.restore();
}

function drawExplosion(ctx: CanvasRenderingContext2D, state: GameState) {
  const pulse = 0.55 + Math.sin(state.time / 40) * 0.45;
  for (let col = 0; col < COLS; col += 1) {
    const { x, y } = gridToScreen(col, 0);
    box(ctx, x + 8, y + 8, CELL - 16, CELL - 16, `rgba(255, 85, 85, ${pulse})`, PALETTE.gold, "#7a0000");
    box(ctx, x + 22, y + 22, CELL - 44, CELL - 44, PALETTE.gold, "#fff6a8", PALETTE.goldDark);
  }
}

function voxelLimb(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  angle: number,
  w: number,
  len: number,
  mid: string,
  light: string,
  dark: string,
  tip?: string,
) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(angle);
  box(ctx, -w / 2, 0, w, len, mid, light, dark);
  if (tip) box(ctx, -w / 2, len - 8, w, 8, tip, tip, dark);
  ctx.restore();
}

function voxelArm(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  upperAngle: number,
  elbowBend: number,
  w: number,
  upperLen: number,
  lowerLen: number,
  sleeve: string,
  sleeveLight: string,
  sleeveDark: string,
  skin: string,
  skinDark: string,
) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(upperAngle);
  box(ctx, -w / 2, 0, w, upperLen, sleeve, sleeveLight, sleeveDark);
  ctx.translate(0, upperLen - 4);
  ctx.rotate(elbowBend);
  box(ctx, -w / 2, 0, w, lowerLen - 8, PALETTE.skin, PALETTE.skinLight, skinDark);
  box(ctx, -w / 2 - 1, lowerLen - 10, w + 2, 10, skin, PALETTE.skinLight, skinDark);
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, time: number) {
  const pos = visualPos(player);
  const { x, y } = gridToScreen(pos.col, pos.row);
  const facing = player.facing;
  const walking = player.pose === "walk" || player.walkHold > 0;
  const jump = player.pose === "jump" || player.jumpT > 0;
  const push = player.pose === "push" || player.pushHold > 0;
  const fall = player.pose === "fall";
  const dead = player.pose === "dead";
  const cx = x + CELL / 2;

  if (dead) {
    ctx.save();
    ctx.translate(cx, y + CELL - 18);
    box(ctx, -28, -10, 56, 16, PALETTE.shirt, PALETTE.shirt, PALETTE.shirtDark);
    box(ctx, 18, -16, 20, 20, PALETTE.skin, PALETTE.skinLight, PALETTE.hair);
    ctx.restore();
    return;
  }

  const stride = pos.col * Math.PI;
  const sw = walking && !push ? Math.sin(stride) * 0.55 : 0;
  const bob = jump ? -14 : push ? Math.sin(time / 170) * 1.6 : walking ? Math.abs(Math.cos(stride)) * 2 : 0;
  const strain = Math.sin(time / 180);

  let leftLeg = 0.06;
  let rightLeg = -0.04;
  let leftArm = -0.08;
  let rightArm = 0.08;

  if (push) {
    leftLeg = 0.34 + strain * 0.1;
    rightLeg = -0.28 - strain * 0.08;
  } else if (walking) {
    leftLeg = sw;
    rightLeg = -sw;
    leftArm = -sw * 0.9;
    rightArm = sw * 0.9;
  } else if (jump || fall) {
    leftLeg = -0.45;
    rightLeg = 0.45;
    leftArm = -2.4;
    rightArm = -2.2;
  }

  ctx.save();
  ctx.translate(cx, y + CELL - 4 + bob);
  ctx.scale(facing * 1.12, 1.12);
  if (push) {
    ctx.translate(8, 3);
    ctx.rotate(-0.16);
  }
  ctx.translate(0, -76);

  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(-12, 74, 24, 5);

  if (push) {
    voxelArm(
      ctx,
      -7,
      22,
      -0.95 - strain * 0.06,
      -0.72,
      10,
      16,
      22,
      PALETTE.shirt,
      PALETTE.skinLight,
      PALETTE.shirtDark,
      PALETTE.skin,
      PALETTE.skinDark,
    );
  } else {
    voxelLimb(ctx, -6, 22, leftArm, 10, 28, PALETTE.shirt, PALETTE.skinLight, PALETTE.shirtDark, PALETTE.skin);
  }
  voxelLimb(ctx, -5, 44, leftLeg, 10, 30, PALETTE.pants, PALETTE.pants, PALETTE.pantsDark, PALETTE.shoe);

  box(ctx, -10, 20, 20, 26, PALETTE.shirt, PALETTE.shirt, PALETTE.shirtDark);
  box(ctx, -10, 42, 20, 8, PALETTE.pants, PALETTE.pants, PALETTE.pantsDark);

  voxelLimb(ctx, 5, 44, rightLeg, 10, 30, PALETTE.pants, PALETTE.pants, PALETTE.pantsDark, PALETTE.shoe);
  if (push) {
    voxelArm(
      ctx,
      7,
      21,
      -1.12 - strain * 0.08,
      -0.62,
      10,
      15,
      24,
      PALETTE.shirt,
      PALETTE.skinLight,
      PALETTE.shirtDark,
      PALETTE.skin,
      PALETTE.skinDark,
    );
  } else {
    voxelLimb(ctx, 6, 22, rightArm, 10, 28, PALETTE.shirt, PALETTE.skinLight, PALETTE.shirtDark, PALETTE.skin);
  }

  box(ctx, -11, 0, 22, 22, PALETTE.skin, PALETTE.skinLight, PALETTE.skinDark);
  ctx.fillStyle = PALETTE.hair;
  ctx.fillRect(-11, 0, 22, 8);
  ctx.fillRect(-11, 0, 6, 16);
  ctx.fillStyle = "#fff";
  ctx.fillRect(5, 10, 5, 5);
  ctx.fillStyle = "#3b2314";
  ctx.fillRect(7, 12, 3, 3);
  ctx.fillStyle = PALETTE.skinDark;
  ctx.fillRect(9, 15, 3, 3);
  ctx.fillStyle = PALETTE.shoe;
  ctx.fillRect(8, 17, 5, 2);

  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const part of state.particles) {
    const { x, y } = gridToScreen(part.x, part.y);
    const s = part.life > 200 ? 10 : 6;
    box(ctx, x, y, s, s, PALETTE.crateLight, PALETTE.gold, PALETTE.crateDark);
  }
}

function drawPopups(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.font = "700 18px ui-monospace, 'Cascadia Mono', monospace";
  ctx.fillStyle = PALETTE.accent;
  ctx.textAlign = "center";
  ctx.imageSmoothingEnabled = false;
  for (const pop of state.popups) {
    const { x, y } = gridToScreen(pop.col, pop.row);
    const rise = (1 - pop.life / 700) * 28;
    ctx.fillText(pop.text, x + CELL / 2, y - rise);
  }
}
