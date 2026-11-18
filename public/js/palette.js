// The room's palette. Every pixel on the site comes from this list.
export const C = {
  ink: '#140f1f',
  plumDark: '#2a2140',
  plum: '#3f2f5c',
  violet: '#5e4880',
  lavender: '#8a6fae',
  lilac: '#c9b6e4',
  paper: '#f6eedd',
  woodDark: '#4a2a24',
  wood: '#7a4630',
  woodLight: '#a8673f',
  tan: '#d89a5b',
  lamp: '#f0c27a',
  glow: '#fff1b8',
  burgundy: '#8c2f39',
  red: '#c94f4f',
  coral: '#f08a7e',
  tealDark: '#2f6b5e',
  teal: '#3fa08a',
  mint: '#8fdcc2',
  navy: '#2b4c7e',
  blue: '#4f86c6',
  sky: '#a9d4f5',
  greenDark: '#3e6b35',
  green: '#6fae4a',
  greenLight: '#b8e07a',
  orange: '#e8a33d',
  orangeDark: '#b8642a',
  beige: '#d8cfb8',
  beigeDark: '#a49a82',
  grey: '#6e6a7c',
  greyLight: '#b7b4c4',
  gold: '#ffd54a',
  white: '#ffffff',
  brick: '#7c3b3b',
};

// One character per colour, so sprites can be drawn as rows of text.
export const PAL = {
  0: C.ink, 1: C.plumDark, 2: C.plum, 3: C.violet, 4: C.lavender, 5: C.lilac, 6: C.paper,
  7: C.woodDark, 8: C.wood, 9: C.woodLight, a: C.tan, b: C.lamp, c: C.glow,
  d: C.burgundy, e: C.red, f: C.coral, g: C.tealDark, h: C.teal, i: C.mint,
  j: C.navy, k: C.blue, l: C.sky, m: C.greenDark, n: C.green, o: C.greenLight,
  p: C.orange, q: C.orangeDark, r: C.beige, s: C.beigeDark, t: C.grey, u: C.greyLight,
  v: C.gold, w: C.white, x: C.brick,
};

// Hood colours the visitor can try on in the mirror. Gold is unlocked by the secret.
export const HOODS = [
  { id: 'mustard', name: 'Mustard', s: C.lamp, t: C.orange },
  { id: 'tomato', name: 'Tomato', s: C.red, t: C.burgundy },
  { id: 'denim', name: 'Denim', s: C.blue, t: C.navy },
  { id: 'lilac', name: 'Lilac', s: C.lilac, t: C.lavender },
  { id: 'mint', name: 'Mint', s: C.mint, t: C.teal },
  { id: 'paper', name: 'Paper', s: C.paper, t: C.greyLight },
  { id: 'coral', name: 'Coral', s: C.coral, t: C.red },
  { id: 'gold', name: 'Gold', s: C.gold, t: C.orange, secret: true },
];

// Sprite Studio colours. Index 0 is transparent.
export const SPRITE_COLORS = [
  null, C.ink, C.paper, C.grey, C.greyLight, C.wood, C.tan, C.burgundy,
  C.red, C.coral, C.orange, C.gold, C.green, C.teal, C.blue, C.lavender,
];
