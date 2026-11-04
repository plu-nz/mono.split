# Split agent instructions

Read this repository's `README.md`, the [PLUNZ shared context](https://github.com/plu-nz/.github/blob/main/CONTEXT.md), the [architecture standard](https://github.com/plu-nz/.github/blob/main/decisions/2026-11-03-architecture-and-stack.md), the [mobile-first and installability decision](https://github.com/plu-nz/.github/blob/main/decisions/2026-11-04-mobile-first-and-installable-apps.md), and the [pnpm decision](https://github.com/plu-nz/.github/blob/main/decisions/2026-11-04-pnpm-package-manager.md) before changing architecture or dependencies.

## Architecture and responsibilities

- `src/App.tsx` and `src/style.css` implement the mobile-first SolidJS interface.
- `src/core.ts` implements exact integer-cent allocation. Keep it independent of UI and network code.
- `src/worker.ts` is the Hono Worker for static assets and receipt scanning; `src/scan.ts` validates model output. It has no database or persistent bill storage.
- `public/` contains the product favicon and smartphone icons. `vite.config.ts` generates the manifest and service worker. `wrangler.jsonc` declares the Cloudflare Worker, AI binding, rate limit, and domain.

## Conventions and dependencies

- Write code, comments, documentation, issues, and product copy in English unless product localization is explicitly planned.
- Use pnpm for installs and scripts. Commit `pnpm-lock.yaml`; never add an npm, yarn, or Bun lockfile.
- Keep money as integer minor units. Do not use floating-point totals, implicitly choose a currency, or trust AI-extracted prices without user review.
- Keep bills and names local to the browser. Do not log or persist receipt photos, line items, or participant names on the Worker. Add a provider or dependency only for a concrete feature need.
- Keep receipt photos, `/api/*` responses, and bill data out of the service-worker cache. Preserve offline manual splitting and installation when changing assets or routing.
- Follow the nearby code style. Keep every directory indexed by a `README.md`.

## Commands and completion checks

- Install: `pnpm install --frozen-lockfile`.
- Develop: `pnpm dev` and `pnpm exec wrangler dev` in separate terminals for scanning.
- Test: `pnpm test`.
- Build and type-check: `pnpm build`.
- Deploy preview check: `pnpm exec wrangler deploy --dry-run`.
- Before completing a change, verify exact bill reconciliation, malformed scan handling, keyboard use, 320px layout, installability, offline manual splitting, and the deployed domain when deployment behavior changes.
