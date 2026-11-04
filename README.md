# Split

**Split** helps a group divide a large restaurant bill without accounts. Open [split.plu.nz](https://split.plu.nz/), add items and people, assign each line to the people who shared it, and copy the result. The sum of person totals always matches the full bill in integer minor units when every item is assigned.

A receipt photo can be scanned with Cloudflare Workers AI. The model returns **suggestions only**: review and correct every name, quantity, and price before adding them. Manual entry works without AI. The bill and participant names are stored only in this browser for up to seven days; a photo is sent to Cloudflare for a requested scan and is not stored by Split. There are no accounts, payments, restaurant integrations, or shared bill links.

## Stack and cost

- SolidJS, TypeScript, and Vite for the UI.
- A small Hono Worker serves the SPA and `/api/scan`; Cloudflare Workers AI Moondream 3.1 reads a receipt image.
- No database, object storage, or self-hosted service. The scan endpoint is limited to five requests per minute per source IP and images under 4 MB. Free AI quota exhaustion returns an error; manual entry remains available. Check [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) before changing models or account plan.
- Darkppuccin colors and a square product mark follow the [PLUNZ visual proposal](https://github.com/plu-nz/.github/pull/2). The UI is mobile first with bottom step navigation.

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

Check `/api/healthz`, the app, a real scan, an uneven split, and mobile/keyboard behavior after deployment. No OAuth or secret is required. See the [source index](src/README.md) and [public assets index](public/README.md).
