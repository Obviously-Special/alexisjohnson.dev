// The visitor's save file. It lives in localStorage and nowhere else.
const KEY = 'aj-room:v1';
const DEFAULT_SCORES = [['ALX', 1500], ['CAT', 1000], ['NYA', 700], ['MOO', 400], ['ZZZ', 200]];

function fresh() {
  return {
    v: 1,
    created: Date.now(),
    lastSeen: 0,
    visits: 0,
    days: [],
    playSec: 0,
    hood: null,
    pets: 0,
    waters: 0,
    runs: 0,
    best: 0,
    sprites: [null, null, null],
    draft: null,
    loop: null,
    trophies: {},
    scores: DEFAULT_SCORES.map(([n, s]) => ({ n, s })),
    initials: 'AAA',
    muted: false,
    scanlines: true,
    golden: false,
    flags: {},
  };
}

let data = fresh();
let persistent = true;
let locked = false;

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') data = { ...fresh(), ...parsed, flags: { ...(parsed.flags || {}) } };
    }
  } catch {
    persistent = false;
  }
  if (!Array.isArray(data.sprites) || data.sprites.length !== 3) data.sprites = [null, null, null];
  if (!Array.isArray(data.scores) || !data.scores.length) data.scores = fresh().scores;
  if (!Array.isArray(data.days)) data.days = [];
  if (!data.trophies || typeof data.trophies !== 'object') data.trophies = {};
  return data;
}

export function writeSave() {
  if (locked) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    persistent = true;
  } catch {
    persistent = false;
  }
}

// Erases the save and stops any further writes until the page reloads.
export function eraseSave() {
  locked = true;
  try { localStorage.removeItem(KEY); } catch { /* nothing to erase */ }
}

export const isPersistent = () => persistent;

export function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Counts a new visit after 30 minutes away, and remembers each day the visitor came by.
export function beginVisit(now) {
  const t = now.getTime();
  if (t - data.lastSeen > 30 * 60 * 1000) data.visits++;
  const k = dayKey(now);
  if (!data.days.includes(k)) {
    data.days.push(k);
    if (data.days.length > 400) data.days.shift();
  }
  data.lastSeen = t;
  writeSave();
}
