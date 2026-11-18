import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

// The text box at the bottom of the screen, typed out one letter at a time.
export class Dialog {
  constructor() {
    this.el = $('dialog');
    this.text = $('dialog-text');
    this.more = $('dialog-more');
    this.live = $('live');
    this.active = false;
    this.clicked = false;
    this.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.clicked = true;
    });
  }

  open(pages, onDone) {
    this.pages = pages;
    this.i = 0;
    this.onDone = onDone || null;
    this.active = true;
    this.fresh = true;
    this.el.hidden = false;
    this.begin();
  }

  begin() {
    this.full = this.pages[this.i];
    this.shown = 0;
    this.text.textContent = '';
    this.more.hidden = true;
    this.live.textContent = this.full;
  }

  update(dt, input, reduced) {
    if (!this.active) return;
    const go = !this.fresh && (input.pressed('use') || input.pressed('jump') || input.pressed('up') || this.clicked);
    this.fresh = false;
    this.clicked = false;
    if (this.shown < this.full.length) {
      if (go || reduced) {
        this.shown = this.full.length;
        this.text.textContent = this.full;
      } else {
        const before = Math.floor(this.shown);
        this.shown = Math.min(this.full.length, this.shown + dt * 48);
        const now = Math.floor(this.shown);
        if (now !== before) {
          this.text.textContent = this.full.slice(0, now);
          if (now % 3 === 0 && /\S/.test(this.full[now - 1])) sfx.blip();
        }
      }
      if (this.shown >= this.full.length) this.more.hidden = false;
    } else if (go) {
      this.i++;
      sfx.select();
      if (this.i >= this.pages.length) this.close();
      else this.begin();
    }
  }

  close() {
    this.active = false;
    this.el.hidden = true;
    this.live.textContent = '';
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }
}

// Little labels that float over the canvas: the "use" prompt and quick remarks.
export class Hud {
  constructor(game) {
    this.game = game;
    this.prompt = $('prompt');
    this.say = $('say');
    this.promptText = '';
    this.prompt.addEventListener('click', () => game.scene?.promptClicked?.());
  }

  setPrompt(text, x, y) {
    if (!text) {
      if (!this.prompt.hidden) this.prompt.hidden = true;
      return;
    }
    if (text !== this.promptText) {
      this.prompt.textContent = text;
      this.promptText = text;
    }
    this.prompt.hidden = false;
    this.prompt.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  }

  setSay(text, x, y) {
    if (!text) {
      if (!this.say.hidden) this.say.hidden = true;
      return;
    }
    if (this.say.textContent !== text) this.say.textContent = text;
    this.say.hidden = false;
    this.say.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  }

  hideAll() {
    this.setPrompt(null);
    this.setSay(null);
  }
}

export function toast(title, body) {
  const box = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  const star = document.createElement('span');
  star.className = 'toast-star';
  star.textContent = '★';
  star.setAttribute('aria-hidden', 'true');
  const txt = document.createElement('div');
  const b = document.createElement('strong');
  b.textContent = title;
  const s = document.createElement('span');
  s.textContent = body;
  txt.append(b, s);
  t.append(star, txt);
  box.append(t);
  setTimeout(() => t.classList.add('out'), 3600);
  setTimeout(() => t.remove(), 4100);
}

// Pop-up windows: Sprite Studio, Boombox, Trophies and the menu.
export class Panels {
  constructor(game) {
    this.game = game;
    this.layer = $('panel-layer');
    this.current = null;
    this.onClose = null;
    this.layer.addEventListener('pointerdown', (e) => {
      if (e.target === this.layer) this.close();
    });
    this.layer.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.close()));
    document.addEventListener('keydown', (e) => {
      if (!this.current) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      } else if (e.key === 'Tab') {
        this.trapTab(e);
      }
    });
  }

  get isOpen() { return !!this.current; }

  open(id, { onClose } = {}) {
    if (this.current) this.close(true);
    const p = $(id);
    this.layer.hidden = false;
    p.hidden = false;
    this.current = p;
    this.onClose = onClose || null;
    this.game.input.enabled = false;
    this.game.input.clear();
    this.game.hud.hideAll();
    sfx.open();
    requestAnimationFrame(() => {
      const first = p.querySelector('[data-autofocus]') || p.querySelector('button:not(.panel-close), canvas[tabindex], input') || p.querySelector('.panel-close');
      first?.focus({ preventScroll: true });
    });
  }

  close(silent) {
    if (!this.current) return;
    this.current.hidden = true;
    this.layer.hidden = true;
    const cb = this.onClose;
    this.current = null;
    this.onClose = null;
    this.game.input.enabled = true;
    if (!silent) sfx.close();
    cb?.();
    this.game.focusScreen();
  }

  trapTab(e) {
    const items = [...this.current.querySelectorAll('button, input, canvas[tabindex], [tabindex="0"]')].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
