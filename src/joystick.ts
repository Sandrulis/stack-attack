export type StickState = {
  x: number;
  y: number;
  jump: boolean;
};

type Lane = -1 | 0 | 1;

const ENGAGE = 0.5;
const RELEASE = 0.28;

function snapLane(raw: number, current: Lane): Lane {
  if (current === 0) {
    if (raw <= -ENGAGE) return -1;
    if (raw >= ENGAGE) return 1;
    return 0;
  }
  if (current === -1) {
    if (raw >= ENGAGE) return 1;
    if (raw >= -RELEASE) return 0;
    return -1;
  }
  if (raw <= -ENGAGE) return -1;
  if (raw <= RELEASE) return 0;
  return 1;
}

export function bindJoystick(
  root: HTMLElement,
  knob: HTMLElement,
  jumpBtn: HTMLButtonElement,
): () => StickState {
  const state: StickState = { x: 0, y: 0, jump: false };
  let originX = 0;
  let active = false;
  let lane: Lane = 0;

  const radius = () => Math.max(8, (root.clientWidth - knob.offsetWidth) / 2 - 3);

  const setKnob = (x: Lane) => {
    knob.style.transform = `translate(${x * radius()}px, 0px)`;
    root.classList.toggle("is-active", x !== 0);
  };

  const apply = (clientX: number) => {
    const r = radius();
    const raw = Math.max(-1, Math.min(1, (clientX - originX) / r));
    lane = snapLane(raw, lane);
    state.x = lane;
    state.y = 0;
    setKnob(lane);
  };

  const start = (event: PointerEvent) => {
    const rect = root.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    active = true;
    root.setPointerCapture(event.pointerId);
    apply(event.clientX);
  };

  const move = (event: PointerEvent) => {
    if (!active) return;
    apply(event.clientX);
  };

  const end = () => {
    active = false;
    lane = 0;
    state.x = 0;
    state.y = 0;
    setKnob(0);
  };

  root.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    start(event);
  });
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", end);
  root.addEventListener("lostpointercapture", end);

  jumpBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.jump = true;
  });

  return () => {
    const jump = state.jump;
    state.jump = false;
    return { x: state.x, y: state.y, jump };
  };
}

export function isTouchDevice(): boolean {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}
