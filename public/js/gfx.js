import { C, PAL } from './palette.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(canvas) {
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  return g;
}

// Turns rows of palette characters into a small canvas. '.' is transparent.
export function makeSprite(rows, colors = {}) {
  const h = rows.length;
  const w = rows[0].length;
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    if (row.length !== w) console.warn('Sprite row has the wrong width', y, row);
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const col = colors[ch] ?? PAL[ch];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

export function flipped(spr) {
  if (!spr._flipped) {
    const c = makeCanvas(spr.width, spr.height);
    const g = ctx2d(c);
    g.translate(spr.width, 0);
    g.scale(-1, 1);
    g.drawImage(spr, 0, 0);
    spr._flipped = c;
  }
  return spr._flipped;
}

export function blit(g, spr, x, y, flip = false) {
  g.drawImage(flip ? flipped(spr) : spr, Math.round(x), Math.round(y));
}

export function rect(g, x, y, w, h, col) {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
}

export function px(g, x, y, col) {
  g.fillStyle = col;
  g.fillRect(x, y, 1, 1);
}

export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function line(g, x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  g.fillStyle = col;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function disc(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt((r + 0.5) ** 2 - y * y));
    g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

export function ellipse(g, cx, cy, rx, ry, col) {
  g.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2)) + 0.25);
    g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

// A vertical gradient made of flat palette colours, blended with ordered dithering.
export function gradientCanvas(w, h, cols) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const d = img.data;
  const rgb = cols.map(hexRgb);
  const n = rgb.length - 1;
  for (let y = 0; y < h; y++) {
    const t = n === 0 ? 0 : (n * y) / Math.max(1, h - 1);
    const i = Math.min(Math.max(n - 1, 0), Math.floor(t));
    const f = t - i;
    for (let x = 0; x < w; x++) {
      const col = n > 0 && f > bayer(x, y) ? rgb[i + 1] : rgb[i];
      const k = (y * w + x) * 4;
      d[k] = col[0];
      d[k + 1] = col[1];
      d[k + 2] = col[2];
      d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// 3x5 digits for little numbers that float up inside the canvas.
const MINI = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001111', '+': '000010111010000',
};
export function miniText(g, str, x, y, col) {
  g.fillStyle = col;
  let cx = Math.round(x);
  for (const ch of String(str)) {
    const m = MINI[ch];
    if (m) for (let i = 0; i < 15; i++) if (m[i] === '1') g.fillRect(cx + (i % 3), Math.round(y) + ((i / 3) | 0), 1, 1);
    cx += 4;
  }
}

// Chunky letters for the title logo.
const LOGO = {
  A: ['.####.', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '######'],
  E: ['######', '##....', '##....', '#####.', '##....', '##....', '######'],
  X: ['##..##', '##..##', '.####.', '..##..', '.####.', '##..##', '##..##'],
  I: ['######', '..##..', '..##..', '..##..', '..##..', '..##..', '######'],
  S: ['.#####', '##....', '##....', '.####.', '....##', '....##', '#####.'],
};
const LOGO_ROWS = [C.glow, C.glow, C.lamp, C.lamp, C.orange, C.orange, C.orangeDark];

export function drawLogo(g, word, cx, y, time, { b = 3, wave = true } = {}) {
  const letters = [...word];
  const lw = 6 * b;
  const gap = b;
  const total = letters.length * lw + (letters.length - 1) * gap;
  const x0 = Math.round(cx - total / 2);
  const sh = Math.max(2, b - 1);
  const offs = letters.map((_, i) => (wave ? Math.round(Math.sin(time * 2.6 + i * 0.75) * 2) : 0));
  const passes = [
    (bx, by) => rect(g, bx + sh - 1, by + sh - 1, b + 2, b + 2, C.ink),
    (bx, by) => rect(g, bx + sh, by + sh, b, b, C.burgundy),
    (bx, by) => rect(g, bx - 1, by - 1, b + 2, b + 2, C.ink),
    (bx, by, r) => rect(g, bx, by, b, b, LOGO_ROWS[r]),
  ];
  for (const pass of passes) {
    letters.forEach((ch, i) => {
      const glyph = LOGO[ch];
      if (!glyph) return;
      const lx = x0 + i * (lw + gap);
      const ly = y + offs[i];
      glyph.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) if (row[c] === '#') pass(lx + c * b, ly + r * b, r);
      });
    });
  }
}
