import { C } from './palette.js';

// 0 = new moon, 0.5 = full moon. Accurate to within about a day.
export function moonPhase(date) {
  const synodic = 29.530588853;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - knownNewMoon) / 86400000;
  return (((days % synodic) + synodic) % synodic) / synodic;
}

export function moonSentence(p) {
  if (p < 0.03 || p > 0.97) return "It's a new moon, so the stars get the sky to themselves.";
  if (p > 0.47 && p < 0.53) return 'The full moon is out tonight.';
  const name =
    p < 0.22 ? 'waxing crescent' :
    p < 0.28 ? 'first quarter' :
    p < 0.47 ? 'waxing gibbous' :
    p < 0.72 ? 'waning gibbous' :
    p < 0.78 ? 'last quarter' : 'waning crescent';
  return `A ${name} moon is out tonight.`;
}

// Draws the moon with its real phase: the lit side grows from the right, then shrinks to the left.
export function drawMoon(g, cx, cy, r, phase, lit = C.glow, dark = C.plum) {
  const k = Math.cos(phase * 2 * Math.PI);
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt((r + 0.5) ** 2 - y * y));
    const w = half + 0.5;
    for (let x = -half; x <= half; x++) {
      const isLit = phase < 0.5 ? x > k * w : x < -k * w;
      g.fillStyle = isLit ? lit : dark;
      g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

// Time of day decides the sky outside the window and how dark the room is.
export function dayPhase(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  let phase = 'night';
  if (h >= 5.5 && h < 7.5) phase = 'dawn';
  else if (h >= 7.5 && h < 17.5) phase = 'day';
  else if (h >= 17.5 && h < 20.5) phase = 'dusk';
  const ambient = { night: 0.2, dawn: 0.62, day: 1, dusk: 0.55 }[phase];
  return { phase, ambient, hour: h };
}

export const SKY_COLORS = {
  night: { sky: [C.ink, C.plumDark, C.navy], city: C.ink, lit: 0.45 },
  dawn: { sky: [C.violet, C.lavender, C.coral, C.lamp], city: C.plum, lit: 0.15 },
  day: { sky: [C.blue, C.blue, C.sky], city: C.lavender, lit: 0 },
  dusk: { sky: [C.plum, C.burgundy, C.coral, C.lamp], city: C.plumDark, lit: 0.35 },
};
