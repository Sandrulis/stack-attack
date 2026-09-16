import {
  CANVAS_H,
  CANVAS_W,
  CELL,
  COLS,
  CRATE_SCALE,
  DEATH_MS,
  ORIGIN_X,
  ORIGIN_Y,
  PALETTE,
  ROWS,
  gridToScreen,
} from "./constants";
import type { GameState, Player } from "./engine";
import { crateDrawInFront, visualPos } from "./engine";

function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function roundBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  mid: string,
  light?: string,
  dark?: string,
) {
  const rad = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
  ctx.fillStyle = mid;
  ctx.fill();
  if (light) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, Math.max(2, Math.round(h * 0.18)), Math.min(rad, 4));
    ctx.fillStyle = light;
    ctx.fill();
  }
  if (dark) {
    ctx.fillStyle = dark;
    ctx.fillRect(x + w - Math.max(2, Math.round(w * 0.14)), y + rad * 0.3, Math.max(2, Math.round(w * 0.14)), h - rad * 0.6);
    ctx.fillRect(x + 1, y + h - Math.max(2, Math.round(h * 0.12)), w - 2, Math.max(2, Math.round(h * 0.12)));
  }
}

function oval(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, fill: string) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
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
  drawWorld(ctx, state);
  drawCranes(ctx, state);
  drawCrates(ctx, state, false);
  drawPlayer(ctx, state.player, state.time, state.deathT);
  drawCrates(ctx, state, true);
  drawParticles(ctx, state);
  drawPopups(ctx, state);
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 229, 102, ${state.flash * 0.28})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, state: GameState) {
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
  drawWindows(ctx, state);
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

function drawWindows(ctx: CanvasRenderingContext2D, state: GameState) {
  const pad = 10;
  const gaps = 8;
  const count = 3;
  const totalW = CANVAS_W - pad * 2;
  const winW = (totalW - gaps * (count - 1)) / count;
  const winH = (ROWS * CELL + CELL) * 0.52;
  const winY = ORIGIN_Y - CELL + 10;
  const t = Math.max(0, Math.min(1, state.sunset));
  const storm = Math.max(0, Math.min(1, state.storm)) * (1 - t);
  for (let i = 0; i < count; i += 1) {
    const x = pad + i * (winW + gaps);
    box(ctx, x - 6, winY - 6, winW + 12, winH + 12, PALETTE.windowFrame, PALETTE.iron, PALETTE.grout);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, winY, winW, winH);
    ctx.clip();
    const day = ctx.createLinearGradient(x, winY, x, winY + winH);
    day.addColorStop(0, PALETTE.skyTop);
    day.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = day;
    ctx.fillRect(x, winY, winW, winH);
    if (storm > 0) {
      ctx.globalAlpha = storm;
      const dusk = ctx.createLinearGradient(x, winY, x, winY + winH);
      dusk.addColorStop(0, "#151b28");
      dusk.addColorStop(0.45, "#2a3346");
      dusk.addColorStop(1, "#3d4558");
      ctx.fillStyle = dusk;
      ctx.fillRect(x, winY, winW, winH);
      if (state.stormFlash > 0) {
        ctx.fillStyle = `rgba(235, 245, 255, ${0.42 * state.stormFlash})`;
        ctx.fillRect(x, winY, winW, winH);
      }
      ctx.globalAlpha = 1;
    }
    if (t > 0) {
      ctx.globalAlpha = t;
      const dusk = ctx.createLinearGradient(x, winY, x, winY + winH);
      dusk.addColorStop(0, "#2a1038");
      dusk.addColorStop(0.38, "#a32248");
      dusk.addColorStop(0.7, "#e24a28");
      dusk.addColorStop(1, "#ffb15a");
      ctx.fillStyle = dusk;
      ctx.fillRect(x, winY, winW, winH);
      drawSunsetSun(ctx, winY, winH);
      ctx.globalAlpha = 1;
    }
    drawWindowClouds(ctx, state, winY, storm);
    drawRain(ctx, state, storm);
    ctx.restore();
    ctx.fillStyle =
      t > 0 ? `rgba(255, 140, 80, ${0.12 * t})` : storm > 0.12 ? `rgba(30, 40, 58, ${0.2 * storm})` : PALETTE.glass;
    ctx.fillRect(x, winY, winW, winH);
    ctx.fillStyle = PALETTE.glassEdge;
    ctx.fillRect(x, winY, winW, 8);
    ctx.fillStyle = PALETTE.windowFrame;
    ctx.fillRect(x + winW / 2 - 2, winY, 4, winH);
    ctx.fillRect(x, winY + winH / 2 - 2, winW, 4);
  }
}

function drawWindowClouds(ctx: CanvasRenderingContext2D, state: GameState, winY: number, storm: number) {
  const mid = storm > 0.15 ? "#8b93a3" : "#ffffff";
  const light = storm > 0.15 ? "#a8b0be" : "#ffffff";
  const dark = storm > 0.15 ? "#5c6473" : PALETTE.cloudDark;
  for (const cloud of state.skyClouds) {
    const s = cloud.scale;
    const gap = 16 * s;
    const puffW = 26 * s;
    const puffH = 18 * s;
    for (let i = 0; i < cloud.puffs; i += 1) {
      const px = cloud.x + i * gap;
      const py = winY + cloud.y + (i % 2) * (7 * s);
      box(ctx, px, py, puffW, puffH, mid, light, dark);
    }
    for (let i = 1; i < cloud.puffs - 1; i += 1) {
      box(
        ctx,
        cloud.x + i * gap + 2 * s,
        winY + cloud.y - 10 * s,
        puffW * 0.82,
        puffH * 0.85,
        mid,
        light,
        dark,
      );
    }
  }
}

function drawRain(ctx: CanvasRenderingContext2D, state: GameState, storm: number) {
  if (storm < 0.05) return;
  ctx.strokeStyle = `rgba(200, 220, 245, ${0.38 + 0.28 * storm})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const drop of state.rain) {
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x - 3, drop.y + drop.len);
  }
  ctx.stroke();
}

function drawSunsetSun(ctx: CanvasRenderingContext2D, winY: number, winH: number) {
  const cx = CANVAS_W * 0.55;
  const cy = winY + winH + 6;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "rgba(255, 90, 40, 0.28)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 130, 78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff5a28";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 62, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff9a48";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 42, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 18, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRails(ctx: CanvasRenderingContext2D) {
  const y = ORIGIN_Y - CELL - 28;
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
    if (x < -CELL * 1.4 || x > CANVAS_W + CELL * 1.4) continue;
    const railY = ORIGIN_Y - CELL - 40;
    ctx.save();
    if (crane.dir > 0) {
      ctx.translate(x + CELL / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(x + CELL / 2), 0);
    }
    box(ctx, x - 4, railY, CELL + 8, 22, PALETTE.iron, PALETTE.iron, PALETTE.ironDark);
    box(ctx, x + 10, railY - 10, CELL - 20, 14, PALETTE.gold, "#fff6a8", PALETTE.goldDark);
    const hookY = railY + (crane.dropping > 0 ? 52 : 30);
    ctx.fillStyle = PALETTE.ironDark;
    ctx.fillRect(x + CELL / 2 - 2, railY + 22, 4, hookY - railY - 14);
    box(ctx, x + CELL / 2 - 12, hookY, 24, 10, PALETTE.iron, PALETTE.iron, PALETTE.grout);
    if (crane.carrying) {
      drawCrateSprite(ctx, x, hookY + 8, CRATE_SCALE);
    }
    ctx.restore();
  }
}

function drawCrates(ctx: CanvasRenderingContext2D, state: GameState, front: boolean) {
  const sorted = [...state.crates].sort((a, b) => b.row - a.row);
  for (const crate of sorted) {
    if (crateDrawInFront(state, crate) !== front) continue;
    const pos = visualPos(crate);
    const { x, y } = gridToScreen(pos.col, pos.row);
    drawCrateSprite(ctx, x, y, CRATE_SCALE);
  }
}

function drawCrateSprite(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const s = CELL * scale;
  const border = Math.max(4, Math.round(s * 0.08));
  const inner = s - border * 2;
  const strapH = Math.max(5, Math.round(s * 0.07));
  const strapY = y + border + Math.round(inner * 0.32);
  const latchW = Math.max(8, Math.round(s * 0.11));
  const latchH = Math.max(16, Math.round(s * 0.22));
  const latchX = x + (s - latchW) / 2;
  const latchY = strapY + strapH / 2 - latchH / 2;

  ctx.fillStyle = PALETTE.crateDark;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = PALETTE.crate;
  ctx.fillRect(x + border, y + border, inner, inner);

  ctx.fillStyle = PALETTE.crateBand;
  ctx.fillRect(x + border, strapY, inner, strapH);

  const half = Math.floor(latchW / 2);
  ctx.fillStyle = "#c8bec0";
  ctx.fillRect(latchX, latchY, half, latchH);
  ctx.fillStyle = "#7a7a7a";
  ctx.fillRect(latchX + half, latchY, latchW - half, latchH);
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
  roundBox(ctx, -w / 2, 0, w, len, w / 2, mid, light, dark);
  if (tip) {
    roundBox(ctx, -w / 2 - 1, len - 9, w + 2, 11, 5, tip, "#fff", PALETTE.shoeDark);
    roundBox(ctx, -w / 2, len - 2, w, 4, 2, PALETTE.shoeDark);
  }
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
  roundBox(ctx, -w / 2, 0, w, upperLen, w / 2, sleeve, sleeveLight, sleeveDark);
  ctx.translate(0, upperLen - 4);
  ctx.rotate(elbowBend);
  roundBox(ctx, -w / 2, 0, w, lowerLen - 8, w / 2, PALETTE.skin, PALETTE.skinLight, skinDark);
  roundBox(ctx, -w / 2 - 1, lowerLen - 11, w + 2, 12, 6, skin, PALETTE.skinLight, skinDark);
  ctx.restore();
}

function drawXEye(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.strokeStyle = "#2a241c";
  ctx.lineWidth = 2.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 3.4, cy - 3.2);
  ctx.lineTo(cx + 3.4, cy + 3.2);
  ctx.moveTo(cx + 3.4, cy - 3.2);
  ctx.lineTo(cx - 3.4, cy + 3.2);
  ctx.stroke();
}

function drawCap(ctx: CanvasRenderingContext2D) {
  roundBox(ctx, -15, 0, 30, 12, 3, PALETTE.hat, PALETTE.hatLight, PALETTE.hatDark);
  roundBox(ctx, 5, 8, 17, 5, 2, PALETTE.hat, PALETTE.hatLight, PALETTE.hatDark);
  roundBox(ctx, 2, 3, 7, 4, 1, PALETTE.undershirt);
  roundBox(ctx, -2, -1, 4, 3, 1, PALETTE.hatLight);
}

function drawKidHead(ctx: CanvasRenderingContext2D, crushed: boolean, squash = 0) {
  ctx.save();
  ctx.scale(1, 1 - squash * 0.2);

  roundBox(ctx, -16, 8, 10, 12, 2, PALETTE.hair, PALETTE.hair, PALETTE.hairDark);
  roundBox(ctx, 10, 7, 10, 12, 2, PALETTE.hair, PALETTE.hair, PALETTE.hairDark);
  roundBox(ctx, -14, 16, 8, 10, 2, PALETTE.hairDark);

  roundBox(ctx, -17, 12, 5, 8, 2, PALETTE.skin, PALETTE.skinLight, PALETTE.skinDark);
  roundBox(ctx, -14, 4, 30, 26, 4, PALETTE.skin, PALETTE.skinLight, PALETTE.skinDark);

  if (crushed) {
    drawXEye(ctx, -4, 16);
    drawXEye(ctx, 8, 16);
    ctx.fillStyle = PALETTE.danger;
    roundBox(ctx, 3, 22, 8, 4, 1, PALETTE.danger);
  } else {
    roundBox(ctx, -6, 12, 7, 8, 2, "#fff");
    roundBox(ctx, -4, 14, 3, 4, 1, "#2a241c");
    roundBox(ctx, 4, 12, 8, 8, 2, "#fff");
    roundBox(ctx, 7, 14, 3, 4, 1, "#2a241c");
    roundBox(ctx, -4, 13, 2, 2, 1, "#fff");
    roundBox(ctx, 8, 13, 2, 2, 1, "#fff");

    ctx.strokeStyle = PALETTE.hairDark;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "square";
    ctx.beginPath();
    ctx.moveTo(-6, 10);
    ctx.lineTo(0, 11);
    ctx.moveTo(5, 10);
    ctx.lineTo(12, 9);
    ctx.stroke();

    roundBox(ctx, 4, 18, 4, 3, 1, PALETTE.skinDark);

    ctx.strokeStyle = PALETTE.skinDark;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(2, 22);
    ctx.lineTo(9, 22);
    ctx.stroke();
  }

  drawCap(ctx);
  ctx.restore();
}

function drawCrushedPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  deathT: number,
) {
  const elapsed = Math.max(0, DEATH_MS - deathT);
  const squash = Math.min(1, elapsed / 200);
  const k = squash * squash * (3 - 2 * squash);
  const pop = Math.min(1, Math.max(0, (elapsed - 40) / 180));
  const wobble = pop > 0.95 ? Math.sin(elapsed / 55) * 1.2 : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.translate(x + CELL / 2 + wobble, y + CELL);

  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(0, -4, 38, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const shoeSpread = 8 + k * 20;
  roundBox(ctx, -shoeSpread - 12, -9, 16, 8, 4, PALETTE.shoe, "#fff", PALETTE.shoeDark);
  roundBox(ctx, shoeSpread - 4, -9, 16, 8, 4, PALETTE.shoe, "#fff", PALETTE.shoeDark);

  const pantsW = 20 + k * 28;
  const pantsH = 20 - k * 14;
  roundBox(ctx, -pantsW / 2, -9 - pantsH, pantsW, pantsH, 8, PALETTE.pants, PALETTE.pants, PALETTE.pantsDark);

  const shirtW = 22 + k * 34;
  const shirtH = 24 - k * 16;
  const shirtY = -9 - pantsH - shirtH + k * 6;
  roundBox(ctx, -shirtW / 2, shirtY, shirtW, shirtH, 8, PALETTE.shirt, PALETTE.shirtLight, PALETTE.shirtDark);
  roundBox(ctx, -shirtW / 2 + 2, shirtY + shirtH - 5, shirtW - 4, 4, 2, PALETTE.undershirt);

  voxelLimb(
    ctx,
    -shirtW / 2 + 2,
    shirtY + shirtH * 0.35,
    0.35 + k * 1.0,
    8,
    22 - k * 6,
    PALETTE.shirt,
    PALETTE.shirtLight,
    PALETTE.shirtDark,
    PALETTE.skin,
  );
  voxelLimb(
    ctx,
    shirtW / 2 - 2,
    shirtY + shirtH * 0.35,
    -0.35 - k * 1.0,
    8,
    22 - k * 6,
    PALETTE.shirt,
    PALETTE.shirtLight,
    PALETTE.shirtDark,
    PALETTE.skin,
  );

  const headX = facing * (6 + pop * 34);
  const headY = shirtY - 4 - (1 - k) * 18;
  ctx.save();
  ctx.translate(headX, headY);
  ctx.scale(facing, 1);
  drawKidHead(ctx, true, k);
  ctx.restore();

  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, time: number, deathT = 0) {
  const pos = visualPos(player, player.pose === "jump");
  const { x, y } = gridToScreen(pos.col, pos.row);
  const facing = player.facing;
  const walking = player.pose === "walk" || player.walkHold > 0;
  const jump = player.pose === "jump" && player.moving;
  const push = player.pose === "push" || player.pushHold > 0;
  const fall = player.pose === "fall";
  const dead = player.pose === "dead";
  const cx = x + CELL / 2;

  if (dead) {
    drawCrushedPlayer(ctx, x, y, facing, deathT);
    return;
  }

  const stride = pos.col * Math.PI;
  const sw = walking || push ? Math.sin(stride) * 0.7 : 0;
  const strain = Math.sin(time / 140);

  let leftLeg = 0;
  let rightLeg = 0;
  let leftArm = 0;
  let rightArm = 0;

  if (push || walking) {
    leftLeg = sw;
    rightLeg = -sw;
    if (!push) {
      leftArm = -sw * 0.85;
      rightArm = sw * 0.85;
    }
  } else if (jump || fall) {
    leftLeg = 0.72;
    rightLeg = -0.62;
    leftArm = 0.55;
    rightArm = -1.85;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.translate(cx, y + CELL + 2);
  ctx.scale(facing * 1.12, 1.12);
  if (push) {
    ctx.translate(9, 5);
    ctx.rotate(-0.16);
  } else if (jump || fall) {
    ctx.rotate(-0.18);
  }
  ctx.translate(0, -76);

  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 76, 13, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (push) {
    voxelLimb(ctx, -6, 26, -0.62, 9, 26, PALETTE.shirt, PALETTE.shirtLight, PALETTE.shirtDark, PALETTE.skin);
  } else {
    voxelLimb(ctx, -6, 22, leftArm, 10, 28, PALETTE.shirt, PALETTE.shirtLight, PALETTE.shirtDark, PALETTE.skin);
  }
  voxelLimb(ctx, -5, 44, leftLeg, 10, 30, PALETTE.pants, PALETTE.shirtLight, PALETTE.pantsDark, PALETTE.shoe);

  oval(ctx, -8, 18, 8, 8, PALETTE.shirt);
  roundBox(ctx, -12, 22, 24, 28, 9, PALETTE.shirt, PALETTE.shirtLight, PALETTE.shirtDark);
  roundBox(ctx, -7, 30, 14, 9, 4, PALETTE.shirtDark);
  roundBox(ctx, -8, 46, 16, 5, 2, PALETTE.undershirt);
  roundBox(ctx, -11, 48, 22, 10, 5, PALETTE.pants, PALETTE.shirtLight, PALETTE.pantsDark);
  roundBox(ctx, 2, 52, 8, 7, 2, PALETTE.shirtDark);

  voxelLimb(ctx, 5, 44, rightLeg, 10, 30, PALETTE.pants, PALETTE.shirtLight, PALETTE.pantsDark, PALETTE.shoe);
  if (push) {
    voxelArm(
      ctx,
      7,
      24,
      -0.82 - strain * 0.05,
      -0.36,
      10,
      15,
      25,
      PALETTE.shirt,
      PALETTE.shirtLight,
      PALETTE.shirtDark,
      PALETTE.skin,
      PALETTE.skinDark,
    );
  } else {
    voxelLimb(ctx, 6, 22, rightArm, 10, 28, PALETTE.shirt, PALETTE.shirtLight, PALETTE.shirtDark, PALETTE.skin);
  }

  drawKidHead(ctx, false);
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
