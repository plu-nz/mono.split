# Workflows

[ci.yml](ci.yml) runs Split's tests and build through the [shared pnpm CI workflow](https://github.com/plu-nz/ops.workflows). After those checks pass, pushes to `main` and manual runs on `main` deploy the Worker using the shared Cloudflare workflow and check the production health endpoint. Pull requests run checks without deploying.

The repository needs a `CLOUDFLARE_API_TOKEN` Actions secret with permission to deploy Workers to the PLUNZ Cloudflare account and manage its route. The shared workflow uses the `production` environment; configure any desired protection rules there. Both reusable workflow references are pinned to a reviewed commit; update them deliberately after validating a new shared version.

See the [GitHub configuration index](../README.md).
