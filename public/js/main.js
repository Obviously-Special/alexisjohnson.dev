import { C } from './palette.js';
import { makeCanvas, rect } from './gfx.js';
import { Input } from './input.js';
import { loadSave, writeSave, eraseSave, beginVisit, isPersistent } from './save.js';
import { initAudio, setMuted, suspendAudio, sfx } from './audio.js';
import { Dialog, Hud, Panels } from './ui.js';
import { Room } from './room.js';
import { Title } from './title.js';
import { Rooftop } from './rooftop.js';
import { Studio } from './studio.js';
import { Boombox } from './boombox.js';
import { unlock, renderTrophies } from './trophies.js';

const $ = (id) => document.getElementById(id);
const canvas = $('screen');
const g = canvas.getContext('2d');
const frameEl = $('frame');

// ?hour=22 previews the room at another time of day.
const hourParam = new URLSearchParams(location.search).get('hour');
const hourOverride = hourParam !== null && hourParam !== '' && !Number.isNaN(Number(hourParam)) ? Number(hourParam) : null;

const game = {
  canvas,
  view: { w: 320, h: 180, s: 3 },
  input: new Input(),
  save: loadSave(),
  touch: matchMedia('(pointer: coarse)').matches,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  scene: null,
  transition: null,
  pending: null,
  now() {
    const d = new Date();
    if (hourOverride !== null) d.setHours(Math.floor(hourOverride) % 24, Math.round((hourOverride % 1) * 60), 0, 0);
    return d;
  },
  write: writeSave,
  busy() {
    return game.dialog.active || game.panels.isOpen;
  },
  unlock(id) {
    return unlock(game, id);
  },
  focusScreen() {
    canvas.focus({ preventScroll: true });
  },
};

beginVisit(game.now());
game.hud = new Hud(game);
game.dialog = new Dialog();
game.panels = new Panels(game);
game.room = new Room(game);
game.title = new Title(game);
game.rooftop = new Rooftop(game);
game.studio = new Studio(game);
game.boombox = new Boombox(game);
game.write();

/* ----- scenes ----- */

game.setScene = (scene, opts) => {
  game.scene?.exit?.();
  game.scene = scene;
  scene.enter?.(opts);
};

game.begin = (then) => {
  initAudio();
  sfx.start();
  game.setScene(game.room, { entering: true });
  game.focusScreen();
  const s = game.save;
  const after = () => {
    unlock(game, 'hello');
    if (game.now().getHours() < 5) setTimeout(() => unlock(game, 'owl'), 900);
    if (s.days.length >= 3) setTimeout(() => unlock(game, 'regular'), 1800);
    if (game.pending) {
      const p = game.pending;
      game.pending = null;
      history.replaceState(null, '', location.pathname + location.search);
      if (p.kind === 'sprite') game.studio.open({ shared: p.code });
      else game.boombox.open({ shared: p.code });
    }
    then?.();
  };
  if (!s.flags.welcomed) {
    s.flags.welcomed = true;
    game.write();
    const how = game.touch
      ? 'Tap anything to walk over and use it. The buttons under the screen work too.'
      : "Walk with ← and →, jump with Space, and press ↑ to use whatever you're standing next to.";
    setTimeout(() => game.dialog.open(['Welcome in! Make yourself at home.', how, 'The note on the corkboard is a good place to start.'], after), 700);
  } else {
    setTimeout(after, 400);
  }
};

game.startRooftop = () => {
  if (game.scene === game.rooftop) return;
  sfx.crt();
  game.setScene(game.rooftop);
  if (!game.reduced) game.transition = { type: 'on', t: 0, dur: 0.45 };
};

game.exitRooftop = (then) => {
  if (game.scene !== game.rooftop || game.transition?.type === 'off') return;
  sfx.crt();
  const done = () => {
    game.setScene(game.room, { fromTV: true });
    if (!game.reduced) game.transition = { type: 'fade', t: 0, dur: 0.3 };
    then?.();
  };
  if (game.reduced) {
    done();
    return;
  }
  const snap = makeCanvas(game.view.w, 180);
  snap.getContext('2d').drawImage(canvas, 0, 0);
  game.transition = { type: 'off', t: 0, dur: 0.42, snap, then: done };
};

game.openStudio = (opts) => game.studio.open(opts);
game.openBoombox = (opts) => game.boombox.open(opts);
game.openTrophies = () => {
  renderTrophies(game);
  game.panels.open('panel-trophies');
};
game.openMenu = () => {
  syncMenu();
  game.panels.open('panel-menu');
};

/* ----- sizing: whole device pixels per game pixel whenever there's room ----- */

function layout() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const narrow = vw < 600;
  const w = narrow ? 240 : 320;
  const reserved = (narrow ? 104 : 176) + (game.touch ? 92 : 0);
  const availW = narrow ? vw - 20 : Math.min(vw - 64, 1600);
  const availH = Math.max(150, vh - reserved);
  let s = Math.min(availW / w, availH / 180);
  s = narrow ? Math.max(1, s) : Math.max(1, Math.floor(s * dpr) / dpr);
  game.view.w = w;
  game.view.s = s;
  if (canvas.width !== w) canvas.width = w;
  canvas.height = 180;
  g.imageSmoothingEnabled = false;
  const root = document.documentElement.style;
  root.setProperty('--fw', `${w * s}px`);
  root.setProperty('--fh', `${180 * s}px`);
  root.setProperty('--px', String(s));
  root.setProperty('--ui', s >= 3.6 ? '32px' : '16px');
}

/* ----- the loop ----- */

function drawTransition(dt) {
  const tr = game.transition;
  const { w } = game.view;
  const h = 180;
  tr.t += dt;
  const p = Math.min(1, tr.t / tr.dur);
  if (tr.type === 'off') {
    // the picture squeezes into a line, then a dot, like an old TV switching off
    rect(g, 0, 0, w, h, '#000');
    if (p < 0.65) {
      const q = p / 0.65;
      const bh = Math.max(2, Math.round(h * (1 - q) * (1 - q)));
      const y = Math.round((h - bh) / 2);
      g.drawImage(tr.snap, 0, y, w, bh);
      g.globalAlpha = Math.min(1, q * 1.3);
      rect(g, 0, y, w, bh, C.white);
      g.globalAlpha = 1;
    } else {
      const q = (p - 0.65) / 0.35;
      const bw = Math.max(1, Math.round(w * (1 - q)));
      rect(g, Math.round((w - bw) / 2), 89, bw, 2, C.white);
    }
  } else if (tr.type === 'on') {
    if (p < 0.3) {
      const q = p / 0.3;
      rect(g, 0, 0, w, h, '#000');
      const bw = Math.max(2, Math.round(w * q));
      rect(g, Math.round((w - bw) / 2), 89, bw, 2, C.white);
    } else {
      const q = (p - 0.3) / 0.7;
      const bh = Math.round(h * q);
      const y = Math.round((h - bh) / 2);
      rect(g, 0, 0, w, y, '#000');
      rect(g, 0, y + bh, w, h - y - bh, '#000');
      g.globalAlpha = (1 - q) * 0.85;
      rect(g, 0, y, w, bh, C.white);
      g.globalAlpha = 1;
    }
  } else {
    g.globalAlpha = 1 - p;
    rect(g, 0, 0, w, h, '#000');
    g.globalAlpha = 1;
  }
  if (p >= 1) {
    game.transition = null;
    tr.then?.();
  }
}

function tick(dt) {
  const tr = game.transition;
  const frozen = (tr && tr.type === 'off') || (game.panels.isOpen && game.scene !== game.room);
  if (!frozen) {
    game.scene.update(dt);
    game.dialog.update(dt, game.input, game.reduced);
    if (game.scene === game.room && game.input.pressed('menu') && !game.busy()) game.openMenu();
  }
  game.boombox.tick(dt);
  game.scene.draw(g);
  if (game.transition) drawTransition(dt);
  game.input.endFrame();
}

let last = performance.now();
function frame(now) {
  tick(Math.min(0.05, Math.max(0, (now - last) / 1000)));
  last = now;
  requestAnimationFrame(frame);
}

// ?debug exposes the game so it can be stepped frame by frame from the console.
if (new URLSearchParams(location.search).has('debug')) {
  window.__game = game;
  window.__step = (n = 1, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) tick(dt);
  };
}

/* ----- controls outside the canvas ----- */

canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const r = canvas.getBoundingClientRect();
  const gx = ((e.clientX - r.left) / r.width) * game.view.w;
  const gy = ((e.clientY - r.top) / r.height) * 180;
  game.scene.onPointer?.(gx, gy, e);
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
  canvas.addEventListener(type, () => game.scene.onPointerUp?.());
}

for (const b of document.querySelectorAll('#pad [data-act]')) {
  const act = b.dataset.act;
  const release = () => {
    game.input.setVirtual(act, false);
    b.classList.remove('down');
  };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    initAudio();
    b.setPointerCapture(e.pointerId);
    game.input.setVirtual(act, true);
    b.classList.add('down');
    if (game.dialog.active && (act === 'use' || act === 'jump')) game.dialog.clicked = true;
  });
  b.addEventListener('pointerup', release);
  b.addEventListener('pointercancel', release);
  b.addEventListener('lostpointercapture', release);
}

function goTo(id) {
  initAudio();
  if (game.panels.isOpen) game.panels.close(true);
  if (game.scene === game.title) {
    game.title.start(() => game.room.go(id));
    return;
  }
  if (game.scene === game.rooftop) {
    if (id !== 'tv') game.exitRooftop(() => game.room.go(id));
    return;
  }
  if (game.dialog.active) game.dialog.close();
  game.room.go(id);
  game.focusScreen();
}
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.go)));

function syncSound() {
  $('btn-sound').textContent = game.save.muted ? 'Sound off' : 'Sound on';
  setMuted(game.save.muted);
}
function toggleSound() {
  game.save.muted = !game.save.muted;
  game.write();
  initAudio();
  syncSound();
  sfx.select();
}
$('btn-sound').addEventListener('click', toggleSound);
$('btn-menu').addEventListener('click', () => {
  initAudio();
  game.openMenu();
});

function applyScanlines() {
  frameEl.classList.toggle('no-scanlines', !game.save.scanlines);
}

let resetArmed = false;
function syncMenu() {
  const s = game.save;
  $('menu-sound').textContent = s.muted ? 'Sound: off' : 'Sound: on';
  $('menu-scan').textContent = s.scanlines ? 'Scanlines: on' : 'Scanlines: off';
  $('menu-save').textContent = isPersistent()
    ? `This is visit ${s.visits}. Your save file lives in this browser only, so clearing this site's data erases it.`
    : "This browser isn't letting the site save anything, so the room will forget you when you leave.";
  resetArmed = false;
  $('menu-reset').textContent = 'Erase my save file';
}
$('menu-resume').addEventListener('click', () => game.panels.close());
$('menu-sound').addEventListener('click', () => {
  toggleSound();
  syncMenu();
});
$('menu-scan').addEventListener('click', () => {
  game.save.scanlines = !game.save.scanlines;
  game.write();
  applyScanlines();
  syncMenu();
});
$('menu-title').addEventListener('click', () => {
  game.panels.close(true);
  game.transition = null;
  game.dialog.active && game.dialog.close();
  game.setScene(game.title);
});
$('menu-reset').addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true;
    $('menu-reset').textContent = 'Press again to erase everything';
    return;
  }
  game.boombox.stop();
  eraseSave();
  location.replace(location.pathname);
});

// Time spent in the room, counted only while the tab is visible.
setInterval(() => {
  if (document.hidden || game.scene === game.title) return;
  game.save.playSec++;
  if (game.save.playSec % 15 === 0) game.write();
}, 1000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.write();
    suspendAudio(true);
    game.input.clear();
  } else {
    suspendAudio(false);
  }
});
window.addEventListener('pagehide', () => game.write());

const shared = location.hash.match(/^#(sprite|loop)=([A-Za-z0-9_.-]+)$/);
if (shared) game.pending = { kind: shared[1], code: shared[2] };

/* ----- start ----- */

$('pad').hidden = !game.touch;
$('keys').hidden = game.touch;
layout();
window.addEventListener('resize', layout);
applyScanlines();
syncSound();
game.input.attach();
game.setScene(game.title);
requestAnimationFrame(frame);
