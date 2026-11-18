# alexisjohnson.dev

The source for [alexisjohnson.dev](https://alexisjohnson.dev).

The site is plain HTML and CSS in [`public/`](public/). There is no build step.

## How it deploys

Pushing to `main` starts a Cloudflare Workers build, which runs `npx wrangler deploy`. That uploads everything in `public/` as static files (see [`wrangler.jsonc`](wrangler.jsonc)), and the live site updates shortly after.

## Preview locally

Open `public/index.html` in a browser, or run `npx wrangler dev` to serve it the way Cloudflare does.
