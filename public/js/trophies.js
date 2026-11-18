import { sfx } from './audio.js';
import { toast } from './ui.js';

// The order here is the order they appear on the shelf, four per row.
export const ACHIEVEMENTS = [
  { id: 'hello', name: 'Hello there', desc: 'Started a save file.', hint: 'Press start.' },
  { id: 'kitty', name: 'Good kitty', desc: 'Petted the cat.', hint: 'Someone small wants attention.' },
  { id: 'artist', name: 'Artist', desc: 'Hung a sprite on the wall.', hint: 'The desk has a drawing program.' },
  { id: 'dj', name: 'Night DJ', desc: 'Played a loop on the boombox.', hint: 'Press play on something.' },
  { id: 'runner', name: 'Rooftop regular', desc: 'Scored 300 in Rooftop Run.', hint: 'The TV is plugged into something.' },
  { id: 'plant', name: 'Green thumb', desc: 'Watered the plant.', hint: 'It looks a little thirsty.' },
  { id: 'lights', name: 'Lights out', desc: 'Turned off the lamp.', hint: 'Click.' },
  { id: 'mirror', name: 'Fresh look', desc: 'Tried a new color in the mirror.', hint: 'Check your reflection.' },
  { id: 'couch', name: 'Couch potato', desc: 'Sat on the couch for 20 seconds.', hint: 'Get comfy.' },
  { id: 'owl', name: 'Night owl', desc: 'Visited between midnight and 5 a.m.', hint: 'Come back very late.' },
  { id: 'regular', name: 'Regular', desc: 'Came by on three different days.', hint: 'Come back another day.' },
  { id: 'secret', name: 'High places', desc: 'Found the golden cartridge.', hint: 'Look up. Way up.' },
];

export function unlock(game, id) {
  const s = game.save;
  if (s.trophies[id]) return false;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return false;
  s.trophies[id] = Date.now();
  game.write();
  sfx.trophy();
  toast('Trophy', a.name);
  return true;
}

function clock(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function renderTrophies(game) {
  const s = game.save;
  const got = ACHIEVEMENTS.filter((a) => s.trophies[a.id]).length;
  const stats = [
    ['Trophies', `${got} of ${ACHIEVEMENTS.length}`],
    ['Visits', String(s.visits)],
    ['Days here', String(s.days.length)],
    ['Time here', clock(s.playSec)],
    ['Cat pets', String(s.pets)],
    ['Best run', String(s.best)],
  ];
  const dl = document.getElementById('trophy-stats');
  dl.textContent = '';
  for (const [k, v] of stats) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    row.append(dt, dd);
    dl.append(row);
  }
  const list = document.getElementById('trophy-list');
  list.textContent = '';
  for (const a of ACHIEVEMENTS) {
    const has = !!s.trophies[a.id];
    const li = document.createElement('li');
    li.className = has ? 'got' : 'locked';
    const icon = document.createElement('span');
    icon.className = 'trophy-icon';
    icon.textContent = has ? '★' : '☆';
    icon.setAttribute('aria-hidden', 'true');
    const txt = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = has ? a.name : 'Not found yet';
    const d = document.createElement('span');
    d.textContent = has ? a.desc : `Hint: ${a.hint}`;
    txt.append(name, d);
    li.append(icon, txt);
    list.append(li);
  }
}
