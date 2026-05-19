# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

All commands are run from the repo root. Node `>=22` is required.

| Command | What it does |
| --- | --- |
| `npm run dev` | Astro dev server at `localhost:4321` (Cloudflare `platformProxy` enabled, so `Astro.locals.runtime` works locally). |
| `npm run build` | Build static output to `./dist/` (includes the Cloudflare `_worker.js` entry). |
| `npm run preview` | `astro build` + `wrangler dev` — runs the built Worker locally. Use this instead of `npm run dev` when verifying Cloudflare-runtime behavior. |
| `npm run lint` / `npm run lint:fix` | Run ESLint over `.ts`/`.js`/`.astro`. Config is `eslint.config.mjs` (flat config). Run before pushing. |
| `npm run check` | Full preflight: `astro build && tsc && wrangler deploy --dry-run`. Run before pushing. |
| `npm run deploy` | `wrangler deploy` (assumes `dist/` is already built — use `npm run build && npm run deploy`). |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` from `wrangler.json`. Run after editing bindings/env in `wrangler.json`. |
| `npm run astro -- <cmd>` | Pass-through to the Astro CLI (e.g. `astro add`, `astro check`). |
| `npx wrangler tail` | Stream live Worker logs from the deployed environment. |

There is no test runner. Static verification is `npm run lint` (ESLint flat config: `typescript-eslint` + `eslint-plugin-astro` recommended, plus AI-slop guards — `no-unused-vars`, `no-console`, `no-useless-catch`, `no-empty`, `no-explicit-any`, `no-non-null-assertion`, `consistent-type-imports`, `eqeqeq`, `no-var`, `prefer-const`) and `npm run check` (full typecheck + dry-run deploy). Prefix intentionally unused identifiers (catch params, stub args) with `_` to opt out of `no-unused-vars`.

## Architecture

Astro 5 deployed to **Cloudflare Workers** via `@astrojs/cloudflare`. One page: a postcard-themed, password-gated RSVP form at `/` (`src/pages/index.astro`), SSR-rendered, backed by a D1 database. Build output is a static asset set plus a Worker entry (`dist/_worker.js/index.js`) that serves assets via the `ASSETS` binding declared in `wrangler.json`.

### Build → deploy pipeline

1. `astro build` emits both static assets and a Worker bundle into `./dist/`.
2. `wrangler.json` points `main` at `./dist/_worker.js/index.js` and binds `./dist` as the `ASSETS` static-asset directory. `upload_source_maps` and `observability` are on.
3. `astro.config.mjs` sets `adapter: cloudflare({ platformProxy: { enabled: true } })` so `astro dev` exposes the Cloudflare runtime (`Astro.locals.runtime`) locally. The `Env` type comes from `worker-configuration.d.ts` and is wired into `App.Locals` via `src/env.d.ts`.

### Routing

File-based via `src/pages/`. Add a page by dropping a new `.astro` (or `.md` once a content pipeline is reintroduced) under `src/pages/`. Pages with `export const prerender = false` are SSR-rendered by the Worker and can read `Astro.request` for non-GET methods.

### RSVP flow (`/`)

A single SSR page that handles its own POST inline — no separate `/api/*` route, no redirects, minimal client JS (only the postcard flip toggle).

- `src/pages/index.astro` (`prerender = false`) renders a 3D-flippable postcard. The front shows a postcard illustration; tapping flips to a reply-postcard back where the form lives. On POST, the page builds a fresh `Request` from the form body and hands it to the Hono app via `app.fetch(req, Astro.locals.runtime.env, Astro.locals.runtime.ctx)`, then renders the success or error state inline. If a result exists, the card starts already flipped so the user sees feedback without re-tapping.
- `src/server/api.ts` exports the Hono app. The `POST /rsvp` route chains `zValidator('form', rsvpSchema)` → inline password-guard middleware (constant-time compare against `c.env.RSVP_PASSWORD`) → D1 insert. The shared schema/result types are exported so the page stays type-aligned with the server.
- `migrations/0001_create_rsvps_table.sql` defines the `rsvps` table; `0002_unique_email_on_rsvps.sql` adds the unique index on email. The D1 binding is remote-only, so apply migrations with `npx wrangler d1 migrations apply summervilla-rsvp --remote`.
- `RSVP_PASSWORD` lives in `.dev.vars` locally (gitignored; see `.dev.vars.example`) and `npx wrangler secret put RSVP_PASSWORD` in prod. The type is augmented onto `Cloudflare.Env` in `src/env.d.ts`.
- The `DB` binding in `wrangler.json` is created out-of-band: `npx wrangler d1 create summervilla-rsvp`, then paste the UUID into `database_id` and rerun `npm run cf-typegen`.

### Postcard assets

The page references four optional photo assets in `public/` — when present they replace the SVG fallback / empty polaroid frames:

- `public/postcard.jpg` — front face of the postcard (CSS background, falls back to `public/postcard-fallback.svg` if missing).
- `public/moodboard-1.jpg`, `moodboard-2.jpg`, `moodboard-3.jpg` — three floating polaroids around the card (hidden below 960px). Missing files render as cream-toned empty polaroids, which is intentional design, not a broken state.

To swap in real photos, drop the JPGs into `public/` with those exact filenames and commit. No code change needed.

### TypeScript

Extends `astro/tsconfigs/strict` with `strictNullChecks` on. Generated types live in `.astro/types.d.ts` and `worker-configuration.d.ts` — don't edit by hand; regenerate the latter with `npm run cf-typegen`.

## Conventions

- Indentation: tabs (see existing `.astro`/`.ts` files).
- Static assets that should be served as-is go in `public/` (referenced with absolute paths). `public/.assetsignore` controls what `@astrojs/cloudflare` excludes from `ASSETS`.
- When adding a Cloudflare binding (KV, D1, R2, etc.): edit `wrangler.json`, then run `npm run cf-typegen` so `Env` picks it up; access via `Astro.locals.runtime.env` in pages/endpoints.
