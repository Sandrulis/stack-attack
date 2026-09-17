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
  hydrateBest,
  isGameOverVisible,
  startRun,
  togglePause,
  tryJump,
  tryWalk,
  updateGame,
} from "./game/engine";
import { drawGame } from "./game/render";
import type { User } from "@supabase/supabase-js";
import {
  currentUser,
  finishPlayerRun,
  isSupabaseConfigured,
  isValidPlayerName,
  loadLeaderboard,
  loadPlayerStats,
  NAME_MAX,
  normalizePlayerName,
  onAuthChange,
  setPlayerName,
  signInWithGoogle,
  signOut,
  startPlayerRun,
  suggestedNameFromUser,
  type BoardRow,
  type PlayerStats,
} from "./lib/account";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const overlay = document.querySelector<HTMLElement>("#overlay")!;
const pauseBtn = document.querySelector<HTMLButtonElement>("#pause-btn")!;
const boardBtn = document.querySelector<HTMLButtonElement>("#board-btn")!;
const scoreEl = document.querySelector("#score")!;
const bestEl = document.querySelector("#best")!;
const cranesEl = document.querySelector("#cranes")!;
const ctx = canvas.getContext("2d")!;

canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
ctx.imageSmoothingEnabled = false;

const input = new Input();
const state = createGame();
const joystickEl = document.querySelector<HTMLElement>("#joystick")!;
const knobEl = document.querySelector<HTMLElement>("#joystick-knob")!;
const jumpBtn = document.querySelector<HTMLButtonElement>("#jump-btn")!;
const readStick = bindJoystick(joystickEl, knobEl, jumpBtn);
let last = performance.now();
let overlayKey = "";
let pendingJump: -1 | 0 | 1 | null = null;
let pendingJumpUntil = 0;

let authReady = !isSupabaseConfigured();
let authUser: User | null = null;
let stats: PlayerStats | null = null;
let board: BoardRow[] = [];
let authError = "";
let authBusy = false;
let beginBusy = false;
let nameBusy = false;
let runSaved = false;
let nameDraft = "";
let didFocusName = false;
let boardOpen = false;
let boardLoading = false;
let pausedForBoard = false;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return "&#39;";
  });
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function bumpOverlay() {
  overlayKey = "";
}

async function refreshBoardList() {
  if (!isSupabaseConfigured()) {
    board = [];
    bumpOverlay();
    return;
  }
  boardLoading = true;
  bumpOverlay();
  renderOverlay();
  try {
    board = await loadLeaderboard();
  } catch (error) {
    authError = errorMessage(error, STR.authError);
  } finally {
    boardLoading = false;
    bumpOverlay();
  }
}

function openBoard() {
  if (boardOpen) return;
  if (state.phase === "playing") {
    togglePause(state);
    pausedForBoard = true;
  }
  boardOpen = true;
  bumpOverlay();
  void refreshBoardList();
}

function closeBoard() {
  if (!boardOpen) return;
  boardOpen = false;
  if (pausedForBoard && state.phase === "paused") togglePause(state);
  pausedForBoard = false;
  bumpOverlay();
}

function needsUsername(): boolean {
  return Boolean(authUser && stats && !stats.nameSet);
}

function canPlay(): boolean {
  return isSupabaseConfigured() && authUser !== null && Boolean(stats?.nameSet) && !authBusy && !beginBusy && !nameBusy;
}

function nameFieldMarkup(ready: boolean): string {
  const t = STR;
  const saveLabel = ready ? t.usernameSave : t.usernameContinue;
  const dirty = normalizePlayerName(nameDraft) !== (stats?.displayName ?? "");
  const saveDisabled = nameBusy || (ready && !dirty) || !isValidPlayerName(normalizePlayerName(nameDraft));
  return `
    <form class="name-form" data-act="save-name">
      <label class="name-field">
        <span>${escapeHtml(t.username)}</span>
        <input
          id="player-name"
          name="username"
          type="text"
          maxlength="${NAME_MAX}"
          autocomplete="username"
          spellcheck="false"
          value="${escapeHtml(nameDraft)}"
        />
      </label>
      <p class="hint">${escapeHtml(ready ? t.usernameChange : t.usernameHint)}</p>
      <button type="submit" data-act="save-name" class="${ready ? "ghost" : ""}"${saveDisabled ? " disabled" : ""}>${escapeHtml(saveLabel)}</button>
    </form>
  `;
}

function boardMarkup(): string {
  const t = STR;
  if (board.length === 0) {
    return `<p class="hint">${escapeHtml(t.boardEmpty)}</p>`;
  }
  const medals = ["gold", "silver", "bronze"] as const;
  const rows = board
    .map((row, index) => {
      const medal = medals[index] ?? "";
      const you = authUser && row.userId === authUser.id ? " you" : "";
      return `<li class="board-row ${medal}${you}">
        <span class="board-rank">${index + 1}</span>
        <span class="board-name">${escapeHtml(row.name)}</span>
        <span class="board-score">${row.score}</span>
      </li>`;
    })
    .join("");
  return `<ol class="board" aria-label="${escapeHtml(t.board)}">${rows}</ol>`;
}

function statsMarkup(showName = true): string {
  const t = STR;
  const today = stats?.todayPlays ?? 0;
  const total = stats?.totalPlays ?? 0;
  const best = stats?.bestScore ?? state.best;
  const name = stats?.displayName || (authUser ? suggestedNameFromUser(authUser) : t.player);
  return `
    ${showName ? `<p class="player-name">${escapeHtml(name)}</p>` : ""}
    <ul class="play-stats">
      <li><span>${escapeHtml(t.playsToday)}</span><strong>${today}</strong></li>
      <li><span>${escapeHtml(t.playsTotal)}</span><strong>${total}</strong></li>
      <li><span>${escapeHtml(t.best)}</span><strong>${best}</strong></li>
    </ul>
  `;
}

async function refreshAccount(user: User | null) {
  authUser = user;
  authError = "";
  didFocusName = false;
  if (!user) {
    stats = null;
    board = [];
    nameDraft = "";
    bumpOverlay();
    return;
  }
  try {
    stats = await loadPlayerStats(user);
    if (stats) {
      hydrateBest(state, stats.bestScore);
      nameDraft = stats.displayName || suggestedNameFromUser(user);
    } else {
      nameDraft = suggestedNameFromUser(user);
    }
    board = await loadLeaderboard();
  } catch (error) {
    authError = errorMessage(error, STR.authError);
    nameDraft = suggestedNameFromUser(user);
  }
  bumpOverlay();
}

async function bootAuth() {
  if (!isSupabaseConfigured()) {
    authReady = true;
    bumpOverlay();
    return;
  }
  try {
    const user = await currentUser();
    await refreshAccount(user);
  } catch (error) {
    authError = errorMessage(error, STR.authError);
  } finally {
    authReady = true;
    bumpOverlay();
  }
  onAuthChange((user) => {
    void refreshAccount(user);
  });
}

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
  boardBtn.textContent = t.boardOpen;
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
    authUser?.id ?? "",
    String(authReady),
    String(authBusy),
    String(beginBusy),
    String(nameBusy),
    authError,
    String(stats?.todayPlays ?? ""),
    String(stats?.totalPlays ?? ""),
    String(stats?.bestScore ?? ""),
    String(stats?.nameSet ?? ""),
    stats?.displayName ?? "",
    String(boardOpen),
    String(boardLoading),
    board.map((row) => `${row.userId}:${row.score}`).join(","),
  ].join("|");
  if (key === overlayKey) return;
  overlayKey = key;

  if (boardOpen) {
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="overlay-card board-card">
        <div class="overlay-head">
          <h1>${escapeHtml(t.board)}</h1>
          <button type="button" data-act="close-board" class="ghost">${escapeHtml(t.boardClose)}</button>
        </div>
        ${boardLoading ? `<p class="hint">${escapeHtml(t.boardLoading)}</p>` : boardMarkup()}
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : ""}
      </div>
    `;
    return;
  }

  if (state.phase === "title") {
    overlay.hidden = false;
    let body = "";
    if (!isSupabaseConfigured()) {
      body = `<p class="how">${escapeHtml(t.setup)}</p>`;
    } else if (!authReady || authBusy) {
      body = `<p class="hint">${escapeHtml(t.signingIn)}</p>`;
    } else if (!authUser) {
      body = `
        <p class="how">${escapeHtml(t.signInHow)}</p>
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : ""}
        <button type="button" data-act="google">${escapeHtml(t.signInGoogle)}</button>
      `;
    } else if (!stats) {
      body = `
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : `<p class="hint">${escapeHtml(t.signingIn)}</p>`}
        <button type="button" data-act="signout" class="ghost">${escapeHtml(t.signOut)}</button>
      `;
    } else if (needsUsername()) {
      body = `
        <p class="how">${escapeHtml(t.usernameHow)}</p>
        ${nameFieldMarkup(false)}
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : ""}
        <button type="button" data-act="signout" class="ghost">${escapeHtml(t.signOut)}</button>
      `;
    } else {
      body = `
        ${statsMarkup(false)}
        ${nameFieldMarkup(true)}
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : ""}
        <button type="button" data-act="start"${beginBusy ? " disabled" : ""}>${escapeHtml(t.start)}</button>
        <button type="button" data-act="board" class="ghost">${escapeHtml(t.board)}</button>
        <button type="button" data-act="signout" class="ghost">${escapeHtml(t.signOut)}</button>
        <p class="hint">${escapeHtml(t.hint)}</p>
      `;
    }
    overlay.innerHTML = `
      <div class="overlay-card">
        <p class="eyebrow">${escapeHtml(t.subtitle)}</p>
        <h1>${escapeHtml(t.title)}</h1>
        ${authUser ? "" : `<p class="how">${escapeHtml(t.how)}</p>`}
        ${body}
        <dl class="help">
          <dt>${escapeHtml(isTouchDevice() ? t.joystick : "← →")}</dt><dd>${escapeHtml(t.move)}</dd>
          <dt>${escapeHtml(isTouchDevice() ? t.jumpBtn : "Space")}</dt><dd>${escapeHtml(t.jump)}</dd>
          <dt>Esc</dt><dd>${escapeHtml(t.pause)}</dd>
        </dl>
      </div>
    `;
    if (needsUsername() && !didFocusName) {
      didFocusName = true;
      queueMicrotask(() => {
        const field = overlay.querySelector<HTMLInputElement>("#player-name");
        field?.focus();
        field?.select();
      });
    }
    return;
  }

  if (state.phase === "paused") {
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="overlay-card">
        <h1>${escapeHtml(t.paused)}</h1>
        <button type="button" data-act="resume">${escapeHtml(t.resume)}</button>
        <button type="button" data-act="board" class="ghost">${escapeHtml(t.board)}</button>
        <button type="button" data-act="restart" class="ghost">${escapeHtml(t.restart)}</button>
      </div>
    `;
    return;
  }

  if (isGameOverVisible(state)) {
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="overlay-card">
        <p class="eyebrow">${escapeHtml(t.gameOver)}</p>
        <h1>${state.score}</h1>
        <p class="how">${escapeHtml(t.crushed)}</p>
        ${statsMarkup()}
        <button type="button" data-act="start"${beginBusy || !authUser ? " disabled" : ""}>${escapeHtml(t.playAgain)}</button>
        <button type="button" data-act="board" class="ghost">${escapeHtml(t.board)}</button>
      </div>
    `;
    return;
  }

  overlay.hidden = true;
  overlay.innerHTML = "";
}

async function saveChosenName() {
  if (!authUser || nameBusy) return;
  const name = normalizePlayerName(nameDraft || overlay.querySelector<HTMLInputElement>("#player-name")?.value || "");
  nameDraft = name;
  if (!isValidPlayerName(name)) {
    authError = STR.usernameError;
    bumpOverlay();
    return;
  }
  nameBusy = true;
  authError = "";
  bumpOverlay();
  renderOverlay();
  try {
    const next = await setPlayerName(name);
    if (next) {
      stats = next;
      nameDraft = next.displayName;
      board = await loadLeaderboard();
    }
  } catch (error) {
    authError = errorMessage(error, STR.usernameError);
  } finally {
    nameBusy = false;
    bumpOverlay();
  }
}

async function beginRun() {
  if (needsUsername()) {
    void saveChosenName();
    return;
  }
  if (!canPlay() || beginBusy) return;
  beginBusy = true;
  authError = "";
  bumpOverlay();
  renderOverlay();
  try {
    const next = await startPlayerRun(authUser!);
    if (next) {
      stats = next;
      hydrateBest(state, next.bestScore);
    }
    unlockAudio();
    runSaved = false;
    startRun(state, { globalBest: next?.globalBest ?? stats?.globalBest ?? 0 });
    canvas.focus();
  } catch (error) {
    authError = errorMessage(error, STR.startError);
  } finally {
    beginBusy = false;
    bumpOverlay();
  }
}

async function saveFinishedRun() {
  if (runSaved || !authUser) return;
  runSaved = true;
  try {
    const next = await finishPlayerRun(state.score);
    if (next) {
      stats = next;
      hydrateBest(state, next.bestScore);
    }
    board = await loadLeaderboard();
  } catch (error) {
    authError = errorMessage(error, STR.saveError);
  }
  bumpOverlay();
}

overlay.addEventListener("input", (event) => {
  const field = event.target;
  if (!(field instanceof HTMLInputElement) || field.id !== "player-name") return;
  nameDraft = field.value;
  const saveBtn = overlay.querySelector<HTMLButtonElement>("form[data-act='save-name'] button[data-act='save-name']");
  if (!saveBtn) return;
  const ready = Boolean(stats?.nameSet);
  const name = normalizePlayerName(nameDraft);
  const dirty = name !== (stats?.displayName ?? "");
  saveBtn.disabled = nameBusy || (ready && !dirty) || !isValidPlayerName(name);
});

overlay.addEventListener("submit", (event) => {
  const form = (event.target as HTMLElement).closest("form[data-act='save-name']");
  if (!form) return;
  event.preventDefault();
  void saveChosenName();
});

overlay.addEventListener("click", (event) => {
  if (boardOpen && event.target === overlay) {
    closeBoard();
    renderOverlay();
    return;
  }
  const btn = (event.target as HTMLElement).closest("button[data-act]");
  if (!(btn instanceof HTMLButtonElement)) return;
  const act = btn.dataset.act;
  if (act === "close-board") {
    closeBoard();
    renderOverlay();
    return;
  }
  if (act === "board") {
    openBoard();
    renderOverlay();
    return;
  }
  if (act === "save-name") {
    event.preventDefault();
    void saveChosenName();
    return;
  }
  if (act === "start" || act === "restart") void beginRun();
  if (act === "resume") togglePause(state);
  if (act === "google") {
    authBusy = true;
    authError = "";
    bumpOverlay();
    renderOverlay();
    void signInWithGoogle().then((result) => {
      if (result.error) {
        authBusy = false;
        authError = result.error;
        bumpOverlay();
      }
    });
  }
  if (act === "signout") {
    void signOut().then(() => {
      stats = null;
      board = [];
      bumpOverlay();
    });
  }
  renderOverlay();
});

boardBtn.addEventListener("click", () => {
  unlockAudio();
  if (boardOpen) closeBoard();
  else openBoard();
  renderOverlay();
});

pauseBtn.addEventListener("click", () => {
  unlockAudio();
  if (boardOpen) {
    closeBoard();
    renderOverlay();
    return;
  }
  if (state.phase === "playing" || state.phase === "paused") togglePause(state);
});

function handleInput() {
  const stick = readStick();
  if (input.consumeAny(PAUSE_KEYS)) {
    if (boardOpen) closeBoard();
    else if (state.phase === "playing" || state.phase === "paused") togglePause(state);
  }
  if (boardOpen) {
    input.consumeAny(CONFIRM_KEYS);
    input.consumeAny(JUMP_KEYS);
    return;
  }
  if (input.consume("r") && state.phase !== "title") {
    void beginRun();
  }

  if (state.phase === "title" && input.consumeAny(CONFIRM_KEYS)) {
    if (needsUsername()) void saveChosenName();
    else void beginRun();
  }
  if (isGameOverVisible(state) && input.consumeAny(CONFIRM_KEYS)) {
    void beginRun();
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
  if (state.phase === "dead") void saveFinishedRun();
  drawGame(ctx, state);
  syncHud();
  renderOverlay();
  requestAnimationFrame(frame);
}

syncCopy();
syncHud();
renderOverlay();
void bootAuth();
requestAnimationFrame(frame);

document.addEventListener("pointerdown", () => unlockAudio(), { once: true });
document.addEventListener("keydown", () => unlockAudio(), { once: true });
