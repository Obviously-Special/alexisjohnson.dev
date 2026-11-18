import { SPRITE_COLORS } from './palette.js';
import { encodeSprite, decodeSprite, spriteCanvas } from './spritecode.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const N = 16;
const COLOR_NAMES = [null, 'Ink', 'Paper', 'Grey', 'Silver', 'Brown', 'Tan', 'Wine', 'Red', 'Coral', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Lavender'];

// So the canvas never opens empty: a cat face, in palette indices (hex digits).
const STARTER = [
  '................',
  '................',
  '...1........1...',
  '..1a1......1a1..',
  '..1aa1....1aa1..',
  '..1aaa1111aaa1..',
  '..1aaaaaaaaaa1..',
  '.1aaaaaaaaaaaa1.',
  '.1aa11aaaa11aa1.',
  '.1aa11aaaa11aa1.',
  '.1aaaaa99aaaaa1.',
  '..1aaa1aa1aaa1..',
  '...1aaaaaaaa1...',
  '....11111111....',
  '................',
  '................',
];

// Sprite Studio: a 16x16 pixel editor that lives on the desk.
export class Studio {
  constructor(game) {
    this.game = game;
    this.cv = $('studio-canvas');
    this.g = this.cv.getContext('2d');
    this.cursorEl = $('studio-cursor');
    this.note = $('studio-note');
    this.pix = new Uint8Array(N * N);
    this.color = 1;
    this.tool = 'pen';
    this.mirror = false;
    this.history = [];
    this.drawing = false;
    this.last = null;
    this.cursor = { x: 7, y: 7 };
    this.loaded = false;
    this.buildSwatches();
    this.buildSlots();
    this.wire();
  }

  buildSwatches() {
    const box = $('studio-swatches');
    for (let i = 1; i < SPRITE_COLORS.length; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.setProperty('--sw', SPRITE_COLORS[i]);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', COLOR_NAMES[i]);
      b.dataset.color = String(i);
      b.addEventListener('click', () => this.setColor(i));
      box.append(b);
    }
    this.syncSwatches();
  }

  syncSwatches() {
    for (const b of document.querySelectorAll('#studio-swatches .swatch')) {
      const on = Number(b.dataset.color) === this.color;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
  }

  buildSlots() {
    const box = $('studio-frames');
    this.slots = [0, 1, 2].map((i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'frame-slot';
      const c = document.createElement('canvas');
      c.width = N;
      c.height = N;
      const label = document.createElement('span');
      label.textContent = `Frame ${i + 1}`;
      b.append(c, label);
      b.setAttribute('aria-label', `Hang it in frame ${i + 1}`);
      b.addEventListener('click', () => this.hang(i));
      box.append(b);
      return c;
    });
  }

  wire() {
    document.querySelectorAll('#panel-studio [data-tool]').forEach((b) => b.addEventListener('click', () => this.setTool(b.dataset.tool)));
    $('studio-mirror').addEventListener('click', (e) => {
      this.mirror = !this.mirror;
      e.currentTarget.setAttribute('aria-pressed', String(this.mirror));
    });
    $('studio-undo').addEventListener('click', () => this.undo());
    $('studio-clear').addEventListener('click', () => {
      this.snapshot();
      this.pix.fill(0);
      this.changed();
    });
    $('studio-download').addEventListener('click', () => this.download());
    $('studio-share').addEventListener('click', () => this.share());

    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = this.cell(e);
      if (!p) return;
      cv.setPointerCapture(e.pointerId);
      this.snapshot();
      this.drawing = true;
      this.last = p;
      this.cursor = p;
      this.apply(p.x, p.y, true);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.drawing) return;
      const p = this.cell(e);
      if (!p) return;
      this.lineTo(this.last, p);
      this.last = p;
    });
    const end = () => {
      if (!this.drawing) return;
      this.drawing = false;
      this.saveDraft();
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('keydown', (e) => this.onCanvasKey(e));
    cv.addEventListener('focus', () => this.showCursor(cv.matches(':focus-visible')));
    cv.addEventListener('blur', () => this.showCursor(false));

    $('panel-studio').addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undo();
      }
    });
    $('studio-swatches').addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = SPRITE_COLORS.length - 1;
      const next = ((this.color - 1 + d + n) % n) + 1;
      this.setColor(next);
      document.querySelector(`#studio-swatches [data-color="${next}"]`)?.focus();
    });
  }

  onCanvasKey(e) {
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      this.cursor = { x: Math.max(0, Math.min(N - 1, this.cursor.x + dx)), y: Math.max(0, Math.min(N - 1, this.cursor.y + dy)) };
      this.showCursor(true);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.snapshot();
      this.apply(this.cursor.x, this.cursor.y, true);
      this.saveDraft();
    }
  }

  showCursor(on) {
    const el = this.cursorEl;
    el.hidden = !on;
    if (on) {
      el.style.left = `${(this.cursor.x / N) * 100}%`;
      el.style.top = `${(this.cursor.y / N) * 100}%`;
    }
  }

  setColor(i) {
    this.color = i;
    if (this.tool === 'erase' || this.tool === 'pick') this.setTool('pen');
    this.syncSwatches();
  }

  setTool(t) {
    this.tool = t;
    document.querySelectorAll('#panel-studio [data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  }

  cell(e) {
    const r = this.cv.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * N);
    const y = Math.floor(((e.clientY - r.top) / r.height) * N);
    return x >= 0 && y >= 0 && x < N && y < N ? { x, y } : null;
  }

  apply(x, y, first) {
    if (this.tool === 'pick') {
      const c = this.pix[y * N + x];
      if (c) {
        this.setColor(c);
        sfx.blip();
      }
      return;
    }
    if (this.tool === 'fill') {
      if (first) this.fill(x, y, this.color);
      return;
    }
    const c = this.tool === 'erase' ? 0 : this.color;
    this.pix[y * N + x] = c;
    if (this.mirror) this.pix[y * N + (N - 1 - x)] = c;
    this.render();
  }

  lineTo(a, b) {
    let x0 = a.x;
    let y0 = a.y;
    const dx = Math.abs(b.x - x0);
    const dy = -Math.abs(b.y - y0);
    const sx = x0 < b.x ? 1 : -1;
    const sy = y0 < b.y ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.apply(x0, y0, false);
      if (x0 === b.x && y0 === b.y) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  fill(x, y, c) {
    const target = this.pix[y * N + x];
    if (target === c) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= N || cy >= N) continue;
      const i = cy * N + cx;
      if (this.pix[i] !== target) continue;
      this.pix[i] = c;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    sfx.blip();
    this.render();
  }

  snapshot() {
    this.history.push(this.pix.slice());
    if (this.history.length > 60) this.history.shift();
  }

  undo() {
    const prev = this.history.pop();
    if (!prev) return;
    this.pix.set(prev);
    this.changed();
    sfx.blip();
  }

  changed() {
    this.render();
    this.saveDraft();
  }

  render() {
    const g = this.g;
    g.clearRect(0, 0, N, N);
    for (let i = 0; i < N * N; i++) {
      const c = this.pix[i];
      if (!c) continue;
      g.fillStyle = SPRITE_COLORS[c];
      g.fillRect(i % N, (i / N) | 0, 1, 1);
    }
    for (const id of ['studio-prev1', 'studio-prev2']) {
      const p = $(id).getContext('2d');
      p.clearRect(0, 0, N, N);
      p.drawImage(this.cv, 0, 0);
    }
  }

  renderSlots() {
    const sprites = this.game.save.sprites;
    this.slots.forEach((c, i) => {
      const g = c.getContext('2d');
      g.clearRect(0, 0, N, N);
      const pix = sprites[i] && decodeSprite(sprites[i]);
      if (pix) g.drawImage(spriteCanvas(pix), 0, 0);
    });
  }

  saveDraft() {
    this.game.save.draft = encodeSprite(this.pix);
    this.game.write();
  }

  hang(i) {
    if (!this.pix.some((v) => v)) {
      this.say('Draw something first.');
      return;
    }
    this.game.save.sprites[i] = encodeSprite(this.pix);
    this.game.write();
    this.renderSlots();
    sfx.coin();
    this.say(`Hung in frame ${i + 1}. Close this window to see it on the wall.`);
    this.game.unlock('artist');
  }

  download() {
    const big = document.createElement('canvas');
    big.width = 256;
    big.height = 256;
    const g = big.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(this.cv, 0, 0, 256, 256);
    big.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'my-sprite.png';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
    this.say('Saved as my-sprite.png, 256 pixels square.');
  }

  async share() {
    const url = `${location.origin}/#sprite=${encodeSprite(this.pix)}`;
    try {
      await navigator.clipboard.writeText(url);
      this.say('Link copied. Whoever opens it gets your sprite in their studio.');
    } catch {
      this.say(`Copy this link: ${url}`);
    }
  }

  say(t) {
    this.note.textContent = t;
  }

  loadRows(rows) {
    rows.forEach((row, y) => {
      for (let x = 0; x < N; x++) this.pix[y * N + x] = row[x] === '.' ? 0 : parseInt(row[x], 16);
    });
  }

  open({ shared } = {}) {
    if (shared) {
      const pix = decodeSprite(shared);
      if (pix) {
        if (this.loaded) this.snapshot();
        this.pix.set(pix);
        this.loaded = true;
        this.say('Someone sent you this sprite. Hang it on the wall if you like it.');
      }
    }
    if (!this.loaded) {
      const pix = this.game.save.draft && decodeSprite(this.game.save.draft);
      if (pix) this.pix.set(pix);
      else this.loadRows(STARTER);
      this.loaded = true;
      this.say(pix ? '' : 'Here is a cat to start from. Clear it, or make it yours.');
    }
    this.render();
    this.renderSlots();
    this.game.panels.open('panel-studio');
  }
}
