# dex CLI

## Quick start

1. `npm i`
2. Run locally: `node scripts/dex.mjs init`
3. Or via npm script: `npm run dex -- init`
4. Optional global linking during development:
   - `npm link`
   - `dex init`

`dex init` uses `./index.html` in your current folder by default. If needed, pass `--template <path>`.

## Portable runtime links

- Generated `entries/<slug>/index.html` runtime scripts are absolute by default and point at `https://dexdsl.github.io`.
- Override the runtime origin for local dev with `DEX_ASSET_ORIGIN`, for example:
  - `DEX_ASSET_ORIGIN=http://localhost:8080 node scripts/dex.mjs init --quick --template ./entry-template/index.html --out ./entries`
- Manual check: open `entries/<slug>/index.html` and verify DevTools has no `ERR_FILE_NOT_FOUND` for `dex-auth` or `dex-sidebar`.
