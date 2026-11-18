import { C } from './palette.js';
import { makeCanvas, ctx2d, rect, px, blit, bayer, gradientCanvas, miniText } from './gfx.js';
import { CAT, CROW, FISH, STAR, DUST } from './art.js';
import { sfx } from './audio.js';
import { moonPhase, drawMoon } from './sky.js';

const H = 180;
const CAT_X = 52;
const GRAV = 1150;
const JUMP = 345;
const CUT = 90; // letting go early turns the jump into a short hop
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = (id) => document.getElementById(id);
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
const pad5 = (n) => String(n).padStart(5, '0');

// A strip of distant buildings that scrolls slower than the rooftops.
function skyline(w, h, col, winCol, lit, minH, maxH, seed) {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  let x = 0;
  while (x < w) {
    const bw = Math.min(Math.round(14 + rnd() * 26), w - x);
    const bh = Math.round(minH + rnd() * (maxH - minH));
    const top = h - bh;
    rect(g, x, top, bw, bh, col);
    if (rnd() < 0.3) rect(g, x + Math.round(bw / 2), top - 5, 1, 5, col);
    if (rnd() < 0.25 && bw > 10) rect(g, x + 3, top - 3, 6, 3, col);
    for (let wy = top + 4; wy < h - 2; wy += 5) {
      for (let wx = x + 3; wx < x + bw - 3; wx += 4) if (rnd() < lit) rect(g, wx, wy, 2, 2, winCol);
    }
    x += bw + (rnd() < 0.3 ? 2 : 0);
  }
  return c;
}

function moonHalo() {
  const r = 18;
  const c = makeCanvas(r * 2 + 1, r * 2 + 1);
  const g = ctx2d(c);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > 11.5 && d < r && bayer(x + r, y + r) < ((r - d) / (r - 11.5)) * 0.55) px(g, x + r, y + r, C.violet);
    }
  }
  return c;
}

// Rooftop Run: the room's cat, running across the city at night.
export class Rooftop {
  constructor(game) {
    this.game = game;
    this.ui = $('game-ui');
    this.msg = $('game-msg');
    this.scoreEl = $('hud-score');
    this.bestEl = $('hud-best');
    this.state = 'attract';
    this.t = 0;
    this.shake = 0;
    this.stars = Array.from({ length: 50 }, () => ({ x: Math.floor(Math.random() * 330), y: Math.floor(Math.random() * 95), sp: rand(1, 3), ph: rand(0, 6) }));
    this.far = skyline(520, 80, C.plum, C.violet, 0.12, 30, 70, 7);
    this.mid = skyline(520, 70, C.plumDark, C.lamp, 0.16, 22, 58, 99);
    this.halo = moonHalo();
    this.skyCanvas = null;
    this.skyW = 0;
    this.pointerHeld = false;
    this.tapped = false;
    this.slotEls = [];
    this.onKey = (e) => this.nameKey(e);
    $('game-exit').addEventListener('click', () => this.game.exitRooftop());
    this.newWorld(true);
  }

  enter() {
    this.ui.hidden = false;
    this.moon = moonPhase(this.game.now());
    this.toAttract();
  }

  exit() {
    this.ui.hidden = true;
    this.endNameEntry();
    this.pointerHeld = false;
  }

  toAttract() {
    this.state = 'attract';
    this.newWorld(true);
    this.scoreEl.textContent = 'DEMO';
    this.updateBest();
    this.renderMsg('attract');
  }

  startRun() {
    this.state = 'play';
    this.newWorld(false);
    this.msg.textContent = '';
    this.scoreEl.textContent = `SCORE ${pad5(0)}`;
    this.updateBest();
    sfx.start();
    this.game.save.runs++;
    this.game.write();
  }

  updateBest() {
    const s = this.game.save;
    const top = Math.max(s.best, ...s.scores.map((r) => r.s));
    this.bestEl.textContent = `HI ${pad5(top)}`;
  }

  newWorld(demo) {
    this.demo = demo;
    this.dist = 0;
    this.time = 0;
    this.speed = 108;
    this.score = 0;
    this.bonus = 0;
    this.cat = { y: 132, vy: 0, onGround: true, coyote: 0, buffer: 0, cut: false, anim: 0 };
    this.blds = [];
    this.obs = [];
    this.crows = [];
    this.picks = [];
    this.parts = [];
    this.floaters = [];
    this.demoHold = 0;
    this.spawnAhead();
  }

  spawnAhead() {
    const reach = this.dist + this.game.view.w + 140;
    let last = this.blds[this.blds.length - 1];
    while (!last || last.x + last.w < reach) {
      this.addBuilding(last);
      last = this.blds[this.blds.length - 1];
    }
  }

  addBuilding(prev) {
    let x;
    let w;
    let top;
    if (!prev) {
      x = -30;
      w = 280;
      top = 132;
    } else {
      // roofs get wider as the cat speeds up, so the rhythm of jumps stays about the same
      const v = Math.max(this.speed, 108);
      const gapMax = Math.min(64, v * 0.3 + 8);
      x = prev.x + prev.w + Math.round(rand(16, gapMax));
      w = Math.round(rand(60, 150) * (0.6 + (0.4 * v) / 108));
      top = Math.round(clamp(prev.top + rand(-24, 22), 100, 150));
    }
    const wins = [];
    for (let wy = 10; wy < H - top - 4; wy += 11) {
      for (let wx = 6; wx < w - 8; wx += 10) wins.push({ x: wx, y: wy, lit: Math.random() < 0.35 });
    }
    this.blds.push({ x, w, top, wins });
    if (!prev) return;

    // Obstacles sit past where a full jump over the gap lands, and well before the far edge,
    // so there is always room to land, then hop.
    let blocked = false;
    const landing = Math.max(34, 0.62 * Math.max(this.speed, 108) - 10);
    if (w - 44 - landing >= 10 && Math.random() < 0.65) {
      const kind = ['chimney', 'chimney', 'antenna', 'vent'][Math.floor(Math.random() * 4)];
      const [ow, oh] = { chimney: [8, 13], antenna: [5, 16], vent: [10, 6] }[kind];
      this.obs.push({ kind, x: x + Math.round(rand(landing, w - 44)), y: top, w: ow, h: oh });
      blocked = true;
    }
    // Crows hover over clear roofs, past the landing zone. A low one means hop; a high one means don't.
    if (!blocked && this.time > 10 && w - 30 - (landing + 10) >= 10 && Math.random() < 0.5) {
      const high = Math.random() < 0.4;
      this.crows.push({ x: x + Math.round(rand(landing + 10, w - 30)), y: top - (high ? 32 : 10), t: Math.random(), vx: 0 });
      blocked = true;
    }
    const gx0 = prev.x + prev.w;
    if (Math.random() < 0.55) {
      for (let i = 1; i <= 3; i++) {
        const k = i / 4;
        this.picks.push({ kind: 'fish', x: gx0 - 6 + (x - gx0 + 12) * k, y: Math.min(prev.top, top) - 16 - Math.sin(k * Math.PI) * 14 });
      }
    } else if (!blocked && Math.random() < 0.6) {
      for (let i = 0; i < 3; i++) this.picks.push({ kind: 'fish', x: x + 22 + i * 12, y: top - 12 });
    }
    if (Math.random() < 0.07) this.picks.push({ kind: 'star', x: x + w / 2, y: top - 46 });
  }

  buildingAt(wx) {
    return this.blds.find((b) => wx >= b.x && wx < b.x + b.w);
  }

  roofUnder(l, r) {
    let top = Infinity;
    for (const b of this.blds) if (b.x <= r && b.x + b.w >= l) top = Math.min(top, b.top);
    return top;
  }

  // The attract-mode cat: a full jump at the last moment before a gap, a short hop over things.
  demoJump() {
    const c = this.cat;
    if (!c.onGround) return null;
    const fx = this.dist + CAT_X + 13;
    const edge = 3 + this.speed * 0.035;
    if (this.buildingAt(fx + edge) !== this.buildingAt(this.dist + CAT_X + 3)) return 'gap';
    for (const o of this.obs) {
      const d = o.x - fx;
      if (d > 0 && d < 6 + this.speed * 0.06) return 'hop';
    }
    for (const cr of this.crows) {
      const d = cr.x - fx;
      if (d > 0 && d < 10 + this.speed * 0.1 && cr.y > c.y - 20) return 'hop';
    }
    return null;
  }

  update(dt) {
    this.t += dt;
    if (this.shake > 0) this.shake -= dt;
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= 14 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);

    const input = this.game.input;
    if (input.pressed('menu') && this.state !== 'name') {
      this.game.exitRooftop();
      return;
    }
    const go = input.pressed('jump') || input.pressed('use') || input.pressed('up') || this.tapped;
    switch (this.state) {
      case 'attract':
        this.step(dt);
        if (go) this.startRun();
        break;
      case 'play':
        this.step(dt);
        break;
      case 'dying':
        this.dieT += dt;
        this.cat.vy += GRAV * dt;
        this.cat.y += this.cat.vy * dt;
        if (this.dieT > 1.0) this.gameOver();
        break;
      case 'over':
        this.overT += dt;
        if (go && this.overT > 0.5) this.startRun();
        break;
      default:
    }
    this.tapped = false;
  }

  step(dt) {
    const demo = this.demo;
    const input = this.game.input;
    const c = this.cat;
    this.time += dt;
    this.speed = Math.min(250, 108 + this.time * 3.2);
    this.dist += this.speed * dt;
    this.spawnAhead();

    let pressed;
    let held;
    if (demo) {
      const kind = this.demoJump();
      pressed = !!kind;
      if (kind) this.demoHold = kind === 'gap' ? 0.3 : clamp(0.16 - this.speed * 0.0004, 0.05, 0.12);
      this.demoHold -= dt;
      held = this.demoHold > 0;
    } else {
      pressed = input.pressed('jump') || input.pressed('up') || input.pressed('use') || this.tapped;
      held = input.held('jump') || input.held('up') || input.held('use') || this.pointerHeld;
    }
    c.buffer = pressed ? 0.12 : c.buffer - dt;
    c.coyote -= dt;
    if (c.buffer > 0 && (c.onGround || c.coyote > 0)) {
      c.vy = -JUMP;
      c.onGround = false;
      c.coyote = 0;
      c.buffer = 0;
      c.cut = false;
      if (!demo) sfx.jump();
    }
    const prevY = c.y;
    if (!c.onGround) {
      if (!held && !c.cut && c.vy < -CUT) {
        c.vy = -CUT;
        c.cut = true;
      }
      c.vy = Math.min(c.vy + GRAV * dt, 620);
      c.y += c.vy * dt;
    }

    // Running into the side of a taller building. Falling onto a roof from above is a landing, not a crash.
    const front = this.buildingAt(this.dist + CAT_X + 13);
    if (front && front.top < c.y - 3 && prevY > front.top + 1) return this.crash();
    const top = this.roofUnder(this.dist + CAT_X + 3, this.dist + CAT_X + 13);
    if (c.onGround) {
      if (top === Infinity || top > c.y + 1) {
        c.onGround = false;
        c.coyote = 0.09;
        c.vy = 0;
      } else {
        c.y = top;
      }
    } else if (c.vy >= 0 && top !== Infinity && prevY <= top + 0.5 && c.y >= top) {
      c.y = top;
      c.vy = 0;
      c.onGround = true;
      this.parts.push({ x: CAT_X + 2, y: top - 2, vx: -30, life: 0.25 }, { x: CAT_X + 13, y: top - 2, vx: 20, life: 0.25 });
      if (!demo) sfx.land();
    }
    if (c.y > H + 30) return this.crash(true);

    const box = { x0: CAT_X + 3, x1: CAT_X + 13, y0: c.y - 7, y1: c.y };
    for (const o of this.obs) {
      const sx = o.x - this.dist;
      if (sx > CAT_X + 20 || sx + o.w < CAT_X) continue;
      if (overlap(box, { x0: sx + 1, x1: sx + o.w - 1, y0: o.y - o.h + 1, y1: o.y })) return this.crash();
    }
    for (const cr of this.crows) {
      cr.x += cr.vx * dt;
      cr.t += dt;
      const sx = cr.x - this.dist;
      if (overlap(box, { x0: sx + 1, x1: sx + 10, y0: cr.y + 2, y1: cr.y + 6 })) return this.crash();
    }
    for (const p of this.picks) {
      const sx = p.x - this.dist;
      if (!p.taken && overlap(box, { x0: sx - 4, x1: sx + 4, y0: p.y - 3, y1: p.y + 3 })) {
        p.taken = true;
        const pts = p.kind === 'star' ? 50 : 10;
        if (!demo) {
          this.bonus += pts;
          sfx.coin();
        }
        this.floaters.push({ txt: `+${pts}`, x: sx - 4, y: p.y - 8, life: 0.8 });
      }
    }

    const minX = this.dist - 60;
    this.blds = this.blds.filter((b) => b.x + b.w > minX);
    this.obs = this.obs.filter((o) => o.x + o.w > minX);
    this.crows = this.crows.filter((cr) => cr.x > minX);
    this.picks = this.picks.filter((p) => p.x > minX && !p.taken);
    c.anim += dt * (this.speed / 16);

    if (!demo) {
      const sc = Math.floor(this.dist / 10) + this.bonus;
      if (sc !== this.score) {
        this.score = sc;
        this.scoreEl.textContent = `SCORE ${pad5(sc)}`;
        if (sc >= 300) this.game.unlock('runner');
      }
    }
    return undefined;
  }

  crash(fell) {
    if (this.demo) {
      this.newWorld(true);
      return;
    }
    this.state = 'dying';
    this.dieT = 0;
    sfx.bonk();
    if (!fell) this.cat.vy = -220;
    this.shake = this.game.reduced ? 0 : 0.3;
  }

  gameOver() {
    const s = this.game.save;
    if (this.score > s.best) s.best = this.score;
    this.game.write();
    sfx.gameOver();
    const table = s.scores;
    const qualifies = this.score > 0 && (table.length < 5 || this.score > table[table.length - 1].s);
    if (qualifies) this.beginNameEntry();
    else this.showOver(-1);
  }

  showOver(highlight) {
    this.state = 'over';
    this.overT = 0;
    this.updateBest();
    this.renderMsg('over', highlight);
  }

  beginNameEntry() {
    this.state = 'name';
    this.initials = (this.game.save.initials || 'AAA').slice(0, 3).split('');
    this.slot = 0;
    this.renderMsg('name');
    window.addEventListener('keydown', this.onKey);
  }

  endNameEntry() {
    window.removeEventListener('keydown', this.onKey);
  }

  nameKey(e) {
    if (this.state !== 'name') return;
    const k = e.key;
    if (/^[a-z0-9]$/i.test(k)) {
      this.initials[this.slot] = k.toUpperCase();
      this.slot = Math.min(2, this.slot + 1);
    } else if (k === 'ArrowUp' || k === 'ArrowDown') {
      this.cycle(this.slot, k === 'ArrowUp' ? 1 : -1);
    } else if (k === 'ArrowLeft' || k === 'Backspace') {
      this.slot = Math.max(0, this.slot - 1);
    } else if (k === 'ArrowRight') {
      this.slot = Math.min(2, this.slot + 1);
    } else if (k === 'Enter') {
      e.preventDefault();
      this.confirmName();
      return;
    } else {
      return;
    }
    e.preventDefault();
    sfx.blip();
    this.renderInitials();
  }

  cycle(i, d) {
    const idx = LETTERS.indexOf(this.initials[i]);
    this.initials[i] = LETTERS[(Math.max(0, idx) + d + LETTERS.length) % LETTERS.length];
  }

  confirmName() {
    if (this.state !== 'name') return;
    const name = this.initials.join('');
    const s = this.game.save;
    s.initials = name;
    const entry = { n: name, s: this.score };
    s.scores.push(entry);
    s.scores.sort((a, b) => b.s - a.s);
    s.scores = s.scores.slice(0, 5);
    this.game.write();
    this.endNameEntry();
    sfx.coin();
    this.showOver(s.scores.indexOf(entry));
  }

  renderMsg(kind, hi = -1) {
    const m = this.msg;
    m.textContent = '';
    const touch = this.game.touch;
    const el = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      m.append(e);
      return e;
    };
    if (kind === 'attract') {
      el('p', 'game-title', 'ROOFTOP RUN');
      el('p', 'game-help', touch ? 'Tap to jump. Hold for a higher jump.' : 'Space or ↑ to jump. Hold it for a higher jump.');
      this.scoreTable(el('ol', 'scores'), -1);
      el('p', 'blink', touch ? 'Tap to start' : 'Press Space to start');
    } else if (kind === 'over') {
      el('p', 'game-title', 'GAME OVER');
      el('p', null, `Score ${pad5(this.score)}`);
      this.scoreTable(el('ol', 'scores'), hi);
      el('p', 'blink', touch ? 'Tap to run again' : 'Space to run again. Esc to go back to the room.');
    } else if (kind === 'name') {
      el('p', 'game-title', 'NEW HIGH SCORE');
      el('p', null, `${pad5(this.score)}! Enter your initials.`);
      const row = el('div', 'initials');
      this.slotEls = [0, 1, 2].map((i) => {
        const col = document.createElement('div');
        col.className = 'slot';
        const mk = (label, aria, d) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = label;
          b.setAttribute('aria-label', aria);
          b.addEventListener('click', () => {
            this.slot = i;
            this.cycle(i, d);
            sfx.blip();
            this.renderInitials();
          });
          return b;
        };
        const ch = document.createElement('span');
        ch.className = 'letter';
        col.append(mk('▲', `Letter ${i + 1}, next`, 1), ch, mk('▼', `Letter ${i + 1}, previous`, -1));
        row.append(col);
        return ch;
      });
      const ok = el('button', 'ok', 'OK');
      ok.type = 'button';
      ok.addEventListener('click', () => this.confirmName());
      el('p', 'game-help', touch ? 'Use the arrows, then OK.' : 'Type your initials, then press Enter.');
      this.renderInitials();
    }
  }

  renderInitials() {
    this.slotEls.forEach((s, i) => {
      s.textContent = this.initials[i];
      s.classList.toggle('on', i === this.slot);
    });
  }

  scoreTable(ol, hi) {
    this.game.save.scores.forEach((r, i) => {
      const li = document.createElement('li');
      if (i === hi) li.className = 'mine';
      for (const t of [String(i + 1), r.n, pad5(r.s)]) {
        const sp = document.createElement('span');
        sp.textContent = t;
        li.append(sp);
      }
      ol.append(li);
    });
  }

  onPointer() {
    this.tapped = true;
    this.pointerHeld = true;
  }

  onPointerUp() {
    this.pointerHeld = false;
  }

  /* ----- drawing ----- */

  draw(g) {
    const w = this.game.view.w;
    if (!this.skyCanvas || this.skyW !== w) {
      this.skyCanvas = gradientCanvas(w, H, [C.ink, C.plumDark, C.plum, C.violet]);
      this.skyW = w;
    }
    g.save();
    if (this.shake > 0) g.translate(Math.round(rand(-2, 2)), Math.round(rand(-2, 2)));
    g.drawImage(this.skyCanvas, 0, 0);
    for (const s of this.stars) {
      if (s.x < w && Math.sin(this.t * s.sp + s.ph) > -0.5) px(g, s.x, s.y, s.y < 45 ? C.lilac : C.lavender);
    }
    const mx = w - 56;
    const my = 36;
    g.drawImage(this.halo, mx - 18, my - 18);
    drawMoon(g, mx, my, 11, this.moon, C.glow, C.plum);
    const fo = Math.round(this.dist * 0.12) % 520;
    g.drawImage(this.far, -fo, 62);
    g.drawImage(this.far, 520 - fo, 62);
    const mo = Math.round(this.dist * 0.32) % 520;
    g.drawImage(this.mid, -mo, 110);
    g.drawImage(this.mid, 520 - mo, 110);
    for (const b of this.blds) this.drawBuilding(g, b, w);
    for (const o of this.obs) this.drawObstacle(g, o);
    for (const p of this.picks) {
      const sx = Math.round(p.x - this.dist);
      if (sx < -10 || sx > w + 10) continue;
      const bob = Math.round(Math.sin(this.t * 4 + p.x * 0.1) * 1.5);
      if (p.kind === 'star') blit(g, STAR, sx - 3, p.y - 3 + bob);
      else blit(g, FISH, sx - 4, p.y - 2 + bob);
    }
    for (const cr of this.crows) blit(g, CROW[Math.floor(cr.t * 8) % 2], cr.x - this.dist, cr.y + (Math.floor(cr.t * 4) % 2));
    this.drawCat(g);
    for (const p of this.parts) blit(g, DUST, p.x - 1, p.y - 1);
    for (const f of this.floaters) miniText(g, f.txt, f.x, f.y, C.glow);
    g.restore();
  }

  drawBuilding(g, b, w) {
    const sx = Math.round(b.x - this.dist);
    if (sx > w || sx + b.w < 0) return;
    const top = b.top;
    rect(g, sx, top, b.w, H - top, C.plumDark);
    rect(g, sx, top, b.w, 2, C.lavender);
    rect(g, sx, top + 2, b.w, 1, C.violet);
    rect(g, sx, top + 3, 1, H - top - 3, C.plum);
    rect(g, sx + b.w - 2, top + 3, 2, H - top - 3, C.ink);
    for (const win of b.wins) rect(g, sx + win.x, top + win.y, 3, 4, win.lit ? C.lamp : C.ink);
  }

  drawObstacle(g, o) {
    const sx = Math.round(o.x - this.dist);
    const y = o.y;
    if (o.kind === 'chimney') {
      rect(g, sx, y - 13, 8, 13, C.brick);
      rect(g, sx, y - 9, 8, 1, C.burgundy);
      rect(g, sx, y - 5, 8, 1, C.burgundy);
      px(g, sx + 3, y - 12, C.burgundy);
      px(g, sx + 5, y - 7, C.burgundy);
      rect(g, sx - 1, y - 15, 10, 2, C.greyLight);
      rect(g, sx - 1, y - 15, 10, 1, C.white);
    } else if (o.kind === 'antenna') {
      rect(g, sx + 2, y - 16, 1, 16, C.greyLight);
      rect(g, sx, y - 13, 5, 1, C.greyLight);
      rect(g, sx + 1, y - 9, 3, 1, C.greyLight);
      px(g, sx + 2, y - 17, Math.floor(this.t * 2) % 2 ? C.red : C.burgundy);
    } else {
      rect(g, sx, y - 6, 10, 6, C.greyLight);
      rect(g, sx, y - 6, 10, 1, C.white);
      rect(g, sx + 2, y - 4, 6, 1, C.grey);
      rect(g, sx + 2, y - 2, 6, 1, C.grey);
    }
  }

  drawCat(g) {
    const c = this.cat;
    const y = Math.round(c.y);
    if (this.state === 'dying') {
      g.save();
      g.translate(CAT_X + 8, y - 4);
      g.scale(1, -1);
      g.drawImage(CAT.jump, -8, -4);
      g.restore();
      return;
    }
    const spr = c.onGround ? (Math.floor(c.anim) % 2 ? CAT.walkA : CAT.walkB) : CAT.jump;
    blit(g, spr, CAT_X, y - 8);
  }
}
