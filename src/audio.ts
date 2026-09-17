type Voice = {
  ctx: AudioContext;
  master: GainNode;
};

const MUTE_KEY = "stack-attack-muted";
const MASTER_GAIN = 0.18;

let voice: Voice | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistMuted() {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

function applyMasterGain() {
  if (!voice) return;
  voice.master.gain.value = muted ? 0 : MASTER_GAIN;
}

function getVoice(): Voice | null {
  if (typeof window === "undefined") return null;
  if (!voice) {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(ctx.destination);
    voice = { ctx, master };
  }
  if (voice.ctx.state === "suspended") void voice.ctx.resume();
  return voice;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  persistMuted();
  applyMasterGain();
}

export function toggleMute(): boolean {
  setMuted(!muted);
  if (!muted) unlockAudio();
  return muted;
}

export function unlockAudio() {
  getVoice();
}

function beep(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  gain = 1,
  slideTo?: number,
) {
  if (muted) return;
  const v = getVoice();
  if (!v) return;
  const t0 = v.ctx.currentTime;
  const osc = v.ctx.createOscillator();
  const g = v.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + duration);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(v.master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  walk: () => beep(180, 0.05, "square", 0.35),
  push: () => beep(110, 0.09, "square", 0.55),
  jump: () => beep(420, 0.1, "square", 0.4, 280),
  land: () => beep(90, 0.08, "triangle", 0.45),
  drop: () => beep(700, 0.18, "square", 0.25, 220),
  clear: () => {
    beep(320, 0.12, "square", 0.5);
    window.setTimeout(() => beep(480, 0.14, "square", 0.55), 70);
    window.setTimeout(() => beep(640, 0.22, "square", 0.6), 150);
  },
  smash: () => {
    beep(520, 0.08, "square", 0.55, 240);
    window.setTimeout(() => beep(180, 0.16, "triangle", 0.5, 80), 40);
  },
  crush: () => beep(220, 0.45, "sawtooth", 0.7, 50),
  start: () => {
    beep(260, 0.1, "square", 0.4);
    window.setTimeout(() => beep(390, 0.16, "square", 0.45), 90);
  },
};
