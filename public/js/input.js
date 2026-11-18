const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
  KeyE: 'use', Enter: 'use', NumpadEnter: 'use', KeyX: 'use', KeyJ: 'use',
  Escape: 'menu', KeyP: 'menu',
};
const SCROLL_KEYS = new Set(['left', 'right', 'up', 'down', 'jump']);

// Keyboard and on-screen buttons, boiled down to a few actions.
export class Input {
  constructor() {
    this.down = new Set();
    this.hits = new Set();
    this.virtual = new Set();
    this.enabled = true;
  }

  attach() {
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => this.clear());
  }

  key(e, isDown) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const a = KEYMAP[e.code];
    if (!a) return;
    if (!isDown) {
      this.down.delete(a);
      return;
    }
    if (e.defaultPrevented) return; // a panel or text field already used this key
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    // Let focused buttons and links handle their own Enter and Space.
    const onControl = t && t !== document.body && t.id !== 'screen' && /^(BUTTON|A|SUMMARY)$/.test(t.tagName);
    if (onControl && (a === 'use' || a === 'jump')) return;
    if (!this.enabled) return;
    if (SCROLL_KEYS.has(a)) e.preventDefault();
    if (!e.repeat) this.hits.add(a);
    this.down.add(a);
  }

  held(a) { return this.down.has(a) || this.virtual.has(a); }
  pressed(a) { return this.hits.has(a); }

  setVirtual(a, on) {
    if (on) {
      if (!this.virtual.has(a)) this.hits.add(a);
      this.virtual.add(a);
    } else {
      this.virtual.delete(a);
    }
  }

  endFrame() { this.hits.clear(); }

  clear() {
    this.down.clear();
    this.hits.clear();
    this.virtual.clear();
  }
}
