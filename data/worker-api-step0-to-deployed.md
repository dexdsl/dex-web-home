# Dex Worker API: Step 0 to Deployed

This is the exact deployment sequence for the external billing/auth API used by `https://dexdsl.github.io`.

## 0. Create repo and local project

```bash
mkdir -p ~/dex-api-worker
cd ~/dex-api-worker
npm init -y
npm i stripe jose
npm i -D wrangler typescript @cloudflare/workers-types
npx wrangler login
npx wrangler init --yes --name dex-api
```

## 1. `wrangler.toml`

Create `wrangler.toml`:

```toml
name = "dex-api"
main = "src/index.ts"
compatibility_date = "2026-02-24"

[vars]
ALLOWED_ORIGINS = "https://dexdsl.github.io,https://dexdsl.org,https://dexdsl.com,http://localhost:4173,http://127.0.0.1:4173"
AUTH0_ISSUER_BASE_URL = "https://dexdsl.us.auth0.com/"
AUTH0_AUDIENCE = "https://dex-api.spring-fog-8edd.workers.dev"
STRIPE_PORTAL_CONFIGURATION_ID = ""
APP_ORIGIN = "https://dexdsl.github.io"

[[d1_databases]]
binding = "DB"
database_name = "dex_api"
database_id = "REPLACE_WITH_D1_DATABASE_ID"
```

Create D1 database and paste the returned `database_id`:

```bash
npx wrangler d1 create dex_api
```

## 2. Create D1 schema

Create `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS user_customers (
  user_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS billing_state (
  user_id TEXT PRIMARY KEY,
  status TEXT,
  tier TEXT,
  interval TEXT,
  cancel_at_period_end INTEGER,
  current_period_end INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  correlation_id TEXT,
  meta_json TEXT,
  created_at INTEGER NOT NULL
);
```

Apply it:

```bash
npx wrangler d1 execute dex_api --remote --file=./schema.sql
```

## 3. Set secrets

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

## 4. Add Stripe allowlist (server authority)

Create `src/price-map.ts`:

```ts
export type Tier = "S" | "M" | "L";
export type Interval = "month" | "year";

export const PRICE_MAP = {
  production: {
    S: { month: "price_1RztZWEWJa7mnRxXQbmLC8uc", year: "price_1Rzta2EWJa7mnRxXJeQRKyB0" },
    M: { month: "price_1RztbJEWJa7mnRxXtTee6D7X", year: "price_1RztblEWJa7mnRxXHEOvGdgf" },
    L: { month: "price_1RztcMEWJa7mnRxXTls9nCfK", year: "price_1Rztd4EWJa7mnRxXj0SHFLe7" }
  },
  test: {
    S: { month: "price_1RzvosEWJa7mnRxX7tJcu6oF", year: "price_1Rzvp7EWJa7mnRxXX8cFvjmw" },
    M: { month: "price_1RzvpMEWJa7mnRxXSl5ylJD3", year: "price_1RzvpaEWJa7mnRxXIOtSWmob" },
    L: { month: "price_1RzvpmEWJa7mnRxXspyX1UDD", year: "price_1RzvpwEWJa7mnRxXlfZmrh6i" }
  }
} as const;
```

## 5. Implement required endpoints

Implement these routes in `src/index.ts`:

- `GET /me/billing/plans`
- `GET /me/billing/summary`
- `POST /me/billing/checkout-session`
- `POST /me/billing/portal-session`
- `POST /me/billing/subscription/pause`
- `POST /me/billing/subscription/resume`
- `POST /webhooks/stripe`

Required aliases:

- `GET /prices` -> plans
- `GET /me/subscription` -> summary
- `POST /stripe/create-checkout-session` -> checkout-session

Security requirements:

- Verify JWT (`iss`, `aud`, `exp`, signature) using Auth0 JWKS.
- Resolve `priceId` from `tier + interval` on server only.
- Validate `returnPath` against an allowlist (relative paths only).
- Verify Stripe webhook signature.
- Dedupe webhooks on `event.id` in `webhook_events`.
- Add idempotency keys for checkout/portal mutations.

## 6. CORS (must include preflight + normal responses)

For allowed origins only, always include:

- `Access-Control-Allow-Origin: <origin>`
- `Vary: Origin`
- `Access-Control-Allow-Methods: GET,POST,PATCH,PUT,DELETE,OPTIONS`
- `Access-Control-Allow-Headers: Authorization,Content-Type`

Return `204` for valid `OPTIONS`.

## 7. Deploy

```bash
npx wrangler deploy
```

If you use environments:

```bash
npx wrangler deploy --env production
```

## 8. Auth0 API setup (required before audience is enabled in web app)

In Auth0 Dashboard:

1. Applications -> APIs -> Create API
2. Identifier: `https://dex-api.spring-fog-8edd.workers.dev`
3. Signing Algorithm: `RS256`
4. Authorize your SPA app (`M92hIItt3XQPUvGvK0t2xDtLMCK1mVqc`) for this API
5. Add callback/logout/web origins for:
   - `https://dexdsl.github.io`
   - `https://dexdsl.org`
   - `https://dexdsl.com`

## 9. Verification commands

```bash
curl -i -X OPTIONS "https://dex-api.spring-fog-8edd.workers.dev/me/billing/plans" \
  -H "Origin: https://dexdsl.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type"

curl -i "https://dex-api.spring-fog-8edd.workers.dev/me/billing/plans" \
  -H "Origin: https://dexdsl.github.io"
```

Expected:

- CORS headers present.
- `GET /me/billing/plans` returns JSON.
- No browser CORS errors on `/entry/settings`.
