# alexisjohnson.dev

The source for [alexisjohnson.dev](https://alexisjohnson.dev): a little pixel-art room you can walk around in.

Things to do there: play *Rooftop Run* on the TV, draw a sprite at the desk and hang it on the wall, make a chiptune loop on the boombox, pet the cat, and collect trophies. Each visitor's save file lives in their own browser (localStorage), so there are no cookies, accounts or servers.

## How it's built

Plain HTML, CSS and JavaScript modules in [`public/`](public/), with no build step and no dependencies. Every sprite is drawn in code and every sound is synthesised with Web Audio.

| File | What it does |
| --- | --- |
| `public/js/main.js` | Starts everything: scenes, screen size, controls |
| `public/js/room.js` | The room: furniture, lighting, the player and the cat |
| `public/js/rooftop.js` | Rooftop Run, the game on the TV |
| `public/js/studio.js` | Sprite Studio, the pixel editor on the desk |
| `public/js/boombox.js` | The step sequencer on the boombox |
| `public/js/art.js` | Sprites, drawn as rows of characters |
| `public/js/palette.js` | Every colour on the site |

The pixel font is [DotGothic16](https://github.com/fontworks-fonts/DotGothic16) (SIL Open Font License, see `public/fonts/OFL.txt`).

## How it deploys

Pushing to `main` starts a Cloudflare Workers build, which runs `npx wrangler deploy`. That uploads everything in `public/` as static files (see [`wrangler.jsonc`](wrangler.jsonc)), and the live site updates about a minute later.

## Preview locally

The scripts are JavaScript modules, so the folder has to be served rather than opened as a file. Run `npx wrangler dev` and open the address it prints. Add `?hour=22` to the address to see the room at night, or use any other hour.
