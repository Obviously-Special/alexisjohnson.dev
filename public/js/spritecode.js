import { SPRITE_COLORS } from './palette.js';
import { makeCanvas } from './gfx.js';

// Sprites travel as 128 bytes (two pixels per byte) in URL-safe base64,
// so a drawing fits in a share link and in the save file.
export function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64url(str) {
  const clean = str.replace(/-/g, '+').replace(/_/g, '/');
  const s = atob(clean + '='.repeat((4 - (clean.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export function encodeSprite(pix) {
  const bytes = new Uint8Array(128);
  for (let i = 0; i < 128; i++) bytes[i] = ((pix[i * 2] & 15) << 4) | (pix[i * 2 + 1] & 15);
  return b64url(bytes);
}

export function decodeSprite(str) {
  try {
    if (typeof str !== 'string' || str.length > 200) return null;
    const bytes = unb64url(str);
    if (bytes.length !== 128) return null;
    const pix = new Uint8Array(256);
    for (let i = 0; i < 128; i++) {
      pix[i * 2] = bytes[i] >> 4;
      pix[i * 2 + 1] = bytes[i] & 15;
    }
    return pix;
  } catch {
    return null;
  }
}

export function spriteCanvas(pix) {
  const c = makeCanvas(16, 16);
  const g = c.getContext('2d');
  for (let i = 0; i < 256; i++) {
    const col = SPRITE_COLORS[pix[i]];
    if (!col) continue;
    g.fillStyle = col;
    g.fillRect(i % 16, (i / 16) | 0, 1, 1);
  }
  return c;
}
