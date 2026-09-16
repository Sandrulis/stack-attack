import "./style.css";
import { unlockAudio } from "./audio";
import {
  CONFIRM_KEYS,
  Input,
  JUMP_KEYS,
  LEFT_KEYS,
  PAUSE_KEYS,
  RIGHT_KEYS,
} from "./input";
import { bindJoystick, isTouchDevice } from "./joystick";
import { STR } from "./i18n";
import { CANVAS_H, CANVAS_W, MAX_CRANES } from "./game/constants";
import {
  createGame,
  isGameOverVisible,
  startRun,
  togglePause,
  tryJump,
  tryWalk,
  updateGame,
  type GameState,
} from "./game/engine";
import { drawGame } from "./game/render";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const overlay = document.querySelector<HTMLElement>("#overlay")!;
const pauseBtn = document.querySelector<HTMLButtonElement>("#pause-btn")!;
const scoreEl = document.querySelector("#score")!;
const bestEl = document.querySelector("#best")!;
const cranesEl = document.querySelector("#cranes")!;
const ctx = canvas.getContext("2d")!;

canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
ctx.imageSmoothingEnabled = false;

const input = new Input();
const state: GameState = createGame();
const joystickEl = document.querySelector<HTMLElement>("#joystick")!;
const knobEl = document.querySelector<HTMLElement>("#joystick-knob")!;
const jumpBtn = document.querySelector<HTMLButtonElement>("#jump-btn")!;
const readStick = bindJoystick(joystickEl, knobEl, jumpBtn);
let last = performance.now();
let overlayKey = "";
let pendingJump: -1 | 0 | 1 | null = null;
let pendingJumpUntil = 0;

function syncCopy() {
  const t = STR;
  document.documentElement.lang = "en";
  document.querySelector("#subtitle")!.textContent = t.subtitle;
  document.querySelector("#score-label")!.textContent = t.score;
  document.querySelector("#best-label")!.textContent = t.best;
  document.querySelector("#legend-move")!.textContent = t.legendMove;
  document.querySelector("#legend-jump")!.textContent = t.legendJump;
  document.querySelector("#legend-pause")!.textContent = t.legendPause;
  pauseBtn.textContent = t.pause;
  jumpBtn.querySelector(".jump-btn-label")!.textContent = t.jumpBtn;
  const rotateText = document.querySelector("#rotate-text");
  if (rotateText) rotateText.textContent = t.rotate;
}

function syncHud() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
  cranesEl.innerHTML = Array.from({ length: MAX_CRANES }, (_, index) =>
    `<span class="crane-dot${index < state.cranes.length ? " on" : ""}"></span>`,
  ).join("");
}

function renderOverlay() {
  syncCopy();
  const t = STR;
  const key = [
    state.phase,
    String(isGameOverVisible(state)),
    state.phase === "dead" ? String(state.score) : "",
    String(state.best),
  ].join("|");
  if (key === overlayKey) return;
  overlayKey = key;

  if (state.phase === "title") {
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="overlay-card">
        <p class="eyebrow">${t.subtitle}</p>
        <h1>${t.title}</h1>
        <p class="how">${t.how}</p>
        <button type="button" data-act="start">${t.start}</button>
        <p class="hint">${t.hint}</p>
        <dl class="help">
          <dt>${isTouchDevice() ? t.joystick : "← →"}</dt><dd>${t.move}</dd>
          <dt>${isTouchDevice() ? t.jumpBtn : "Space"}</dt><dd>${t.jump}</dd>
          <dt>Esc</dt><dd>${t.pause}</dd>
        </dl>
      </div>
    `;
    return;
  }

  if (state.phase === "paused") {
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="overlay-card">
        <h1>${t.paused}</h1>
        <button type="button" data-act="resume">${t.resume}</button>
        <button type="button" data-act="restart" class="ghost">${t.restart}</button>
      </div>
    `;
    return;
  }

  if (isGameOverVisible(state)) {
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="overlay-card">
        <p class="eyebrow">${t.gameOver}</p>
        <h1>${state.score}</h1>
        <p class="how">${t.crushed}</p>
        <p class="hint">${t.best}: ${state.best}</p>
        <button type="button" data-act="start">${t.playAgain}</button>
      </div>
    `;
    return;
  }

  overlay.hidden = true;
  overlay.innerHTML = "";
}

function beginRun() {
  unlockAudio();
  startRun(state);
  canvas.focus();
}

overlay.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest("button[data-act]");
  if (!(btn instanceof HTMLButtonElement)) return;
  const act = btn.dataset.act;
  if (act === "start" || act === "restart") beginRun();
  if (act === "resume") togglePause(state);
  renderOverlay();
});

pauseBtn.addEventListener("click", () => {
  unlockAudio();
  if (state.phase === "playing" || state.phase === "paused") togglePause(state);
});

function handleInput() {
  const stick = readStick();
  if (input.consumeAny(PAUSE_KEYS)) {
    if (state.phase === "playing" || state.phase === "paused") togglePause(state);
  }
  if (input.consume("r") && state.phase !== "title") {
    beginRun();
  }

  if (state.phase === "title" && input.consumeAny(CONFIRM_KEYS)) {
    beginRun();
  }
  if (isGameOverVisible(state) && input.consumeAny(CONFIRM_KEYS)) {
    beginRun();
  }
  if (state.phase === "paused" && input.consumeAny(["enter"])) {
    togglePause(state);
  }

  if (state.phase !== "playing") {
    input.consumeAny(JUMP_KEYS);
    return;
  }

  const now = performance.now();
  const wantJump = input.consumeAny(JUMP_KEYS) || stick.jump;
  const left = input.holdAny(LEFT_KEYS) || stick.x < -0.28;
  const right = input.holdAny(RIGHT_KEYS) || stick.x > 0.28;

  if (wantJump) {
    pendingJump = left ? -1 : right ? 1 : 0;
    pendingJumpUntil = now + (pendingJump === 0 ? 120 : 400);
  } else if (pendingJump === 0 && now < pendingJumpUntil) {
    if (left) pendingJump = -1;
    else if (right) pendingJump = 1;
  }

  if (pendingJump !== null && now > pendingJumpUntil && pendingJump !== 0) pendingJump = null;

  if (pendingJump === -1 || pendingJump === 1) {
    if (tryJump(state, pendingJump)) {
      pendingJump = null;
      return;
    }
  } else if (pendingJump === 0) {
    if (now >= pendingJumpUntil) {
      if (state.player.pose !== "jump" && state.player.jumpT <= 0) tryJump(state, 0);
      pendingJump = null;
    }
    return;
  }

  if (left || input.consumeAny(LEFT_KEYS)) tryWalk(state, -1);
  else if (right || input.consumeAny(RIGHT_KEYS)) tryWalk(state, 1);
}

function frame(now: number) {
  const dt = Math.max(0, Math.min(48, now - last));
  last = now;
  handleInput();
  updateGame(state, dt);
  handleInput();
  drawGame(ctx, state);
  syncHud();
  renderOverlay();
  requestAnimationFrame(frame);
}

syncCopy();
syncHud();
renderOverlay();
requestAnimationFrame(frame);

document.addEventListener("pointerdown", () => unlockAudio(), { once: true });
document.addEventListener("keydown", () => unlockAudio(), { once: true });
