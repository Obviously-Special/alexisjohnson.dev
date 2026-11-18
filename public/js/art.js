import { makeSprite } from './gfx.js';
import { C } from './palette.js';

// The visitor: a small hooded figure. S and T are swapped for the hood colour.
const HEAD = [
  '....0000....',
  '...0SSSS0...',
  '..0SSSSSS0..',
  '.0SSSSSSSS0.',
  '.0SSS0000S0.',
  '0SSS000000S0',
  '0SSS00w0w0S0',
  '0SSS000000S0',
  '.0SSS0000S0.',
  '.0TSSSSSST0.',
];
const BLINK_ROW = '0SSS000000S0';
const BODY = [
  '..0TSSSST0..',
  '.0SSSSSSSS0.',
  '0TSSSSSSSST0',
  '0TSSSSSSSST0',
  '0TTSSSSSSTT0',
  '.0TTTTTTTT0.',
  '..00000000..',
];
const LEGS = {
  stand: ['...00..00...', '...00..00...', '..000..000..'],
  stride: ['...00..00...', '..00....00..', '.000....000.'],
  pass: ['....0000....', '....0000....', '....0000....'],
  jump: ['..00....00..', '.00......00.', '............'],
};

export function playerSprites(hood) {
  const col = { S: hood.s, T: hood.t };
  const blinkHead = HEAD.map((r, i) => (i === 6 ? BLINK_ROW : r));
  const make = (legs, head = HEAD) => makeSprite([...head, ...BODY, ...LEGS[legs]], col);
  return {
    stand: make('stand'),
    blink: make('stand', blinkHead),
    stride: make('stride'),
    pass: make('pass'),
    jump: make('jump'),
    sit: makeSprite([...HEAD, ...BODY.slice(0, 5)], col),
    sitBlink: makeSprite([...blinkHead, ...BODY.slice(0, 5)], col),
  };
}

// The cat, an orange tabby. All cat sprites face right.
const CAT_TOP = [
  '............q..q',
  '.q.........qpppp',
  '.p.........pqp0p',
  '.ppqpqpqpqppp66f',
  '..ppppppppppp66.',
  '..qpp66666ppq...',
];
const CAT_LEGS = {
  stand: ['...q.q....q.q...', '...6.6....6.6...'],
  a: ['..q...q..q...q..', '..6...6..6...6..'],
  b: ['....qq....qq....', '....66....66....'],
  jump: ['.q...........q..', 'q.............q.'],
};
const CAT_SIT = [
  '......q..q',
  '......qppp',
  '......pq0p',
  '......p66f',
  '.p...pp66.',
  'p...ppp66.',
  'p..pppp66.',
  '.p.pppp66.',
  '..ppppp66.',
  '..qqqq66q.',
];
export const CAT = {
  stand: makeSprite([...CAT_TOP, ...CAT_LEGS.stand]),
  walkA: makeSprite([...CAT_TOP, ...CAT_LEGS.a]),
  walkB: makeSprite([...CAT_TOP, ...CAT_LEGS.b]),
  jump: makeSprite([...CAT_TOP, ...CAT_LEGS.jump]),
  sit: makeSprite(CAT_SIT),
  happy: makeSprite(CAT_SIT.map((r, i) => (i === 2 ? '......pqqp' : r))),
  sleep: makeSprite([
    '..........q..q',
    '...pqpqpqpqppp',
    '..ppppppppp00p',
    '.pppppppppp66f',
    'pqppppppppp66.',
    '.qqqqqqqqqqq..',
  ]),
};

export const CROW = [
  makeSprite([
    '......00....',
    '.....020....',
    '....0220....',
    '.0000000000.',
    'p0w00000000.',
    '...00000.00.',
    '............',
  ]),
  makeSprite([
    '............',
    '............',
    '............',
    '.0000000000.',
    'p0w00000000.',
    '...0022000..',
    '.....020....',
  ]),
];

export const FISH = makeSprite([
  '..kkk..k',
  '.kllllkk',
  'k0lllll.',
  '.kllllkk',
  '..kkk..k',
]);

export const STAR = makeSprite([
  '...v...',
  '..vcv..',
  'vvvcvvv',
  '.vvvvv.',
  '..vvv..',
  '.vv.vv.',
  'vv...vv',
]);

export const HEART = makeSprite([
  '.e.e.',
  'eefee',
  'eeeee',
  '.eee.',
  '..e..',
]);

export const NOTE = makeSprite([
  '..iii',
  '..i.i',
  '..i..',
  '..i..',
  'iii..',
  'iii..',
]);

export const DROP = makeSprite(['.l.', 'lll', 'lkl', '.k.']);

export const SPARKLE = makeSprite([
  '..c..',
  '..c..',
  'ccwcc',
  '..c..',
  '..c..',
]);

export const ZZZ = makeSprite(['5555', '..5.', '.5..', '5555']);

export const DUST = makeSprite(['.u.', 'uuu', '.u.']);

const TROPHY_ROWS = [
  'vvvvvv',
  'vcvvvv',
  '.vcvv.',
  '..vv..',
  '..vv..',
  '.vvvv.',
  '.0000.',
];
export const TROPHIES = [
  makeSprite(TROPHY_ROWS, { v: C.gold, c: C.glow }),
  makeSprite(TROPHY_ROWS, { v: C.greyLight, c: C.white }),
  makeSprite(TROPHY_ROWS, { v: C.orangeDark, c: C.tan }),
];

export const CARTRIDGE = makeSprite([
  'vvvvvvvvvv',
  'vcqqqqqqcv',
  'vq666666qv',
  'vq6ee666qv',
  'vq666666qv',
  'vqqqqqqqqv',
  'vv0vv0vv0v',
  'vvvvvvvvvv',
]);
