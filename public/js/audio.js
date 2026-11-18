// Every sound on the site is synthesised here. No audio files.
let ac = null;
let master;
let sfxBus;
let musicBus;
let noiseBuf;
let pulse25;
let pulse12;
let muted = false;

export function initAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC(); } catch { return null; }
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ac.destination);
    sfxBus = ac.createGain();
    sfxBus.gain.value = 0.32;
    sfxBus.connect(master);
    musicBus = ac.createGain();
    musicBus.gain.value = 0.42;
    musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    pulse25 = pulseWave(0.25);
    pulse12 = pulseWave(0.125);
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

export const getAudio = () => ac;

export function setMuted(m) {
  muted = m;
  if (ac) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.02);
}

export function suspendAudio(on) {
  if (!ac) return;
  if (on) ac.suspend().catch(() => {});
  else ac.resume().catch(() => {});
}

// The narrow square waves of old consoles.
function pulseWave(duty) {
  const n = 48;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    re[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k);
    im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k);
  }
  return ac.createPeriodicWave(re, im);
}

function envelope(param, t, attack, peak, dur) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
}

function tone({ wave, type = 'square', freq, to, t, dur = 0.1, vol = 0.2, bus = sfxBus, attack = 0.004, filter }) {
  const o = ac.createOscillator();
  const gn = ac.createGain();
  if (wave) o.setPeriodicWave(wave);
  else o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  envelope(gn.gain, t, attack, vol, dur);
  let node = o;
  if (filter) {
    const f = ac.createBiquadFilter();
    f.type = filter.type;
    f.frequency.value = filter.freq;
    f.Q.value = filter.q ?? 0.8;
    node.connect(f);
    node = f;
  }
  node.connect(gn).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hiss({ t, dur = 0.08, vol = 0.3, type = 'highpass', freq = 6000, q = 0.8, to, bus = sfxBus }) {
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = q;
  const gn = ac.createGain();
  envelope(gn.gain, t, 0.002, vol, dur);
  s.connect(f).connect(gn).connect(bus);
  s.start(t, Math.random() * 0.4);
  s.stop(t + dur + 0.05);
}

const ready = () => ac && ac.state === 'running' && !muted;
const at = (d = 0) => ac.currentTime + 0.01 + d;

export const sfx = {
  blip() { if (ready()) tone({ wave: pulse25, freq: 620, t: at(), dur: 0.03, vol: 0.05 }); },
  select() { if (ready()) tone({ wave: pulse25, freq: 880, t: at(), dur: 0.06, vol: 0.08 }); },
  open() {
    if (!ready()) return;
    tone({ wave: pulse25, freq: 523, t: at(), dur: 0.07, vol: 0.08 });
    tone({ wave: pulse25, freq: 784, t: at(0.06), dur: 0.09, vol: 0.08 });
  },
  close() {
    if (!ready()) return;
    tone({ wave: pulse25, freq: 784, t: at(), dur: 0.06, vol: 0.07 });
    tone({ wave: pulse25, freq: 523, t: at(0.05), dur: 0.08, vol: 0.07 });
  },
  jump() { if (ready()) tone({ wave: pulse25, freq: 300, to: 620, t: at(), dur: 0.11, vol: 0.08 }); },
  land() { if (ready()) hiss({ t: at(), dur: 0.05, vol: 0.12, type: 'lowpass', freq: 700 }); },
  coin() {
    if (!ready()) return;
    tone({ wave: pulse25, freq: 988, t: at(), dur: 0.06, vol: 0.09 });
    tone({ wave: pulse25, freq: 1319, t: at(0.06), dur: 0.16, vol: 0.09 });
  },
  click() { if (ready()) hiss({ t: at(), dur: 0.025, vol: 0.3, type: 'bandpass', freq: 2600, q: 3 }); },
  knock() {
    if (!ready()) return;
    for (const d of [0, 0.17]) {
      tone({ type: 'sine', freq: 150, to: 70, t: at(d), dur: 0.09, vol: 0.5 });
      hiss({ t: at(d), dur: 0.04, vol: 0.12, type: 'lowpass', freq: 900 });
    }
  },
  water() {
    if (!ready()) return;
    for (let i = 0; i < 4; i++) tone({ type: 'sine', freq: 900 + Math.random() * 500, to: 420, t: at(i * 0.07), dur: 0.06, vol: 0.07 });
  },
  meow() {
    if (!ready()) return;
    const t = at();
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(780, t + 0.12);
    o.frequency.linearRampToValueAtTime(560, t + 0.32);
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(1500, t + 0.12);
    f.frequency.linearRampToValueAtTime(800, t + 0.32);
    f.Q.value = 3;
    const gn = ac.createGain();
    envelope(gn.gain, t, 0.03, 0.22, 0.36);
    o.connect(f).connect(gn).connect(sfxBus);
    o.start(t);
    o.stop(t + 0.4);
  },
  purr() {
    if (!ready()) return;
    const t = at();
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 160;
    const am = ac.createGain();
    am.gain.value = 0;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 23;
    lfo.connect(am.gain);
    const out = ac.createGain();
    envelope(out.gain, t, 0.1, 0.9, 1.6);
    s.connect(f).connect(am).connect(out).connect(sfxBus);
    s.start(t);
    s.stop(t + 1.7);
    lfo.start(t);
    lfo.stop(t + 1.7);
  },
  trophy() {
    if (!ready()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone({ wave: pulse25, freq: f, t: at(i * 0.08), dur: 0.12, vol: 0.08 }));
  },
  bonk() {
    if (!ready()) return;
    tone({ type: 'square', freq: 220, to: 60, t: at(), dur: 0.3, vol: 0.1 });
    hiss({ t: at(), dur: 0.12, vol: 0.2, type: 'lowpass', freq: 1200 });
  },
  start() {
    if (!ready()) return;
    [392, 523, 659, 784].forEach((f, i) => tone({ wave: pulse12, freq: f, t: at(i * 0.07), dur: 0.1, vol: 0.08 }));
  },
  crt() {
    if (!ready()) return;
    hiss({ t: at(), dur: 0.2, vol: 0.12, type: 'bandpass', freq: 3200, to: 500, q: 1 });
  },
  gameOver() {
    if (!ready()) return;
    [523, 415, 330, 262].forEach((f, i) => tone({ wave: pulse25, freq: f, t: at(i * 0.13), dur: 0.16, vol: 0.08 }));
  },
};

// The boombox's four instruments.
export function playVoice(kind, freq, t) {
  if (!ac) return;
  switch (kind) {
    case 'lead':
      tone({ wave: pulse25, freq, t, dur: 0.22, vol: 0.16, bus: musicBus, filter: { type: 'lowpass', freq: 3800 } });
      break;
    case 'bass':
      tone({ type: 'triangle', freq, t, dur: 0.3, vol: 0.45, bus: musicBus });
      break;
    case 'kick':
      tone({ type: 'sine', freq: 150, to: 42, t, dur: 0.16, vol: 0.9, bus: musicBus, attack: 0.002 });
      break;
    case 'snare':
      hiss({ t, dur: 0.13, vol: 0.38, type: 'bandpass', freq: 1900, q: 0.9, bus: musicBus });
      tone({ type: 'triangle', freq: 190, to: 140, t, dur: 0.08, vol: 0.28, bus: musicBus });
      break;
    case 'hat':
      hiss({ t, dur: 0.035, vol: 0.16, type: 'highpass', freq: 7500, bus: musicBus });
      break;
    default:
  }
}
