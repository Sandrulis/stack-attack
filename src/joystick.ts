export type StickState = {
  x: number;
  y: number;
  jump: boolean;
};

export function bindJoystick(
  root: HTMLElement,
  knob: HTMLElement,
  jumpBtn: HTMLButtonElement,
): () => StickState {
  const state: StickState = { x: 0, y: 0, jump: false };
  let originX = 0;
  let active = false;

  const radius = () => Math.max(40, root.clientWidth * 0.42);

  const setKnob = (x: number) => {
    knob.style.transform = `translate(${x * radius()}px, 0px)`;
  };

  const apply = (clientX: number) => {
    const r = radius();
    const x = Math.max(-1, Math.min(1, (clientX - originX) / r));
    state.x = x;
    state.y = 0;
    setKnob(x);
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
