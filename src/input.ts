export class Input {
  readonly down = new Set<string>();
  private readonly pressed = new Set<string>();

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clear);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (isTextField(event.target)) return;
    const key = normalizeKey(event.key);
    if (shouldPrevent(key)) event.preventDefault();
    if (!this.down.has(key)) this.pressed.add(key);
    this.down.add(key);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (isTextField(event.target)) return;
    this.down.delete(normalizeKey(event.key));
  };

  readonly clear = () => {
    this.down.clear();
    this.pressed.clear();
  };

  consume(key: string): boolean {
    const hit = this.pressed.has(key);
    this.pressed.delete(key);
    return hit;
  }

  hold(key: string): boolean {
    return this.down.has(key);
  }

  consumeAny(keys: string[]): boolean {
    return keys.some((key) => this.consume(key));
  }

  holdAny(keys: string[]): boolean {
    return keys.some((key) => this.hold(key));
  }

  virtualDown(key: string) {
    if (!this.down.has(key)) this.pressed.add(key);
    this.down.add(key);
  }

  virtualUp(key: string) {
    this.down.delete(key);
  }

  virtualTap(key: string) {
    this.pressed.add(key);
  }
}

function normalizeKey(key: string): string {
  if (key === " ") return "space";
  return key.toLowerCase();
}

function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function shouldPrevent(key: string): boolean {
  return ["arrowleft", "arrowright", "arrowup", "arrowdown", "space"].includes(key);
}

export const LEFT_KEYS = ["arrowleft", "a"];
export const RIGHT_KEYS = ["arrowright", "d"];
export const JUMP_KEYS = ["space"];
export const PAUSE_KEYS = ["p", "escape"];
export const CONFIRM_KEYS = ["enter", "space"];
