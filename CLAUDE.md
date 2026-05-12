# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

This is an Astro 5 static blog deployed to **Cloudflare Workers** via `@astrojs/cloudflare`. Output is a static site plus a Worker entry (`dist/_worker.js/index.js`) that serves assets via the `ASSETS` binding declared in `wrangler.json`.

### Build → deploy pipeline

1. `astro build` emits both static assets and a Worker bundle into `./dist/`.
2. `wrangler.json` points `main` at `./dist/_worker.js/index.js` and binds `./dist` as the `ASSETS` static-asset directory. `upload_source_maps` and `observability` are on.
3. `astro.config.mjs` sets `adapter: cloudflare({ platformProxy: { enabled: true } })` so `astro dev` exposes the Cloudflare runtime (`Astro.locals.runtime`) locally. The `Env` type comes from `worker-configuration.d.ts` and is wired into `App.Locals` via `src/env.d.ts`.

### Content collections

Blog posts live in `src/content/blog/` as `.md` / `.mdx`. The collection is declared in `src/content.config.ts` using the `glob` loader with a zod schema (`title`, `description`, `pubDate`, optional `updatedDate`, optional `heroImage`). Anything reading posts uses `getCollection('blog')` from `astro:content`; the post `id` is the slug.

### Routing

File-based via `src/pages/`:
- `index.astro` — home.
- `about.astro` — static page.
- `blog/index.astro` — post list (sorts by `pubDate` desc).
- `blog/[...slug].astro` — dynamic post page; `getStaticPaths()` enumerates the blog collection and renders through `src/layouts/BlogPost.astro`.
- `rss.xml.js` — RSS endpoint built from the same collection; uses `context.site` (set via `site:` in `astro.config.mjs`) for absolute URLs.

To add a post: drop a `.md`/`.mdx` into `src/content/blog/` with frontmatter matching the zod schema — no route registration needed.

### Shared layout primitives

- `src/components/BaseHead.astro` — single source of truth for `<head>`, canonical URL, OpenGraph/Twitter tags, font preloads, and the global CSS import (`src/styles/global.css`). Every page renders this inside its own `<head>`.
- `src/components/Header.astro` / `Footer.astro` / `HeaderLink.astro` — chrome shared across pages.
- `src/layouts/BlogPost.astro` — wraps post content, takes the blog frontmatter as props (`type Props = CollectionEntry<'blog'>['data']`).
- `src/consts.ts` — `SITE_TITLE` / `SITE_DESCRIPTION` used by `BaseHead`, the home page, and the RSS feed. Update both `consts.ts` and `site:` in `astro.config.mjs` when rebranding.

### TypeScript

Extends `astro/tsconfigs/strict` with `strictNullChecks` on. Generated types live in `.astro/types.d.ts` and `worker-configuration.d.ts` — don't edit by hand; regenerate the latter with `npm run cf-typegen`.

## Conventions

- Indentation: tabs (see existing `.astro`/`.ts` files).
- Static assets that should be served as-is go in `public/` (referenced with absolute paths like `/blog-placeholder-1.jpg`). `public/.assetsignore` controls what `@astrojs/cloudflare` excludes from `ASSETS`.
- When adding a Cloudflare binding (KV, D1, R2, etc.): edit `wrangler.json`, then run `npm run cf-typegen` so `Env` picks it up; access via `Astro.locals.runtime.env` in pages/endpoints.
