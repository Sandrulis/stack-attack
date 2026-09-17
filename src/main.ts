import "./style.css";
import { isMuted, toggleMute, unlockAudio } from "./audio";
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
import { CANVAS_H, CANVAS_W, MAX_CRANES, MAX_LIVES } from "./game/constants";
import {
  clearLives,
  consumePendingLifeGains,
  createGame,
  hydrateBest,
  hydrateLeader,
  hydrateLives,
  isGameOverVisible,
  revivePlayer,
  runBeatRecord,
  spendLocalLife,
  startRun,
  syncLocalBest,
  togglePause,
  tryJump,
  tryWalk,
  updateGame,
} from "./game/engine";
import { drawGame } from "./game/render";
import type { User } from "@supabase/supabase-js";
import {
  currentUser,
  detectViewerCountry,
  finishPlayerRun,
  gainPlayerLife,
  isSupabaseConfigured,
  isValidPlayerName,
  loadLeaderboard,
  loadPlayerStats,
  NAME_MAX,
  normalizePlayerName,
  onAuthChange,
  recordPlayerGeo,
  setPlayerName,
  signInWithGoogle,
  signOut,
  spendPlayerLife,
  startPlayerRun,
  suggestedNameFromUser,
  type BoardRow,
  type PlayerStats,
} from "./lib/account";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const overlay = document.querySelector<HTMLElement>("#overlay")!;
const pauseBtn = document.querySelector<HTMLButtonElement>("#pause-btn")!;
const boardBtn = document.querySelector<HTMLButtonElement>("#board-btn")!;
const muteBtn = document.querySelector<HTMLButtonElement>("#mute-btn")!;
const settingsBtn = document.querySelector<HTMLButtonElement>("#settings-btn")!;
const scoreEl = document.querySelector("#score")!;
const bestEl = document.querySelector("#best")!;
const hudLeftEl = document.querySelector<HTMLElement>("#hud-left")!;
const cranesEl = document.querySelector<HTMLElement>("#cranes")!;
const livesWrapEl = document.querySelector<HTMLElement>("#hud-lives-wrap")!;
const livesEl = document.querySelector("#lives")!;
const lifeTimerEl = document.querySelector<HTMLElement>("#life-timer")!;
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
let heartBusy = false;
let nameBusy = false;
let runSaved = false;
let nameDraft = "";
let didFocusName = false;
let didForceSettings = false;
let boardOpen = false;
let settingsOpen = false;
let boardLoading = false;
let overlayPaused = false;
let boardScope: "all" | "country" = "all";
let myCountry = "";

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

let geoBusy = false;

function applyLeader() {
  const top = board[0];
  hydrateLeader(state, top?.name ?? "", top?.score ?? 0);
}

function rememberCountry(country: string) {
  const next = country.trim();
  if (!next || next === myCountry) return;
  myCountry = next;
  bumpOverlay();
}

async function fetchDisplayedBoard() {
  const country = boardScope === "country" ? myCountry : "";
  if (country) {
    const [filtered, all] = await Promise.all([loadLeaderboard(country), loadLeaderboard()]);
    board = filtered;
    hydrateLeader(state, all[0]?.name ?? "", all[0]?.score ?? 0);
    return;
  }
  board = await loadLeaderboard();
  applyLeader();
}

async function refreshBoardList() {
  if (!isSupabaseConfigured()) {
    board = [];
    applyLeader();
    bumpOverlay();
    return;
  }
  boardLoading = true;
  bumpOverlay();
  renderOverlay();
  try {
    await fetchDisplayedBoard();
  } catch (error) {
    authError = errorMessage(error, STR.authError);
  } finally {
    boardLoading = false;
    bumpOverlay();
  }
}

function pauseGameForHud() {
  if (state.phase === "playing") {
    togglePause(state);
    overlayPaused = true;
  }
}

function resumeGameIfHudClosed() {
  if (boardOpen || settingsOpen) return;
  if (overlayPaused && state.phase === "paused") togglePause(state);
  overlayPaused = false;
}

function openBoard() {
  if (boardOpen) return;
  settingsOpen = false;
  pauseGameForHud();
  boardOpen = true;
  bumpOverlay();
  void refreshBoardList();
}

function closeBoard() {
  if (!boardOpen) return;
  boardOpen = false;
  resumeGameIfHudClosed();
  bumpOverlay();
}

function openSettings() {
  if (settingsOpen) return;
  boardOpen = false;
  pauseGameForHud();
  settingsOpen = true;
  bumpOverlay();
}

function closeSettings() {
  if (!settingsOpen) return;
  settingsOpen = false;
  resumeGameIfHudClosed();
  bumpOverlay();
}

function closeHudOverlays() {
  boardOpen = false;
  settingsOpen = false;
  resumeGameIfHudClosed();
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
    return `<p class="hint">${escapeHtml(boardScope === "country" ? t.boardEmptyCountry : t.boardEmpty)}</p>`;
  }
  const medals = ["gold", "silver", "bronze"] as const;
  const rows = board
    .map((row, index) => {
      const medal = medals[index] ?? "";
      const you = authUser && row.userId === authUser.id ? " you" : "";
      return `<li class="board-row ${medal}${you}">
        <span class="board-rank">${index + 1}</span>
        <span class="board-identity">
          <span class="board-name">${escapeHtml(row.name)}</span>
          ${row.country ? `<span class="board-country">${escapeHtml(row.country)}</span>` : ""}
        </span>
        <span class="board-score">${row.score}</span>
      </li>`;
    })
    .join("");
  return `<ol class="board" aria-label="${escapeHtml(t.board)}">${rows}</ol>`;
}

function boardTabsMarkup(): string {
  const t = STR;
  const country = myCountry;
  return `
    <div class="board-tabs">
      <button type="button" data-act="board-all" class="${boardScope === "all" ? "is-on" : "ghost"}">${escapeHtml(t.boardAll)}</button>
      ${
        country
          ? `<button type="button" data-act="board-country" class="${boardScope === "country" ? "is-on" : "ghost"}">${escapeHtml(country)}</button>`
          : ""
      }
    </div>
  `;
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
    nameDraft = "";
    didForceSettings = false;
    settingsOpen = false;
    clearLives(state);
    bumpOverlay();
    void refreshBoardList();
    return;
  }
  try {
    stats = await loadPlayerStats(user);
    if (stats) {
      hydrateBest(state, stats.bestScore);
      applyAccountLives(stats);
      nameDraft = stats.displayName || suggestedNameFromUser(user);
      if (!stats.nameSet && !didForceSettings) {
        didForceSettings = true;
        settingsOpen = true;
        boardOpen = false;
      }
    } else {
      nameDraft = suggestedNameFromUser(user);
    }
    if (stats?.country) rememberCountry(stats.country);
    await fetchDisplayedBoard();
    if (!geoBusy) {
      geoBusy = true;
      void recordPlayerGeo()
        .then((country) => rememberCountry(country))
        .catch(() => undefined)
        .finally(() => {
          geoBusy = false;
        });
    }
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
  void detectViewerCountry().then((country) => rememberCountry(country));
  onAuthChange((user) => {
    void refreshAccount(user);
  });
}

function syncCopy() {
  const t = STR;
  document.documentElement.lang = "en";
  document.title = t.title;
  document.querySelector("#brand-title")!.textContent = t.title;
  document.querySelector("#subtitle")!.textContent = t.subtitle;
  document.querySelector("#score-label")!.textContent = t.score;
  document.querySelector("#best-label")!.textContent = t.best;
  document.querySelector("#legend-move")!.textContent = t.legendMove;
  document.querySelector("#legend-jump")!.textContent = t.legendJump;
  document.querySelector("#legend-pause")!.textContent = t.legendPause;
  pauseBtn.textContent = t.pause;
  boardBtn.textContent = t.boardOpen;
  settingsBtn.setAttribute("aria-label", t.settings);
  livesEl.setAttribute("aria-label", t.lives);
  syncMuteButton();
  jumpBtn.querySelector(".jump-btn-label")!.textContent = t.jumpBtn;
  const rotateText = document.querySelector("#rotate-text");
  if (rotateText) rotateText.textContent = t.rotate;
}

function syncMuteButton() {
  const muted = isMuted();
  muteBtn.classList.toggle("is-muted", muted);
  muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  muteBtn.setAttribute("aria-label", muted ? STR.unmute : STR.mute);
}

function formatLifeWait(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function applyAccountLives(next: PlayerStats | null | undefined) {
  if (!next) return;
  hydrateLives(state, next.lives, next.nextLifeAt);
}

function syncHud() {
  const signedIn = Boolean(authUser);
  hudLeftEl.hidden = !signedIn;
  cranesEl.hidden = !signedIn;
  livesWrapEl.hidden = !signedIn;
  if (!signedIn) {
    livesEl.innerHTML = "";
    cranesEl.innerHTML = "";
    lifeTimerEl.hidden = true;
    lifeTimerEl.textContent = "";
    return;
  }
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
  cranesEl.innerHTML = Array.from({ length: MAX_CRANES }, (_, index) =>
    `<span class="crane-dot${index < state.cranes.length ? " on" : ""}"></span>`,
  ).join("");
  livesEl.innerHTML = Array.from({ length: MAX_LIVES }, (_, index) =>
    `<span class="life-heart${index < state.lives ? " on" : ""}" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M8 14.2 2.2 8.6C1.1 7.5 1.1 5.6 2.3 4.5 3.4 3.4 5.2 3.4 6.3 4.5L8 6.2l1.7-1.7c1.1-1.1 2.9-1.1 4 0 1.2 1.1 1.2 3 0 4.1L8 14.2z"/></svg></span>`,
  ).join("");
  const waiting = state.livesReady && state.lives < MAX_LIVES && state.nextLifeAt > 0;
  lifeTimerEl.hidden = !waiting;
  if (waiting) {
    const wait = formatLifeWait(state.nextLifeAt - Date.now());
    lifeTimerEl.textContent = wait;
    lifeTimerEl.setAttribute("aria-label", `${STR.nextHeart} ${wait}`);
  } else {
    lifeTimerEl.textContent = "";
    lifeTimerEl.setAttribute("aria-label", STR.nextHeart);
  }
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
    String(heartBusy),
    String(state.lives),
    String(nameBusy),
    authError,
    String(stats?.todayPlays ?? ""),
    String(stats?.totalPlays ?? ""),
    String(stats?.bestScore ?? ""),
    String(stats?.nameSet ?? ""),
    stats?.displayName ?? "",
    String(boardOpen),
    String(settingsOpen),
    String(boardLoading),
    boardScope,
    myCountry,
    board.map((row) => `${row.userId}:${row.score}:${row.country}`).join(","),
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
        ${boardTabsMarkup()}
        ${boardLoading ? `<p class="hint">${escapeHtml(t.boardLoading)}</p>` : boardMarkup()}
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : ""}
      </div>
    `;
    return;
  }

  if (settingsOpen) {
    overlay.hidden = false;
    let settingsBody = "";
    if (!isSupabaseConfigured()) {
      settingsBody = `<p class="how">${escapeHtml(t.setup)}</p>`;
    } else if (!authReady || authBusy) {
      settingsBody = `<p class="hint">${escapeHtml(t.signingIn)}</p>`;
    } else if (!authUser) {
      settingsBody = `
        <p class="how">${escapeHtml(t.signInHow)}</p>
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : ""}
        <button type="button" data-act="google">${escapeHtml(t.signInGoogle)}</button>
      `;
    } else if (!stats) {
      settingsBody = `
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : `<p class="hint">${escapeHtml(t.signingIn)}</p>`}
        <button type="button" data-act="signout" class="ghost">${escapeHtml(t.signOut)}</button>
      `;
    } else {
      settingsBody = `
        ${statsMarkup(false)}
        ${needsUsername() ? `<p class="how">${escapeHtml(t.usernameHow)}</p>` : ""}
        ${nameFieldMarkup(Boolean(stats.nameSet))}
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : ""}
        <button type="button" data-act="signout" class="ghost">${escapeHtml(t.signOut)}</button>
      `;
    }
    overlay.innerHTML = `
      <div class="overlay-card settings-card">
        <div class="overlay-head">
          <h1>${escapeHtml(t.settings)}</h1>
          <button type="button" data-act="close-settings" class="ghost">${escapeHtml(t.boardClose)}</button>
        </div>
        ${settingsBody}
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
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : ""}
        <button type="button" data-act="start" disabled>${escapeHtml(t.start)}</button>
        <button type="button" data-act="board" class="ghost">${escapeHtml(t.board)}</button>
      `;
    } else {
      body = `
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : ""}
        <button type="button" data-act="start"${beginBusy ? " disabled" : ""}>${escapeHtml(t.start)}</button>
        <button type="button" data-act="board" class="ghost">${escapeHtml(t.board)}</button>
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
        ${authError ? `<p class="auth-error">${escapeHtml(authError)}</p>` : ""}
        ${statsMarkup()}
        <button type="button" data-act="use-heart"${heartBusy || beginBusy || state.lives < 1 ? " disabled" : ""}>${escapeHtml(t.useHeart)}</button>
        <button type="button" data-act="start"${beginBusy || heartBusy || !authUser ? " disabled" : ""}>${escapeHtml(t.playAgain)}</button>
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
  const firstName = !stats?.nameSet;
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
      await fetchDisplayedBoard();
      if (firstName) closeSettings();
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
    openSettings();
    return;
  }
  if (!canPlay() || beginBusy || heartBusy) return;
  beginBusy = true;
  authError = "";
  bumpOverlay();
  renderOverlay();
  try {
    if (state.phase === "dead" || runBeatRecord(state)) {
      syncLocalBest(state);
      await saveFinishedRun();
    }
    const next = await startPlayerRun(authUser!);
    if (next) {
      stats = next;
      hydrateBest(state, next.bestScore);
      applyAccountLives(next);
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
  syncLocalBest(state);
  try {
    const next = await finishPlayerRun(state.score);
    if (next) {
      stats = next;
      hydrateBest(state, next.bestScore);
      applyAccountLives(next);
    }
    await fetchDisplayedBoard();
  } catch (error) {
    authError = errorMessage(error, STR.saveError);
  }
  bumpOverlay();
}

async function useHeart() {
  if (heartBusy || beginBusy || !isGameOverVisible(state)) return;
  if (state.lives < 1) return;
  heartBusy = true;
  authError = "";
  bumpOverlay();
  renderOverlay();
  try {
    const next = await spendPlayerLife();
    if (next) {
      stats = next;
      applyAccountLives(next);
    } else if (!spendLocalLife(state)) {
      return;
    }
    revivePlayer(state);
  } catch (error) {
    authError = errorMessage(error, STR.heartError);
  } finally {
    heartBusy = false;
    bumpOverlay();
  }
}

async function persistCaughtHearts(count: number) {
  for (let i = 0; i < count; i += 1) {
    try {
      const next = await gainPlayerLife();
      if (next) {
        stats = next;
        if (next.lives >= state.lives) applyAccountLives(next);
      }
    } catch {
      /* keep the local extra heart */
    }
  }
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
  if ((boardOpen || settingsOpen) && event.target === overlay) {
    closeHudOverlays();
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
  if (act === "board-all") {
    if (boardScope !== "all") {
      boardScope = "all";
      void refreshBoardList();
    }
    return;
  }
  if (act === "board-country") {
    if (!myCountry) return;
    if (boardScope !== "country") {
      boardScope = "country";
      void refreshBoardList();
    }
    return;
  }
  if (act === "close-settings") {
    closeSettings();
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
  if (act === "use-heart") void useHeart();
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
      didForceSettings = false;
      settingsOpen = false;
      bumpOverlay();
      void refreshBoardList();
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
  if (boardOpen || settingsOpen) {
    closeHudOverlays();
    renderOverlay();
    return;
  }
  if (state.phase === "playing" || state.phase === "paused") togglePause(state);
});

muteBtn.addEventListener("click", () => {
  toggleMute();
  syncMuteButton();
});

settingsBtn.addEventListener("click", () => {
  unlockAudio();
  if (settingsOpen) closeSettings();
  else openSettings();
  renderOverlay();
});

function handleInput() {
  const stick = readStick();
  if (input.consumeAny(PAUSE_KEYS)) {
    if (boardOpen || settingsOpen) closeHudOverlays();
    else if (state.phase === "playing" || state.phase === "paused") togglePause(state);
  }
  if (boardOpen || settingsOpen) {
    input.consumeAny(CONFIRM_KEYS);
    input.consumeAny(JUMP_KEYS);
    return;
  }
  if (input.consume("r") && state.phase !== "title") {
    void beginRun();
  }

  if (state.phase === "title" && input.consumeAny(CONFIRM_KEYS)) {
    if (needsUsername()) openSettings();
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
  const left = input.holdAny(LEFT_KEYS) || stick.x < 0;
  const right = input.holdAny(RIGHT_KEYS) || stick.x > 0;

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
  const gained = consumePendingLifeGains(state);
  if (gained > 0) void persistCaughtHearts(gained);
  handleInput();
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
