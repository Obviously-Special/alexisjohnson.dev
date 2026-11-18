import { initAudio, getAudio, playVoice, sfx } from './audio.js';
import { b64url, unb64url } from './spritecode.js';

const $ = (id) => document.getElementById(id);
const STEPS = 16;

// Melody and bass use a pentatonic scale, so any combination sounds fine.
const ROWS = [
  { lane: 'lead', f: 659.25, label: 'E' },
  { lane: 'lead', f: 587.33, label: 'D' },
  { lane: 'lead', f: 523.25, label: 'C' },
  { lane: 'lead', f: 440.0, label: 'A' },
  { lane: 'lead', f: 392.0, label: 'G' },
  { lane: 'lead', f: 329.63, label: 'E' },
  { lane: 'lead', f: 293.66, label: 'D' },
  { lane: 'lead', f: 261.63, label: 'C' },
  { lane: 'bass', f: 110.0, label: 'A' },
  { lane: 'bass', f: 98.0, label: 'G' },
  { lane: 'bass', f: 82.41, label: 'E' },
  { lane: 'bass', f: 65.41, label: 'C' },
  { lane: 'drum', kind: 'hat', label: 'Hat' },
  { lane: 'drum', kind: 'snare', label: 'Snare' },
  { lane: 'drum', kind: 'kick', label: 'Kick' },
];
const LANE_NAMES = { lead: 'Melody', bass: 'Bass', drum: 'Drums' };

const PRESETS = {
  cozy: {
    name: 'Cozy',
    bpm: 92,
    rows: [
      '................', '................', 'x...............', '...x........x...',
      '......x...x.....', '........x.......', '................', '..............x.',
      '........x.......', '............x...', '................', 'x.....x.........',
      '..x...x...x...x.', '....x.......x...', 'x.......x..x....',
    ],
  },
  rooftops: {
    name: 'Rooftops',
    bpm: 124,
    rows: [
      '..........x.....', '.......x....x...', '....x.........x.', '..x.....x.......',
      'x...............', '.....x.....x....', '...............x', '................',
      '........x.x.....', '............x.x.', '....x.x.........', 'x.x.............',
      'x.x.x.x.x.x.x.x.', '....x.......x...', 'x.....x.x.....x.',
    ],
  },
  boss: {
    name: 'Boss fight',
    bpm: 152,
    rows: [
      'x.....x.....x...', '.x.....x........', '..x.....x....x..', '...x.....x....x.',
      '....x.....x.....', '.....x.....x...x', '................', '................',
      '................', '..............x.', 'x.xx.x.xx.xx.x..', '................',
      'xxxxxxxxxxxxxxxx', '....x.......x..x', 'x..x..x.x..x..x.',
    ],
  },
};

// Boombox: a 16-step chiptune sequencer. Its loop keeps playing in the room.
export class Boombox {
  constructor(game) {
    this.game = game;
    this.pattern = new Uint16Array(ROWS.length);
    this.bpm = 112;
    this.playing = false;
    this.step = -1;
    this.beats = 0;
    this.pulse = 0;
    this.queue = [];
    this.timer = null;
    this.cells = [];
    this.note = $('bb-note');
    this.playBtn = $('bb-play');
    this.tempo = $('bb-tempo');
    this.bpmOut = $('bb-bpm');
    this.build();
    this.load();
  }

  build() {
    const grid = $('bb-grid');
    let lastLane = null;
    ROWS.forEach((row, r) => {
      if (row.lane !== lastLane) {
        const h = document.createElement('div');
        h.className = 'bb-lane';
        h.textContent = LANE_NAMES[row.lane];
        h.setAttribute('aria-hidden', 'true');
        grid.append(h);
        lastLane = row.lane;
      }
      const label = document.createElement('div');
      label.className = 'bb-label';
      label.textContent = row.label;
      label.setAttribute('aria-hidden', 'true');
      grid.append(label);
      for (let s = 0; s < STEPS; s++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `cell ${row.lane}${s % 4 === 0 ? ' beat' : ''}`;
        b.setAttribute('aria-label', `${LANE_NAMES[row.lane]} ${row.label}, step ${s + 1}`);
        b.setAttribute('aria-pressed', 'false');
        b.tabIndex = r === 0 && s === 0 ? 0 : -1;
        b.dataset.r = String(r);
        b.dataset.s = String(s);
        b.addEventListener('click', () => this.toggle(r, s));
        b.addEventListener('keydown', (e) => this.gridKey(e, r, s));
        grid.append(b);
        this.cells.push(b);
      }
    });

    this.playBtn.addEventListener('click', () => (this.playing ? this.stop() : this.play()));
    this.tempo.addEventListener('input', () => {
      this.bpm = Number(this.tempo.value);
      this.bpmOut.textContent = String(this.bpm);
      this.persist();
    });
    document.querySelectorAll('#panel-boombox [data-preset]').forEach((b) => b.addEventListener('click', () => this.applyPreset(b.dataset.preset, true)));
    $('bb-clear').addEventListener('click', () => {
      this.pattern.fill(0);
      this.sync();
      this.persist();
      this.say('Cleared. Click some squares.');
    });
    $('bb-share').addEventListener('click', () => this.share());
  }

  cellAt(r, s) {
    return this.cells[r * STEPS + s];
  }

  gridKey(e, r, s) {
    const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    const nr = (r + m[0] + ROWS.length) % ROWS.length;
    const ns = (s + m[1] + STEPS) % STEPS;
    const cur = this.cellAt(r, s);
    const next = this.cellAt(nr, ns);
    cur.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  }

  toggle(r, s) {
    this.pattern[r] ^= 1 << s;
    const on = !!(this.pattern[r] & (1 << s));
    this.cellAt(r, s).setAttribute('aria-pressed', String(on));
    if (on && !this.playing) {
      const ac = initAudio();
      const row = ROWS[r];
      if (ac) playVoice(row.lane === 'drum' ? row.kind : row.lane, row.f, ac.currentTime + 0.01);
    }
    this.persist();
  }

  sync() {
    ROWS.forEach((_, r) => {
      for (let s = 0; s < STEPS; s++) this.cellAt(r, s).setAttribute('aria-pressed', String(!!(this.pattern[r] & (1 << s))));
    });
    this.tempo.value = String(this.bpm);
    this.bpmOut.textContent = String(this.bpm);
  }

  applyPreset(name, announce) {
    const p = PRESETS[name];
    if (!p) return;
    p.rows.forEach((row, r) => {
      let bits = 0;
      for (let s = 0; s < STEPS; s++) if (row[s] === 'x') bits |= 1 << s;
      this.pattern[r] = bits;
    });
    this.bpm = p.bpm;
    this.sync();
    this.persist();
    if (announce) {
      sfx.select();
      this.say(this.playing ? `Now playing "${p.name}".` : `Loaded "${p.name}". Press play.`);
    }
  }

  encode() {
    const bytes = new Uint8Array(ROWS.length * 2);
    this.pattern.forEach((v, r) => {
      bytes[r * 2] = v >> 8;
      bytes[r * 2 + 1] = v & 255;
    });
    return `${this.bpm}.${b64url(bytes)}`;
  }

  decode(code) {
    try {
      const [bpmStr, data] = String(code).split('.');
      const bpm = Number(bpmStr);
      const bytes = unb64url(data || '');
      if (bytes.length !== ROWS.length * 2 || !(bpm >= 60 && bpm <= 200)) return false;
      for (let r = 0; r < ROWS.length; r++) this.pattern[r] = (bytes[r * 2] << 8) | bytes[r * 2 + 1];
      this.bpm = Math.round(bpm);
      return true;
    } catch {
      return false;
    }
  }

  load() {
    if (!(this.game.save.loop && this.decode(this.game.save.loop))) this.applyPreset('cozy', false);
    this.sync();
  }

  persist() {
    this.game.save.loop = this.encode();
    this.game.write();
  }

  play() {
    const ac = initAudio();
    if (!ac) {
      this.say("This browser can't play sound, sorry.");
      return;
    }
    this.playing = true;
    this.stepIdx = 0;
    this.beats = 0;
    this.queue = [];
    this.nextTime = ac.currentTime + 0.06;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
    this.playBtn.textContent = '■ Stop';
    this.say('It keeps playing in the room when you close this window.');
    if (this.pattern.some((v) => v)) this.game.unlock('dj');
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
    this.queue = [];
    this.step = -1;
    this.markStep();
    this.playBtn.textContent = '▶ Play';
  }

  schedule() {
    const ac = getAudio();
    if (!ac || !this.playing) return;
    const stepDur = 60 / this.bpm / 4;
    if (this.nextTime < ac.currentTime - 0.05) this.nextTime = ac.currentTime + 0.03;
    while (this.nextTime < ac.currentTime + 0.12) {
      const s = this.stepIdx;
      const t = this.nextTime;
      ROWS.forEach((row, r) => {
        if (this.pattern[r] & (1 << s)) playVoice(row.lane === 'drum' ? row.kind : row.lane, row.f, t);
      });
      this.queue.push({ s, t });
      this.nextTime += stepDur;
      this.stepIdx = (s + 1) % STEPS;
    }
  }

  // Called every frame: keeps the playhead and the room's boombox in time with the audio.
  tick(dt) {
    this.pulse = Math.max(0, this.pulse - dt * 4);
    if (!this.playing) return;
    const ac = getAudio();
    if (!ac) return;
    let changed = false;
    while (this.queue.length && this.queue[0].t <= ac.currentTime) {
      const q = this.queue.shift();
      this.step = q.s;
      changed = true;
      if (q.s % 4 === 0) {
        this.beats++;
        this.pulse = 1;
      }
    }
    if (changed && this.game.panels.current?.id === 'panel-boombox') this.markStep();
  }

  markStep() {
    for (const c of this.cells) c.classList.toggle('now', Number(c.dataset.s) === this.step);
  }

  async share() {
    const url = `${location.origin}/#loop=${this.encode()}`;
    try {
      await navigator.clipboard.writeText(url);
      this.say('Link copied. Whoever opens it can play your loop.');
    } catch {
      this.say(`Copy this link: ${url}`);
    }
  }

  say(t) {
    this.note.textContent = t;
  }

  open({ shared } = {}) {
    if (shared) {
      if (this.decode(shared)) {
        this.persist();
        this.say('Someone sent you this loop. Press play.');
      } else {
        this.say("That loop link didn't work, so here's your own loop.");
      }
    } else if (!this.playing) {
      this.say('');
    }
    this.sync();
    this.markStep();
    this.game.panels.open('panel-boombox');
  }
}
