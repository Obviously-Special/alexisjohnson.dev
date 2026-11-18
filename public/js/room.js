import { C, HOODS } from './palette.js';
import { makeCanvas, ctx2d, rect, px, blit, flipped, line, disc, ellipse, bayer, hexRgb, gradientCanvas } from './gfx.js';
import { playerSprites, CAT, HEART, NOTE, DROP, SPARKLE, ZZZ, DUST, TROPHIES, CARTRIDGE } from './art.js';
import { sfx } from './audio.js';
import { dayPhase, moonPhase, moonSentence, drawMoon, SKY_COLORS } from './sky.js';
import { ACHIEVEMENTS } from './trophies.js';
import { decodeSprite, spriteCanvas } from './spritecode.js';

export const W = 320;
const H = 180;
export const FLOOR = 150;
const SPEED = 74;
const ACCEL = 700;
const DECEL = 1100;
const GRAV = 760;
const JUMP_V = 236;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const approach = (v, t, step) => (v < t ? Math.min(t, v + step) : Math.max(t, v - step));

// Everything you can stand on, highest first.
const PLATFORMS = [
  { id: 'shelf', x0: 287, x1: 317, y: 68 },
  { id: 'tv', x0: 243, x1: 277, y: 98 },
  { id: 'sill', x0: 154, x1: 205, y: 104 },
  { id: 'monitor', x0: 81, x1: 101, y: 110 },
  { id: 'boombox', x0: 213, x1: 233, y: 116 },
  { id: 'back', x0: 152, x1: 204, y: 120 },
  { id: 'armL', x0: 148, x1: 155, y: 126 },
  { id: 'armR', x0: 201, x1: 207, y: 126 },
  { id: 'desk', x0: 75, x1: 131, y: 130 },
  { id: 'table', x0: 211, x1: 235, y: 132 },
  { id: 'seat', x0: 156, x1: 200, y: 134 },
];

// Things you can use: where you stand (x0..x1 at one of `levels`), where the
// prompt appears (ax, ay) and the area you can click or tap (hit).
const ZONES = [
  { id: 'door', x0: 12, x1: 42, levels: ['floor'], label: 'Knock', ax: 27, ay: 82, hit: [12, 84, 30, 66] },
  { id: 'mirror', x0: 43, x1: 56, levels: ['floor'], label: 'Mirror', ax: 51, ay: 99, hit: [44, 100, 13, 24] },
  { id: 'plant', x0: 56, x1: 73, levels: ['floor'], label: 'Water', ax: 64, ay: 108, hit: [56, 108, 17, 42] },
  { id: 'desk', x0: 74, x1: 103, levels: ['floor', 'desk'], label: 'Draw', ax: 91, ay: 107, hit: [74, 108, 30, 42] },
  { id: 'board', x0: 103, x1: 129, levels: ['floor', 'desk'], label: 'Read', ax: 117, ay: 75, hit: [103, 76, 28, 32] },
  { id: 'lamp', x0: 129, x1: 147, levels: ['floor'], label: 'Lamp', ax: 139, ay: 87, hit: [129, 88, 19, 62] },
  { id: 'couch', x0: 150, x1: 206, levels: ['floor', 'seat'], label: 'Sit', ax: 178, ay: 117, hit: [148, 118, 60, 32] },
  { id: 'window', x0: 150, x1: 207, levels: ['back', 'sill', 'armL', 'armR'], label: 'Look out', ax: 179, ay: 53, hit: [154, 50, 52, 56] },
  { id: 'boombox', x0: 208, x1: 237, levels: ['floor', 'table'], label: 'Music', ax: 223, ay: 113, hit: [209, 113, 28, 37] },
  { id: 'tv', x0: 238, x1: 283, levels: ['floor'], label: 'Play', ax: 260, ay: 80, hit: [238, 80, 46, 70] },
  { id: 'shelf', x0: 284, x1: 318, levels: ['floor'], label: 'Trophies', ax: 302, ay: 66, hit: [284, 66, 34, 84] },
];

const GLASS = { x: 159, y: 59, w: 41, h: 42 };
const TVS = { x: 245, y: 101, w: 24, h: 23 };
const MON = { x: 83, y: 113, w: 16, h: 11 };
const SHADE = { x: 130, y: 89, w: 18, h: 15 };
const FRAMES = [{ x: 158, y: 22 }, { x: 182, y: 22 }, { x: 212, y: 62 }];
const SECRET = { x: 296, y: 59 };
const HOOKS = [4, 84, 164, 244, 316];

const ABOUT = [
  'A note pinned to the board:',
  "Hi, I'm Alexis. Welcome to my little room on the internet.",
  'I like video games, especially 2D ones, so this site is a little one.',
  'Make yourself at home: play the TV, draw a sprite, make a loop, pet the cat.',
  "Whatever you make stays in your browser, so it'll still be here next time.",
];

/* ---------- the room, painted once ---------- */

function wireY(x) {
  for (let i = 0; i < HOOKS.length - 1; i++) {
    const a = HOOKS[i];
    const b = HOOKS[i + 1];
    if (x >= a && x <= b) {
      const mid = (a + b) / 2;
      const half = (b - a) / 2;
      return Math.round(10 + 5 * (1 - ((x - mid) / half) ** 2));
    }
  }
  return 10;
}

function makeBulbs() {
  const cols = [C.red, C.lamp, C.mint, C.lilac, C.coral, C.orange];
  const out = [];
  let i = 0;
  for (let x = 9; x < 314; x += 9) {
    if (HOOKS.some((h) => Math.abs(h - x) < 3)) continue;
    out.push({ x, y: wireY(x) + 1, col: cols[i % cols.length], ph: rand(0, 10), sp: rand(1.2, 2.2) });
    i++;
  }
  return out;
}

function panelInset(g, x, y, w, h) {
  rect(g, x, y, w, h, C.wood);
  rect(g, x, y, w, 1, C.woodDark);
  rect(g, x, y, 1, h, C.woodDark);
  rect(g, x, y + h - 1, w, 1, C.woodLight);
  rect(g, x + w - 1, y, 1, h, C.woodLight);
}

function paintWalls(g) {
  rect(g, 0, 0, W, 4, C.ink);
  rect(g, 0, 4, W, 1, C.woodLight);
  rect(g, 0, 5, W, 2, C.wood);
  rect(g, 0, 7, W, 1, C.woodDark);
  rect(g, 0, 8, W, 92, C.tealDark);
  for (let row = 0, y = 13; y < 98; y += 10, row++) {
    for (let x = (row % 2) * 6 + 3; x < W; x += 12) {
      px(g, x, y - 1, C.teal);
      px(g, x - 1, y, C.teal);
      px(g, x + 1, y, C.teal);
      px(g, x, y + 1, C.teal);
    }
  }
  rect(g, 0, 100, W, 1, C.woodLight);
  rect(g, 0, 101, W, 2, C.wood);
  rect(g, 0, 103, W, 1, C.woodDark);
  rect(g, 0, 104, W, 36, C.wood);
  for (let x = 7; x < W; x += 14) {
    rect(g, x, 104, 1, 36, C.woodDark);
    rect(g, x + 1, 104, 1, 36, C.woodLight);
  }
  rect(g, 0, 140, W, 1, C.woodLight);
  rect(g, 0, 141, W, 5, C.woodDark);
  // floorboards
  rect(g, 0, 146, W, 34, C.plumDark);
  const seams = [146, 151, 157, 164, 172, 180];
  for (let i = 0; i < seams.length - 1; i++) {
    const y0 = seams[i];
    const y1 = seams[i + 1];
    rect(g, 0, y0, W, 1, C.ink);
    rect(g, 0, y0 + 1, W, 1, C.plum);
    for (let x = (i * 29) % 47; x < W; x += 47 + i * 6) rect(g, x, y0 + 1, 1, y1 - y0 - 1, C.ink);
  }
  // the corners of the room fall into shadow
  for (let x = 0; x < 6; x++) {
    for (let y = 8; y < 146; y++) {
      if (bayer(x, y) > x / 6) {
        px(g, x, y, C.ink);
        px(g, W - 1 - x, y, C.ink);
      }
    }
  }
  for (let x = HOOKS[0]; x <= HOOKS[HOOKS.length - 1]; x++) px(g, x, wireY(x), C.ink);
  for (const h of HOOKS) rect(g, h, 8, 1, 2, C.woodDark);
}

function paintRug(g) {
  rect(g, 100, 147, 134, 10, C.orangeDark);
  rect(g, 101, 148, 132, 8, C.orange);
  rect(g, 103, 149, 128, 1, C.lamp);
  rect(g, 103, 154, 128, 1, C.lamp);
  for (let x = 108; x < 228; x += 8) {
    px(g, x, 151, C.orangeDark);
    px(g, x - 1, 152, C.orangeDark);
    px(g, x + 1, 152, C.orangeDark);
    px(g, x, 153, C.orangeDark);
  }
  for (let y = 148; y < 157; y += 2) {
    rect(g, 98, y, 2, 1, C.paper);
    rect(g, 234, y, 2, 1, C.paper);
  }
}

function paintDoor(g) {
  rect(g, 12, 108, 30, 42, C.woodDark);
  rect(g, 14, 110, 26, 40, C.wood);
  rect(g, 14, 110, 26, 1, C.woodLight);
  panelInset(g, 17, 113, 20, 13);
  panelInset(g, 17, 130, 20, 16);
  rect(g, 35, 127, 2, 2, C.gold);
  px(g, 36, 128, C.orange);
  rect(g, 21, 115, 11, 8, C.paper);
  rect(g, 23, 117, 7, 1, C.grey);
  rect(g, 23, 119, 5, 1, C.grey);
  rect(g, 23, 121, 6, 1, C.grey);
  rect(g, 25, 114, 3, 1, C.lilac);
  rect(g, 13, 148, 28, 3, C.burgundy);
  rect(g, 13, 148, 28, 1, C.red);
  // clock above the door
  disc(g, 27, 92, 7, C.woodDark);
  disc(g, 27, 92, 6, C.paper);
  px(g, 27, 87, C.grey);
  px(g, 32, 92, C.grey);
  px(g, 27, 97, C.grey);
  px(g, 22, 92, C.grey);
}

function paintMirrorAndPot(g) {
  px(g, 51, 101, C.ink);
  ellipse(g, 51, 112, 6, 10, C.orangeDark);
  ellipse(g, 51, 112, 5, 9, C.gold);
  ellipse(g, 51, 112, 4, 8, C.sky);
  line(g, 48, 109, 50, 107, C.white);
  line(g, 49, 113, 53, 109, C.white);
  // plant pot
  rect(g, 58, 137, 12, 1, C.woodDark);
  rect(g, 57, 138, 14, 3, C.orange);
  rect(g, 57, 140, 14, 1, C.orangeDark);
  for (let y = 141; y < 150; y++) {
    const inset = ((y - 141) / 4) | 0;
    rect(g, 58 + inset, y, 12 - inset * 2, 1, C.orangeDark);
  }
  rect(g, 60, 142, 1, 6, C.orange);
}

function paintPoster(g) {
  rect(g, 64, 26, 32, 44, C.ink);
  g.drawImage(gradientCanvas(30, 42, [C.ink, C.navy, C.violet]), 65, 27);
  drawMoon(g, 88, 36, 4, 0.5, C.glow, C.plum);
  for (const [x, y] of [[69, 33], [77, 30], [83, 43], [72, 41], [92, 46]]) px(g, x, y, C.lilac);
  const roofs = [[65, 55], [72, 58], [79, 53], [87, 57]];
  roofs.forEach(([x, y], i) => {
    const w = i === roofs.length - 1 ? 95 - x : roofs[i + 1][0] - x;
    rect(g, x, y, w, 69 - y, C.plumDark);
    rect(g, x, y, w, 1, C.lavender);
  });
  for (const [x, y] of [[67, 59], [68, 63], [75, 62], [82, 57], [84, 61], [90, 60]]) px(g, x, y, C.lamp);
  blit(g, CAT.jump, 71, 43);
  rect(g, 67, 29, 13, 2, C.lamp);
  rect(g, 67, 32, 9, 1, C.coral);
  rect(g, 78, 25, 4, 2, C.lilac);
}

function paintBoardAndDesk(g) {
  // corkboard
  rect(g, 104, 78, 26, 20, C.wood);
  rect(g, 105, 79, 24, 18, C.tan);
  for (let i = 0; i < 26; i++) px(g, 105 + ((i * 7) % 24), 79 + ((i * 5) % 18), C.woodLight);
  rect(g, 107, 81, 11, 14, C.paper);
  for (const [w, y] of [[7, 84], [6, 86], [7, 88], [4, 90]]) rect(g, 109, y, w, 1, C.grey);
  px(g, 112, 81, C.red);
  rect(g, 119, 81, 9, 10, C.paper);
  rect(g, 120, 82, 7, 5, C.blue);
  rect(g, 120, 85, 7, 2, C.green);
  px(g, 125, 83, C.gold);
  px(g, 123, 81, C.blue);
  rect(g, 120, 92, 7, 4, C.lamp);
  // desk
  rect(g, 74, 130, 58, 1, C.woodLight);
  rect(g, 74, 131, 58, 3, C.wood);
  rect(g, 74, 134, 58, 1, C.woodDark);
  rect(g, 93, 135, 33, 15, C.plumDark);
  rect(g, 76, 135, 17, 15, C.wood);
  rect(g, 76, 135, 1, 15, C.woodLight);
  rect(g, 92, 135, 1, 15, C.woodDark);
  rect(g, 77, 142, 15, 1, C.woodDark);
  px(g, 84, 138, C.gold);
  px(g, 84, 146, C.gold);
  rect(g, 126, 135, 4, 15, C.wood);
  rect(g, 129, 135, 1, 15, C.woodDark);
  // beige computer
  rect(g, 80, 110, 22, 17, C.beige);
  rect(g, 101, 110, 1, 17, C.beigeDark);
  rect(g, 80, 126, 22, 1, C.beigeDark);
  rect(g, 82, 112, 18, 13, C.beigeDark);
  rect(g, 87, 127, 8, 3, C.beigeDark);
  px(g, 98, 125, C.green);
  rect(g, 80, 128, 20, 2, C.beige);
  for (let x = 81; x < 99; x += 2) px(g, x, 128, C.beigeDark);
  // drawing tablet, pen and a mug
  rect(g, 104, 128, 16, 2, C.ink);
  rect(g, 105, 128, 14, 1, C.grey);
  line(g, 114, 123, 119, 127, C.red);
  rect(g, 123, 124, 4, 6, C.paper);
  rect(g, 127, 125, 1, 3, C.paper);
  rect(g, 123, 124, 4, 1, C.woodDark);
}

function paintLamp(g) {
  rect(g, 134, 148, 10, 2, C.ink);
  rect(g, 135, 147, 8, 1, C.plum);
  rect(g, 138, 104, 2, 43, C.orangeDark);
  rect(g, 138, 104, 1, 43, C.orange);
}

function paintWindow(g) {
  rect(g, 156, 56, 47, 48, C.paper);
  rect(g, 156, 103, 47, 1, C.greyLight);
  rect(g, 159, 59, 41, 42, C.ink);
  rect(g, 153, 104, 53, 2, C.paper);
  rect(g, 153, 106, 53, 2, C.greyLight);
  rect(g, 154, 108, 51, 1, C.grey);
  // curtain rod and curtains
  rect(g, 146, 50, 66, 2, C.woodDark);
  rect(g, 144, 49, 2, 4, C.gold);
  rect(g, 212, 49, 2, 4, C.gold);
  for (const x0 of [148, 201]) {
    const left = x0 < 180;
    for (let y = 52; y < 112; y++) {
      const waist = y >= 84 && y <= 88 ? 2 : 0;
      const x = left ? x0 : x0 + waist;
      const w = 10 - waist;
      rect(g, x, y, w, 1, C.lavender);
      for (let k = 2; k < w; k += 3) px(g, x + k, y, C.violet);
    }
    rect(g, left ? x0 : x0 + 2, 86, 8, 1, C.gold);
    rect(g, x0, 111, 10, 1, C.violet);
  }
}

function paintCouch(g) {
  rect(g, 151, 120, 54, 16, C.burgundy);
  rect(g, 151, 120, 54, 2, C.red);
  for (let x = 157; x < 204; x += 8) px(g, x, 127, C.plumDark);
  for (const x of [148, 200]) {
    rect(g, x, 126, 8, 20, C.burgundy);
    rect(g, x, 126, 8, 2, C.red);
    px(g, x, 126, C.wood);
    px(g, x + 7, 126, C.wood);
  }
  rect(g, 156, 134, 44, 8, C.burgundy);
  rect(g, 156, 134, 44, 2, C.red);
  rect(g, 178, 134, 1, 8, C.plumDark);
  rect(g, 150, 142, 56, 5, C.burgundy);
  rect(g, 150, 146, 56, 1, C.plumDark);
  rect(g, 152, 147, 2, 3, C.woodDark);
  rect(g, 202, 147, 2, 3, C.woodDark);
  // a mustard cushion
  rect(g, 158, 128, 9, 6, C.lamp);
  rect(g, 158, 133, 9, 1, C.orange);
  px(g, 158, 128, C.burgundy);
  px(g, 166, 128, C.burgundy);
}

function paintTableStandTv(g) {
  rect(g, 210, 132, 26, 2, C.woodLight);
  rect(g, 210, 134, 26, 1, C.wood);
  rect(g, 221, 135, 4, 13, C.wood);
  rect(g, 224, 135, 1, 13, C.woodDark);
  rect(g, 216, 148, 14, 2, C.wood);
  // TV stand with a console and some cartridges
  rect(g, 238, 130, 44, 2, C.woodLight);
  rect(g, 238, 132, 44, 15, C.wood);
  rect(g, 238, 147, 44, 1, C.woodDark);
  rect(g, 241, 134, 18, 12, C.plumDark);
  rect(g, 261, 134, 18, 12, C.plumDark);
  rect(g, 243, 140, 14, 6, C.greyLight);
  rect(g, 243, 140, 14, 1, C.white);
  rect(g, 246, 142, 8, 1, C.ink);
  px(g, 255, 144, C.red);
  [C.red, C.blue, C.green, C.lavender, C.lamp, C.coral].forEach((col, i) => rect(g, 262 + i * 3, 137 + (i % 2), 2, 9 - (i % 2), col));
  rect(g, 239, 148, 3, 2, C.woodDark);
  rect(g, 278, 148, 3, 2, C.woodDark);
  // wood-grain CRT
  rect(g, 242, 98, 36, 32, C.wood);
  rect(g, 242, 98, 36, 1, C.woodLight);
  rect(g, 242, 129, 36, 1, C.woodDark);
  for (const [x, y, w] of [[242, 104, 2], [242, 118, 2], [247, 126, 9], [262, 127, 6]]) rect(g, x, y, w, 1, C.woodDark);
  rect(g, 244, 100, 26, 25, C.ink);
  rect(g, 271, 101, 6, 24, C.woodDark);
  disc(g, 274, 105, 2, C.greyLight);
  px(g, 274, 105, C.grey);
  disc(g, 274, 111, 2, C.greyLight);
  px(g, 274, 111, C.grey);
  for (let y = 116; y < 124; y += 2) rect(g, 272, y, 4, 1, C.ink);
  rect(g, 255, 96, 7, 2, C.grey);
  line(g, 257, 96, 250, 84, C.grey);
  line(g, 260, 96, 268, 82, C.grey);
  px(g, 250, 83, C.greyLight);
  px(g, 268, 81, C.greyLight);
}

function paintShelf(g) {
  rect(g, 286, 68, 32, 82, C.woodDark);
  rect(g, 288, 72, 28, 71, C.plumDark);
  rect(g, 286, 68, 32, 1, C.woodLight);
  rect(g, 286, 69, 32, 3, C.wood);
  for (const y of [86, 104, 122, 140]) {
    rect(g, 288, y, 28, 1, C.woodLight);
    rect(g, 288, y + 1, 28, 2, C.wood);
  }
  const books = [[3, 12, C.red], [2, 10, C.navy], [3, 13, C.mint], [2, 11, C.lamp], [3, 12, C.lavender], [2, 9, C.coral], [3, 13, C.teal], [2, 11, C.burgundy], [3, 10, C.blue]];
  let x = 289;
  for (const [w, h, col] of books) {
    rect(g, x, 140 - h, w, h, col);
    rect(g, x, 142 - h, w, 1, C.paper);
    x += w;
  }
  rect(g, 288, 143, 28, 6, C.wood);
  rect(g, 288, 143, 28, 1, C.woodLight);
  rect(g, 301, 145, 2, 1, C.gold);
}

function paintRoom(g) {
  paintWalls(g);
  paintRug(g);
  paintDoor(g);
  paintMirrorAndPot(g);
  paintPoster(g);
  paintBoardAndDesk(g);
  paintLamp(g);
  paintWindow(g);
  paintCouch(g);
  paintTableStandTv(g);
  paintShelf(g);
}

/* ---------- the cat ---------- */

class Cat {
  constructor(room) {
    this.room = room;
    this.x = 186;
    this.y = 134;
    this.level = 'seat';
    this.dir = -1;
    this.state = 'sleep';
    this.timer = rand(10, 18);
    this.animT = 0;
    this.hop = null;
    this.targetX = 0;
    this.next = null;
    this.heartT = 0;
    this.zT = 1;
  }

  update(dt) {
    this.animT += dt;
    if (this.hop) {
      const h = this.hop;
      h.t += dt;
      const k = Math.min(1, h.t / h.dur);
      this.x = h.x0 + (h.x1 - h.x0) * k;
      this.y = h.y0 + (h.y1 - h.y0) * k - Math.sin(k * Math.PI) * h.arc;
      if (k >= 1) {
        this.x = h.x1;
        this.y = h.y1;
        this.level = h.level;
        this.hop = null;
        this.setState(h.after);
      }
      return;
    }
    this.timer -= dt;
    if (this.state === 'walk') {
      const dx = this.targetX - this.x;
      if (Math.abs(dx) < 1) {
        this.x = this.targetX;
        this.arrive();
      } else {
        this.dir = Math.sign(dx);
        this.x += this.dir * Math.min(Math.abs(dx), 26 * dt);
      }
    } else if (this.state === 'pet') {
      this.heartT -= dt;
      if (this.heartT <= 0) {
        this.heartT = 0.35;
        this.room.spawn(HEART, this.x + rand(-4, 4), this.y - 12, { vy: -14, life: 0.9 });
      }
      if (this.timer <= 0) this.setState('sit');
    } else if (this.state === 'sleep') {
      this.zT -= dt;
      if (this.zT <= 0) {
        this.zT = 2.4;
        this.room.spawn(ZZZ, this.x + 5 * this.dir, this.y - 9, { vx: 3, vy: -6, life: 1.6 });
      }
      if (this.timer <= 0) this.setState('sit', rand(1.5, 3));
    } else if (this.timer <= 0) {
      this.decide();
    }
  }

  setState(s, t) {
    this.state = s;
    this.timer = t ?? (s === 'sit' ? rand(2, 5) : s === 'sleep' ? rand(14, 26) : s === 'pet' ? 2.2 : 2);
  }

  decide() {
    if (this.level !== 'floor') {
      const x1 = clamp(this.x + (Math.random() < 0.5 ? -16 : 16), 76, 280);
      this.dir = Math.sign(x1 - this.x) || 1;
      this.hop = { x0: this.x, y0: this.y, x1, y1: FLOOR, level: 'floor', t: 0, dur: 0.45, arc: 8, after: 'sit' };
      return;
    }
    const r = Math.random();
    if (r < 0.16) return this.goTo({ x: 186, y: 134, level: 'seat' });
    if (r < 0.28) return this.goTo({ x: 264, y: 98, level: 'tv' });
    if (r < 0.42) return this.setState('sleep');
    this.targetX = clamp(this.x + rand(-90, 90), 76, 282);
    this.next = null;
    this.state = 'walk';
  }

  goTo(spot) {
    this.targetX = clamp(spot.x - 18, 76, 282);
    this.next = spot;
    this.state = 'walk';
  }

  arrive() {
    if (this.next) {
      const n = this.next;
      this.next = null;
      this.dir = Math.sign(n.x - this.x) || 1;
      const high = n.level === 'tv';
      this.hop = { x0: this.x, y0: this.y, x1: n.x, y1: n.y, level: n.level, t: 0, dur: high ? 0.6 : 0.45, arc: high ? 14 : 10, after: Math.random() < 0.7 ? 'sleep' : 'sit' };
    } else {
      this.setState(Math.random() < 0.3 ? 'sleep' : 'sit');
    }
  }

  pet(fromX) {
    this.dir = fromX < this.x ? -1 : 1;
    this.next = null;
    this.setState('pet');
    this.heartT = 0;
  }

  draw(g) {
    const flip = this.dir < 0;
    if (this.state === 'sleep' && !this.hop) {
      // breathing: the cat's back rises by a pixel now and then
      const up = Math.sin(this.animT * 1.8) > 0.2 ? 1 : 0;
      const x = Math.round(this.x - 7);
      const y = Math.round(this.y - 6);
      const src = flip ? flipped(CAT.sleep) : CAT.sleep;
      g.drawImage(src, 0, 0, 14, 3, x, y - up, 14, 3);
      if (up) g.drawImage(src, 0, 2, 14, 1, x, y + 2, 14, 1);
      g.drawImage(src, 0, 3, 14, 3, x, y + 3, 14, 3);
      return;
    }
    let spr = CAT.sit;
    if (this.hop) spr = CAT.jump;
    else if (this.state === 'walk') spr = Math.floor(this.animT * 6) % 2 ? CAT.walkA : CAT.walkB;
    else if (this.state === 'pet') spr = CAT.happy;
    blit(g, spr, this.x - spr.width / 2, this.y - spr.height, flip);
  }
}

/* ---------- the room scene ---------- */

export class Room {
  constructor(game) {
    this.game = game;
    this.bg = makeCanvas(W, H);
    paintRoom(ctx2d(this.bg));
    this.lightCanvas = makeCanvas(W, H);
    this.lightKey = '';
    this.bulbs = makeBulbs();
    this.stars = Array.from({ length: 16 }, () => ({ x: Math.floor(rand(1, GLASS.w - 1)), y: Math.floor(rand(1, 27)), sp: rand(0.8, 2.4), ph: rand(0, 6) }));
    this.clouds = [{ x: 4, y: 8, v: 2.2 }, { x: 30, y: 19, v: 1.4 }];
    this.skyCache = {};
    this.tvBg = gradientCanvas(TVS.w, TVS.h, [C.ink, C.navy, C.violet]);
    this.spriteCache = [];
    this.parts = [];
    this.t = 0;
    this.camX = (W - game.view.w) / 2;
    this.near = null;
    this.sayState = null;
    this.showPlayer = true;
    this.lastBeat = -1;
    this.waterPerk = 0;
    this.player = {
      x: 30, y: FLOOR, vx: 0, vy: 0, onGround: true, level: 'floor', facing: 1,
      walkT: 0, blinkT: 2.5, blinking: false, sitting: false, sitT: 0, zT: 0,
      auto: null, dropFrom: null, dropUntil: 0, coyote: 0, jumpHeld: false,
    };
    this.cat = new Cat(this);
    this.lampOn = null;
    this.refreshSky();
    this.applyHood();
  }

  refreshSky() {
    const now = this.game.now();
    const sky = dayPhase(now);
    if (!this.sky || sky.phase !== this.sky.phase) this.lightKey = '';
    this.sky = sky;
    this.moon = moonPhase(now);
    if (this.lampOn === null) this.lampOn = sky.phase !== 'day';
    this.skyTimer = 20;
  }

  applyHood() {
    const s = this.game.save;
    let h = HOODS.find((x) => x.id === s.hood);
    if (!h || (h.secret && !s.golden)) {
      h = HOODS[Math.floor(Math.random() * (HOODS.length - 1))];
      s.hood = h.id;
    }
    this.hoodSprites = playerSprites(h);
  }

  enter(opts = {}) {
    this.showPlayer = true;
    const p = this.player;
    const vw = this.game.view.w;
    if (opts.entering) {
      Object.assign(p, { x: 27, y: FLOOR, vx: 0, vy: 0, onGround: true, level: 'floor', facing: 1, sitting: false });
      p.auto = { x: 50, then: null };
    }
    if (opts.fromTV) {
      Object.assign(p, { x: 258, y: FLOOR, vx: 0, vy: 0, onGround: true, level: 'floor', facing: -1, sitting: false, auto: null });
    }
    this.camX = clamp(p.x - vw / 2, 0, W - vw);
  }

  exit() {
    this.game.hud.hideAll();
    this.sayState = null;
  }

  // Used behind the title screen: the room keeps living, nobody walks around.
  ambient(dt) {
    this.t += dt;
    this.skyTimer -= dt;
    if (this.skyTimer <= 0) this.refreshSky();
    this.cat.update(dt);
    this.updateParts(dt);
    const vw = this.game.view.w;
    this.camX = (W - vw) / 2;
  }

  update(dt) {
    this.t += dt;
    this.skyTimer -= dt;
    if (this.skyTimer <= 0) this.refreshSky();
    const game = this.game;
    const input = game.input;
    const busy = game.busy();
    if (busy) this.settle(dt);
    else this.updatePlayer(dt, input);
    this.cat.update(dt);
    this.updateParts(dt);
    if (this.waterPerk > 0) this.waterPerk -= dt;

    const bb = game.boombox;
    if (bb && bb.playing && bb.beats !== this.lastBeat) {
      this.lastBeat = bb.beats;
      if (bb.beats % 2 === 0) this.spawn(NOTE, 223 + rand(-7, 7), 112, { vx: rand(-5, 5), vy: -16, life: 1.6 });
    }

    this.near = busy ? null : this.findNear();
    if (!busy && this.near && (input.pressed('use') || input.pressed('up'))) this.interact(this.near.id);

    const p = this.player;
    if (!game.save.golden && p.onGround && p.level === 'shelf') this.collectSecret();

    const vw = game.view.w;
    const target = clamp(p.x - vw / 2, 0, W - vw);
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    if (Math.abs(target - this.camX) < 0.3) this.camX = target;

    if (this.sayState) {
      this.sayState.t -= dt;
      if (this.sayState.t <= 0) this.sayState = null;
    }
    this.updateHud();
  }

  updateHud() {
    const { s } = this.game.view;
    const cx = Math.round(this.camX);
    const hud = this.game.hud;
    if (this.near && !this.game.busy()) {
      const key = this.game.touch ? '' : '↑ ';
      hud.setPrompt(`${key}${this.near.label}`, (this.near.ax - cx) * s, this.near.ay * s);
    } else {
      hud.setPrompt(null);
    }
    if (this.sayState && !this.game.busy()) hud.setSay(this.sayState.text, (this.sayState.x - cx) * s, this.sayState.y * s);
    else hud.setSay(null);
  }

  /* ----- the player ----- */

  updatePlayer(dt, input) {
    const p = this.player;
    let move = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
    if (move !== 0 || input.pressed('jump')) p.auto = null;

    if (p.sitting) {
      p.sitT += dt;
      p.zT -= dt;
      if (p.sitT > 8 && p.zT <= 0) {
        p.zT = 1.8;
        this.spawn(ZZZ, p.x + 6, p.y - 18, { vx: 4, vy: -7, life: 1.5 });
      }
      if (p.sitT > 20) this.game.unlock('couch');
      if (move !== 0 || input.pressed('jump') || input.pressed('down') || input.pressed('up') || p.auto) {
        p.sitting = false;
      } else {
        this.blink(dt);
        return;
      }
    }

    if (p.auto && p.onGround) {
      const dx = p.auto.x - p.x;
      if (Math.abs(dx) <= 1.5) {
        const then = p.auto.then;
        p.auto = null;
        p.vx = 0;
        move = 0;
        then?.();
      } else {
        move = Math.sign(dx);
      }
    }

    const target = move * SPEED;
    const speeding = target !== 0 && (p.vx === 0 || Math.sign(target) === Math.sign(p.vx));
    p.vx = approach(p.vx, target, (speeding ? ACCEL : DECEL) * dt);
    if (move) p.facing = move;

    const wantJump = input.pressed('jump') || (input.pressed('up') && !this.near);
    if (wantJump && (p.onGround || p.coyote > 0) && !p.auto) {
      p.vy = -JUMP_V;
      p.onGround = false;
      p.coyote = 0;
      p.jumpHeld = true;
      sfx.jump();
    }
    if (p.jumpHeld && !(input.held('jump') || input.held('up'))) {
      p.jumpHeld = false;
      if (p.vy < -90) p.vy = -90;
    }
    if (input.pressed('down') && p.onGround && p.level !== 'floor') this.dropDown();

    this.physics(dt);
    if (p.onGround && Math.abs(p.vx) > 8) p.walkT += dt;
    this.blink(dt);
  }

  dropDown() {
    const p = this.player;
    p.dropFrom = p.level;
    p.dropUntil = this.t + 0.3;
    p.onGround = false;
    p.vy = 30;
  }

  settle(dt) {
    const p = this.player;
    p.vx = approach(p.vx, 0, DECEL * dt);
    if (!p.sitting) this.physics(dt);
    this.blink(dt);
  }

  blink(dt) {
    const p = this.player;
    p.blinkT -= dt;
    p.blinking = p.blinkT < 0;
    if (p.blinkT < -0.13) p.blinkT = rand(2, 5);
  }

  physics(dt) {
    const p = this.player;
    const prevY = p.y;
    p.x = clamp(p.x + p.vx * dt, 7, W - 7);
    if (p.onGround) {
      if (p.level !== 'floor') {
        const pl = PLATFORMS.find((q) => q.id === p.level);
        if (!pl || p.x < pl.x0 || p.x > pl.x1) {
          p.onGround = false;
          p.coyote = 0.08;
          p.vy = 0;
        }
      }
      if (p.onGround) return;
    } else {
      p.coyote = Math.max(0, p.coyote - dt);
    }
    p.vy = Math.min(p.vy + GRAV * dt, 420);
    let ny = p.y + p.vy * dt;
    if (p.vy >= 0) {
      let landed = null;
      for (const pl of PLATFORMS) {
        if (pl.id === p.dropFrom && this.t < p.dropUntil) continue;
        if (p.x >= pl.x0 && p.x <= pl.x1 && prevY <= pl.y && ny >= pl.y) {
          landed = pl;
          break;
        }
      }
      if (landed) {
        ny = landed.y;
        this.land(landed.id);
      } else if (ny >= FLOOR) {
        ny = FLOOR;
        this.land('floor');
      }
    }
    p.y = ny;
  }

  land(level) {
    const p = this.player;
    if (p.vy > 170) {
      sfx.land();
      this.spawn(DUST, p.x - 5, p.y - 1, { vx: -14, vy: -4, life: 0.3 });
      this.spawn(DUST, p.x + 5, p.y - 1, { vx: 14, vy: -4, life: 0.3 });
    }
    p.onGround = true;
    p.vy = 0;
    p.level = level;
    p.dropFrom = null;
  }

  findNear() {
    const p = this.player;
    if (!p.onGround || p.sitting || p.auto) return null;
    const c = this.cat;
    if (!c.hop && Math.abs(c.x - p.x) < 13 && Math.abs(c.y - p.y) <= 16) {
      return { id: 'cat', label: c.state === 'sleep' ? 'Pet (gently)' : 'Pet', ax: c.x, ay: c.y - 16 };
    }
    for (const z of ZONES) {
      if (p.x >= z.x0 && p.x <= z.x1 && z.levels.includes(p.level)) {
        if (z.id === 'lamp') return { ...z, label: this.lampOn ? 'Lamp off' : 'Lamp on' };
        return z;
      }
    }
    return null;
  }

  /* ----- walking somewhere because of a tap or a button ----- */

  walkTo(x, then) {
    const p = this.player;
    p.sitting = false;
    if (p.onGround && p.level !== 'floor') this.dropDown();
    p.auto = { x: clamp(x, 8, W - 8), then };
  }

  go(id) {
    const p = this.player;
    if (id === 'cat') {
      const c = this.cat;
      const side = p.x < c.x ? -12 : 12;
      this.walkTo(c.x + side, () => {
        if (Math.abs(this.cat.x - this.player.x) < 26) this.interact('cat');
        else this.go('cat');
      });
      return;
    }
    const z = ZONES.find((q) => q.id === id);
    if (!z) return;
    const x = id === 'window' ? 178 : clamp(p.x, z.x0 + 3, z.x1 - 3);
    this.walkTo(x, () => this.interact(id));
  }

  onPointer(gx, gy) {
    const game = this.game;
    if (game.dialog.active) {
      game.dialog.clicked = true;
      return;
    }
    if (game.busy()) return;
    const wx = gx + Math.round(this.camX);
    const c = this.cat;
    if (Math.abs(wx - c.x) < 10 && gy > c.y - 14 && gy < c.y + 2) return this.go('cat');
    for (const z of ZONES) {
      const [x, y, w, h] = z.hit;
      if (wx >= x && wx < x + w && gy >= y && gy < y + h) return this.go(z.id);
    }
    this.walkTo(wx, null);
  }

  promptClicked() {
    if (this.near && !this.game.busy()) this.interact(this.near.id);
  }

  /* ----- what everything does ----- */

  interact(id) {
    const game = this.game;
    switch (id) {
      case 'door':
        sfx.knock();
        this.talk(["The door's locked.", 'A note taped to it says: "More rooms coming soon."']);
        break;
      case 'mirror': this.nextHood(); break;
      case 'plant': this.water(); break;
      case 'desk': game.openStudio(); break;
      case 'board': this.talk(ABOUT); break;
      case 'lamp': this.toggleLamp(); break;
      case 'couch': this.sit(); break;
      case 'window': this.talk(this.windowLines()); break;
      case 'boombox': game.openBoombox(); break;
      case 'tv': game.startRooftop(); break;
      case 'shelf': game.openTrophies(); break;
      case 'cat': this.petCat(); break;
      default:
    }
  }

  talk(pages, then) {
    this.game.dialog.open(pages, then);
  }

  say(text, x, y) {
    this.sayState = { text, x, y, t: 1.6 };
  }

  nextHood() {
    const s = this.game.save;
    const list = HOODS.filter((h) => !h.secret || s.golden);
    const i = list.findIndex((h) => h.id === s.hood);
    const next = list[(i + 1) % list.length];
    s.hood = next.id;
    this.game.write();
    this.applyHood();
    sfx.select();
    for (let k = 0; k < 5; k++) this.spawn(SPARKLE, this.player.x + rand(-9, 9), this.player.y - rand(4, 22), { vy: -6, life: 0.6 });
    this.say(`${next.name}!`, this.player.x, this.player.y - 22);
    this.game.unlock('mirror');
  }

  water() {
    for (let i = 0; i < 7; i++) this.spawn(DROP, 59 + Math.random() * 10, 104 + Math.random() * 6, { vy: 20 + Math.random() * 20, g: 160, life: 0.5 });
    sfx.water();
    const s = this.game.save;
    s.waters++;
    this.waterPerk = 1.2;
    this.game.write();
    this.game.unlock('plant');
    if (!s.flags.plantTold) {
      s.flags.plantTold = true;
      this.game.write();
      this.talk(['You water the plant.', 'It grows a little on every day you come by.']);
    } else {
      this.say('Glug glug.', 64, 106);
    }
  }

  toggleLamp() {
    this.lampOn = !this.lampOn;
    this.lightKey = '';
    sfx.click();
    this.say(this.lampOn ? 'Click.' : 'Click. Cozy.', 139, 86);
    if (!this.lampOn) this.game.unlock('lights');
  }

  sit() {
    const p = this.player;
    Object.assign(p, { sitting: true, sitT: 0, zT: 0, x: clamp(p.x, 162, 196), y: 134, level: 'seat', onGround: true, vx: 0, vy: 0, auto: null });
    sfx.select();
  }

  petCat() {
    const c = this.cat;
    if (c.hop) return;
    const wasAsleep = c.state === 'sleep';
    c.pet(this.player.x);
    sfx.purr();
    if (wasAsleep) sfx.meow();
    const s = this.game.save;
    s.pets++;
    this.game.write();
    this.game.unlock('kitty');
    this.say(wasAsleep ? 'Mrrp?' : 'Purrr...', c.x, c.y - 14);
  }

  collectSecret() {
    const s = this.game.save;
    s.golden = true;
    this.game.write();
    sfx.coin();
    for (let k = 0; k < 10; k++) {
      this.spawn(SPARKLE, SECRET.x + 5 + rand(-10, 10), SECRET.y + rand(-8, 6), { vx: rand(-20, 20), vy: rand(-30, 0), life: 0.9 });
    }
    this.game.unlock('secret');
    this.talk(['You found the golden cartridge!', 'The picture frames are gold now, and the mirror has a new color for you.']);
  }

  windowLines() {
    const d = this.game.now();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const ph = this.sky.phase;
    const second =
      ph === 'night' ? moonSentence(this.moon) :
      ph === 'dusk' ? 'The sun is going down behind the rooftops.' :
      ph === 'dawn' ? 'The sky over the rooftops is getting lighter.' :
      'Blue sky over the rooftops. Good weather for staying in.';
    return [`It's ${time} where you are.`, second];
  }

  /* ----- particles ----- */

  spawn(spr, x, y, { vx = 0, vy = -12, g = 0, life = 1.2 } = {}) {
    this.parts.push({ spr, x, y, vx, vy, g, life, max: life });
    if (this.parts.length > 80) this.parts.shift();
  }

  updateParts(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  /* ----- drawing ----- */

  draw(g) {
    const cx = Math.round(this.camX);
    g.save();
    g.translate(-cx, 0);
    g.drawImage(this.bg, 0, 0);
    this.drawSky(g);
    this.drawClock(g);
    this.drawBulbs(g);
    this.drawFrames(g);
    this.drawShade(g);
    this.drawMonitor(g);
    this.drawTV(g);
    this.drawBoombox(g);
    this.drawPlant(g);
    this.drawTrophies(g);
    this.drawSecret(g);
    this.cat.draw(g);
    if (this.showPlayer) this.drawPlayer(g);
    for (const p of this.parts) {
      if (p.life < 0.3 && Math.floor(p.life * 20) % 2) continue;
      blit(g, p.spr, p.x - (p.spr.width >> 1), p.y - (p.spr.height >> 1));
    }
    if (this.sky.ambient < 1) {
      this.computeLight();
      g.drawImage(this.lightCanvas, 0, 0);
    }
    g.restore();
  }

  buildSky(phase) {
    const sc = SKY_COLORS[phase];
    const bg = gradientCanvas(GLASS.w, GLASS.h, sc.sky);
    const city = makeCanvas(GLASS.w, GLASS.h);
    const cg = ctx2d(city);
    const widths = [7, 5, 9, 6, 8];
    const heights = [12, 8, 15, 10, 6, 13, 9, 11];
    let x = 0;
    let i = 0;
    while (x < GLASS.w) {
      const bw = widths[i % widths.length];
      const bh = heights[i % heights.length];
      rect(cg, x, GLASS.h - bh, bw, bh, sc.city);
      if (i % 3 === 1) rect(cg, x + 2, GLASS.h - bh - 3, 1, 3, sc.city);
      for (let wy = GLASS.h - bh + 2; wy < GLASS.h - 1; wy += 3) {
        for (let wx = x + 1; wx < x + bw - 1; wx += 2) {
          const r = ((wx * 73856093) ^ (wy * 19349663)) >>> 0;
          if ((r % 1000) / 1000 < sc.lit) px(cg, wx, wy, C.lamp);
        }
      }
      x += bw;
      i++;
    }
    return { bg, city };
  }

  drawSky(g) {
    const { phase } = this.sky;
    if (!this.skyCache[phase]) this.skyCache[phase] = this.buildSky(phase);
    const sky = this.skyCache[phase];
    g.drawImage(sky.bg, GLASS.x, GLASS.y);
    g.save();
    g.beginPath();
    g.rect(GLASS.x, GLASS.y, GLASS.w, GLASS.h);
    g.clip();
    if (phase !== 'day') {
      for (const s of this.stars) {
        if (phase !== 'night' && s.y > 14) continue;
        if (Math.sin(this.t * s.sp + s.ph) > -0.6) px(g, GLASS.x + s.x, GLASS.y + s.y, s.y < 9 ? C.glow : C.lilac);
      }
    }
    if (phase === 'night') drawMoon(g, GLASS.x + 30, GLASS.y + 9, 4, this.moon, C.glow, C.plum);
    if (phase === 'dusk') disc(g, GLASS.x + 11, GLASS.y + 31, 4, C.lamp);
    if (phase === 'dawn') disc(g, GLASS.x + 30, GLASS.y + 32, 4, C.glow);
    if (phase === 'day') {
      disc(g, GLASS.x + 8, GLASS.y + 8, 3, C.glow);
      for (const c of this.clouds) {
        const x = GLASS.x - 14 + ((c.x + this.t * c.v) % (GLASS.w + 22));
        this.cloud(g, Math.round(x), GLASS.y + c.y);
      }
    }
    g.drawImage(sky.city, GLASS.x, GLASS.y);
    g.restore();
    rect(g, 179, 59, 1, 42, C.paper);
    rect(g, 159, 79, 41, 1, C.paper);
  }

  cloud(g, x, y) {
    rect(g, x + 2, y, 6, 1, C.white);
    rect(g, x, y + 1, 12, 2, C.white);
    rect(g, x + 1, y + 3, 10, 1, C.sky);
  }

  drawClock(g) {
    const d = this.game.now();
    const m = d.getMinutes();
    const h = (d.getHours() % 12) + m / 60;
    const am = (m / 60) * Math.PI * 2;
    const ah = (h / 12) * Math.PI * 2;
    line(g, 27, 92, 27 + Math.round(Math.sin(ah) * 3), 92 - Math.round(Math.cos(ah) * 3), C.ink);
    line(g, 27, 92, 27 + Math.round(Math.sin(am) * 5), 92 - Math.round(Math.cos(am) * 5), C.ink);
    px(g, 27, 92, C.red);
  }

  drawBulbs(g) {
    const dark = this.sky.phase !== 'day';
    for (const b of this.bulbs) {
      const on = !dark || Math.sin(this.t * b.sp + b.ph) > -0.8;
      rect(g, b.x, b.y, 2, 2, on ? b.col : C.plum);
      if (on && dark) px(g, b.x, b.y, C.glow);
    }
  }

  spriteFor(i) {
    const code = this.game.save.sprites[i];
    if (!code) return null;
    if (!this.spriteCache[i] || this.spriteCache[i].code !== code) {
      const pix = decodeSprite(code);
      this.spriteCache[i] = { code, spr: pix ? spriteCanvas(pix) : null };
    }
    return this.spriteCache[i].spr;
  }

  drawFrames(g) {
    const gold = this.game.save.golden;
    FRAMES.forEach((f, i) => {
      line(g, f.x + 4, f.y, f.x + 10, f.y - 4, C.ink);
      line(g, f.x + 15, f.y, f.x + 10, f.y - 4, C.ink);
      rect(g, f.x, f.y, 20, 20, gold ? C.orange : C.woodDark);
      rect(g, f.x + 1, f.y + 1, 18, 18, gold ? C.gold : C.woodLight);
      rect(g, f.x + 2, f.y + 2, 16, 16, C.paper);
      const spr = this.spriteFor(i);
      if (spr) {
        g.drawImage(spr, f.x + 2, f.y + 2);
      } else {
        rect(g, f.x + 9, f.y + 7, 2, 6, C.greyLight);
        rect(g, f.x + 7, f.y + 9, 6, 2, C.greyLight);
      }
    });
  }

  drawShade(g) {
    const on = this.lampOn;
    for (let i = 0; i < 14; i++) {
      const half = 5 + Math.floor((i * 4) / 13);
      rect(g, 139 - half, 90 + i, half * 2, 1, on ? C.glow : C.paper);
    }
    rect(g, 130, 103, 18, 1, on ? C.lamp : C.beigeDark);
    rect(g, 135, 89, 8, 1, C.orangeDark);
    if (!on) for (let i = 1; i < 13; i += 3) rect(g, 139 - 5 - Math.floor((i * 4) / 13), 90 + i, 1, 1, C.beige);
  }

  latestSprite() {
    for (let i = 2; i >= 0; i--) {
      const s = this.spriteFor(i);
      if (s) return s;
    }
    return null;
  }

  drawMonitor(g) {
    const { x, y, w, h } = MON;
    rect(g, x, y, w, h, C.paper);
    rect(g, x, y, w, 2, C.lavender);
    px(g, x + w - 2, y, C.red);
    [C.red, C.lamp, C.green, C.blue].forEach((col, i) => rect(g, x + 1, y + 3 + i * 2, 2, 2, col));
    const spr = this.latestSprite();
    if (spr) {
      g.drawImage(spr, 0, 0, 16, 16, x + 6, y + 2, 8, 8);
    } else if (Math.floor(this.t * 2) % 2) {
      rect(g, x + 9, y + 4, 1, 4, C.ink);
    }
  }

  drawTV(g) {
    const { x, y, w, h } = TVS;
    g.drawImage(this.tvBg, x, y);
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    disc(g, x + 18, y + 5, 2, C.glow);
    px(g, x + 4, y + 3, C.lilac);
    px(g, x + 11, y + 7, C.lilac);
    const blds = [[7, 6], [6, 9], [8, 5], [9, 8]];
    const off = (this.t * 12) % 30;
    for (let rep = 0; rep < 2; rep++) {
      let bx = x - off + rep * 30;
      for (const [bw, bh] of blds) {
        rect(g, Math.round(bx), y + h - bh, bw - 1, bh, C.plumDark);
        rect(g, Math.round(bx), y + h - bh, bw - 1, 1, C.lavender);
        bx += bw;
      }
    }
    const hop = Math.abs(Math.sin(this.t * 3.2)) * 6;
    const cy = Math.round(y + h - 10 - hop);
    rect(g, x + 7, cy, 4, 2, C.orange);
    px(g, x + 10, cy - 1, C.orange);
    px(g, x + 7, cy - 1, C.orangeDark);
    g.globalAlpha = 0.28;
    for (let yy = y + 1; yy < y + h; yy += 2) rect(g, x, yy, w, 1, C.ink);
    g.globalAlpha = 1;
    g.restore();
    px(g, x, y, C.ink);
    px(g, x + w - 1, y, C.ink);
    px(g, x, y + h - 1, C.ink);
    px(g, x + w - 1, y + h - 1, C.ink);
  }

  drawBoombox(g) {
    const bb = this.game.boombox;
    const playing = !!(bb && bb.playing);
    const pulse = playing ? bb.pulse : 0;
    const by = 119 - (pulse > 0.5 ? 1 : 0);
    rect(g, 214, by - 3, 19, 1, C.grey);
    rect(g, 214, by - 3, 1, 3, C.grey);
    rect(g, 232, by - 3, 1, 3, C.grey);
    rect(g, 212, by, 23, 13, C.greyLight);
    rect(g, 212, by, 23, 1, C.white);
    rect(g, 212, by + 12, 23, 1, C.grey);
    rect(g, 234, by, 1, 13, C.grey);
    const r = pulse > 0.3 ? 2 : 1;
    for (const sx of [216, 230]) {
      disc(g, sx, by + 7, 4, C.ink);
      disc(g, sx, by + 7, 3, C.plum);
      disc(g, sx, by + 7, r, C.grey);
      px(g, sx, by + 7, C.greyLight);
    }
    rect(g, 221, by + 3, 5, 6, C.ink);
    rect(g, 222, by + 4, 3, 2, playing ? C.mint : C.teal);
    px(g, 214, by + 1, C.red);
    px(g, 216, by + 1, C.teal);
    px(g, 231, by + 1, C.lamp);
    if (playing) px(g, 223, by + 10, C.red);
  }

  drawPlant(g) {
    const days = this.game.save.days.length;
    const stage = days >= 8 ? 4 : days >= 5 ? 3 : days >= 3 ? 2 : days >= 2 ? 1 : 0;
    const base = 136;
    const cx = 64;
    const h = [6, 11, 17, 23, 26][stage];
    const perk = this.waterPerk > 0 ? Math.round(Math.sin(this.t * 25)) : 0;
    const sway = Math.round(Math.sin(this.t * 1.3) * 0.6) + perk;
    const xAt = (i) => cx + (i > h * 0.6 ? sway : 0);
    for (let i = 0; i <= h; i++) px(g, xAt(i), base - i, C.greenDark);
    for (let i = 3, k = 0; i < h; i += 4, k++) {
      const y = base - i;
      const dir = k % 2 ? 1 : -1;
      const sx = xAt(i);
      const len = stage >= 2 ? 4 : 3;
      for (let j = 1; j <= len; j++) px(g, sx + dir * j, y - (j > 2 ? 1 : 0), j === len ? C.greenLight : C.green);
      px(g, sx + dir * 2, y + 1, C.green);
    }
    const tx = xAt(h);
    px(g, tx, base - h - 1, C.greenLight);
    px(g, tx - 1, base - h, C.green);
    px(g, tx + 1, base - h, C.green);
    if (stage >= 4) {
      for (const [dx, dy] of [[0, -h - 3], [-5, -h + 6], [4, -h + 10]]) {
        const fx = cx + dx + sway;
        const fy = base + dy;
        px(g, fx, fy, C.gold);
        px(g, fx - 1, fy, C.coral);
        px(g, fx + 1, fy, C.coral);
        px(g, fx, fy - 1, C.coral);
        px(g, fx, fy + 1, C.coral);
      }
    }
  }

  drawTrophies(g) {
    const got = this.game.save.trophies;
    ACHIEVEMENTS.forEach((a, i) => {
      const row = Math.floor(i / 4);
      const col = i % 4;
      const x = 289 + col * 7;
      const y = [86, 104, 122][row] - 7;
      if (got[a.id]) blit(g, TROPHIES[i % 3], x, y);
      else rect(g, x + 1, y + 6, 4, 1, C.plum);
    });
  }

  drawSecret(g) {
    if (this.game.save.golden) return;
    const bob = Math.round(Math.sin(this.t * 2.5) * 1.5);
    blit(g, CARTRIDGE, SECRET.x, SECRET.y + bob);
    if (this.t % 2.2 < 0.3) blit(g, SPARKLE, SECRET.x + 7, SECRET.y - 3 + bob);
  }

  drawPlayer(g) {
    const p = this.player;
    const sp = this.hoodSprites;
    const flip = p.facing < 0;
    if (p.sitting) {
      blit(g, p.blinking ? sp.sitBlink : sp.sit, p.x - 6, p.y - 13, flip);
      return;
    }
    let s = sp.stand;
    let dy = 0;
    if (!p.onGround) {
      s = sp.jump;
    } else if (Math.abs(p.vx) > 8) {
      const f = Math.floor(p.walkT * 8) % 4;
      s = f % 2 ? sp.pass : sp.stride;
      dy = f % 2 ? -1 : 0;
    } else if (p.blinking) {
      s = sp.blink;
    }
    blit(g, s, p.x - 6, p.y - 20 + dy, flip);
  }

  /* ----- lighting: a dithered darkness layer with holes where things glow ----- */

  computeLight() {
    const { phase, ambient } = this.sky;
    const key = `${phase}:${this.lampOn ? 1 : 0}`;
    if (key === this.lightKey) return;
    this.lightKey = key;
    const g = this.lightCanvas.getContext('2d');
    g.clearRect(0, 0, W, H);
    const lights = [];
    if (this.lampOn) lights.push([139, 100, 118, 1.05]);
    lights.push([257, 112, 54, 0.6]);
    lights.push([91, 119, 32, 0.45]);
    lights.push([179, 80, phase === 'night' ? 62 : 96, phase === 'night' ? 0.32 : 0.55]);
    for (let i = 0; i < this.bulbs.length; i += 3) lights.push([this.bulbs[i].x, this.bulbs[i].y + 1, 22, 0.22]);
    const img = g.createImageData(W, H);
    const d = img.data;
    const [r, gg, b] = hexRgb(C.ink);
    const levels = [0, 0.22, 0.42, 0.6, 0.76];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let L = ambient;
        for (const [lx, ly, lr, ls] of lights) {
          const dx = x - lx;
          const dy = (y - ly) * 1.15;
          const dd = dx * dx + dy * dy;
          if (dd < lr * lr) {
            const f = 1 - Math.sqrt(dd) / lr;
            L += ls * f * f;
          }
        }
        if (L >= 1) continue;
        const v = (1 - L) * (levels.length - 1);
        let lv = Math.floor(v);
        if (v - lv > bayer(x, y)) lv++;
        lv = Math.min(levels.length - 1, lv);
        if (!lv) continue;
        const k = (y * W + x) * 4;
        d[k] = r;
        d[k + 1] = gg;
        d[k + 2] = b;
        d[k + 3] = Math.round(levels[lv] * 255);
      }
    }
    const holes = [
      [GLASS.x, GLASS.y, GLASS.w, GLASS.h],
      [TVS.x, TVS.y, TVS.w, TVS.h],
      [MON.x, MON.y, MON.w, MON.h],
    ];
    if (this.lampOn) holes.push([SHADE.x, SHADE.y, SHADE.w, SHADE.h]);
    for (const bl of this.bulbs) holes.push([bl.x, bl.y, 2, 2]);
    for (const [hx, hy, hw, hh] of holes) {
      for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) d[(y * W + x) * 4 + 3] = 0;
    }
    g.putImageData(img, 0, 0);
  }
}
