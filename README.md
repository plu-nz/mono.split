# Split

**Split** helps a group divide a large restaurant bill without accounts. Open [split.plu.nz](https://split.plu.nz/), add items and people, optionally enter the printed total as a check, assign each line to the people who shared it, and copy the result. The sum of person totals always matches the full bill in integer minor units when every item is assigned.

The interface supports English, Portuguese, and Spanish. It follows the browser language by default, falls back to English, and shares a manually selected language with PLUNZ web apps on `plu.nz` in the same browser.

A receipt photo can be scanned with Cloudflare Workers AI. The model returns **suggestions only**: review and correct every name, quantity, and price before adding them. Manual entry works without AI. The bill and participant names are stored only in this browser for up to seven days; a resized photo is sent to Cloudflare for a requested scan and is not stored by Split. There are no accounts, payments, restaurant integrations, or shared bill links.

## Stack and cost

- SolidJS, TypeScript, and Vite for the UI. Shared `Theme`, `Card`, `TextField`, and `Button` primitives come from a pinned `@plunz/storybook` Git revision; bill-specific controls remain local.
- A small Hono Worker serves the SPA and `/api/scan`; Cloudflare Workers AI Moondream 3.1 reads a receipt image.
- No database, object storage, or self-hosted service. The scan endpoint is limited to five requests per minute per source IP and images under 4 MB. Free AI quota exhaustion returns an error; manual entry remains available. Check [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) before changing models or account plan.
- Darkppuccin colors and a square product mark follow the [PLUNZ visual proposal](https://github.com/plu-nz/.github/pull/2). The UI is mobile first with bottom step navigation.
- Split follows the [PLUNZ mobile-first and installability decision](https://github.com/plu-nz/.github/blob/main/decisions/2026-11-04-mobile-first-and-installable-apps.md): a web app manifest, product icons, and a service worker let the app launch from a smartphone home screen.

## Installation and offline use

On Android, use your browser's **Install app** or **Add to Home screen** action. On iPhone in Safari, use **Share → Add to Home Screen**. Browser menus differ, and an automatic install prompt is not guaranteed. Installed Split opens in standalone mode.

The service worker precaches the app shell and static assets. After the first successful online visit and service-worker installation, manual bill entry, allocation, draft restore, and result copying work offline. Scanning a receipt needs a connection to Cloudflare Workers AI. Receipt photos, API responses, bill details, and participant names are never placed in the service-worker cache. The draft remains in browser local storage for up to seven days; clearing site data or uninstalling the app may remove it. Updates are applied on a later visit so an active bill is not unexpectedly reloaded.

## Development

Use pnpm only:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm exec wrangler dev
pnpm test
pnpm build
```

`pnpm dev` runs Vite on port 5173 and proxies `/api` to Wrangler on port 8787. Run `pnpm exec wrangler dev` in a second terminal when testing image scans. AI inference uses the configured Cloudflare account even in local development. The frontend's manual flow works without Wrangler.

## Deploy

`wrangler.jsonc` pins the PLUNZ account and `split.plu.nz` custom domain. From a clean checkout:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm exec wrangler deploy --dry-run
pnpm exec wrangler deploy
```

Check `/api/healthz`, the app, manifest and icon URLs, home-screen installation, offline manual splitting, a real scan while online, an uneven split, and mobile/keyboard behavior after deployment. No OAuth or secret is required. See the [source index](src/README.md) and [public assets index](public/README.md).
