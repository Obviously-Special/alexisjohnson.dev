import { C } from './palette.js';
import { rect, drawLogo } from './gfx.js';

const $ = (id) => document.getElementById(id);

// "Press start", drawn over a dimmed view of the room.
export class Title {
  constructor(game) {
    this.game = game;
    this.ui = $('title-ui');
    this.saveLine = $('title-save');
    this.t = 0;
    this.starting = false;
    $('btn-start').addEventListener('click', () => this.start());
  }

  enter() {
    this.starting = false;
    this.ui.hidden = false;
    this.game.room.showPlayer = false;
    this.saveLine.textContent = this.describe();
  }

  exit() {
    this.ui.hidden = true;
  }

  describe() {
    const s = this.game.save;
    const got = Object.keys(s.trophies).length;
    if (s.visits <= 1 && got === 0) return 'A new save file is ready.';
    return `Welcome back! Visit ${s.visits}, ${got} of 12 trophies.`;
  }

  update(dt) {
    this.t += dt;
    this.game.room.ambient(dt);
    const input = this.game.input;
    if (input.pressed('use') || input.pressed('jump')) this.start();
  }

  draw(g) {
    const { w } = this.game.view;
    this.game.room.draw(g);
    g.globalAlpha = 0.6;
    rect(g, 0, 0, w, 180, C.ink);
    g.globalAlpha = 1;
    drawLogo(g, 'ALEXIS', w / 2, 30, this.t, { b: 3, wave: !this.game.reduced });
  }

  onPointer() {
    this.start();
  }

  start(then) {
    if (this.starting) return;
    this.starting = true;
    this.game.begin(then);
  }
}
