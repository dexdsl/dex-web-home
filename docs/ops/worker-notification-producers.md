# Worker Notification Producers

This repo now emits Worker notification events to `dex-api` hooks using `EVENT_INGEST_TOKEN`.

## Required env vars

- `DEX_EVENT_INGEST_TOKEN` (or env-specific `DEX_EVENT_INGEST_TOKEN_PROD` / `_TEST`)
- `DEX_API_BASE_URL` or `DEX_EVENT_HOOK_API_BASE_PROD` / `_TEST`
- Optional strict mode: `DEX_EVENT_HOOKS_STRICT=1`

## Wired producers

1. Poll lifecycle publish job
- Source: `scripts/lib/polls-publish.mjs`
- Hook: `POST /hooks/polls/lifecycle`
- Trigger: `dex polls publish ...` / Polls TUI publish actions

2. Status incident flow (`dex status`)
- Source: `scripts/ui/status-manager.mjs`
- Hook: `POST /hooks/status/incident`
- Trigger: incident create and resolve actions in status manager

3. Dex Notes publish pipeline
- Source: `scripts/build_dexnotes_data.mjs`
- Hook: `POST /hooks/announcements/publish`
- Trigger: build pipeline emits announcement/release events from recent tagged entries
- Optional:
  - `DEX_ANNOUNCEMENT_HOOK_LOOKBACK_DAYS` (default `14`)
  - `DEX_ANNOUNCEMENT_HOOK_ALL=1` to emit for all matching entries

4. Achievements milestone job caller
- Source: `scripts/emit-achievement-milestone.mjs`
- Hook: `POST /hooks/achievements/milestone`
- Example:
```bash
node scripts/emit-achievement-milestone.mjs \
  --env prod \
  --sub auth0|123 \
  --badgeId vote-master \
  --badge "Vote Master" \
  --level gold
```

5. Auth0 Post-Login Action template
- Source: `scripts/templates/auth0-post-login-security-action.js`
- Hook: `POST /hooks/security/auth0`
- In Auth0 Action secrets set:
  - `DEX_EVENT_HOOK_BASE`
  - `DEX_EVENT_INGEST_TOKEN`

## Stripe webhook

`/webhooks/stripe` is wired in `dex-api` Worker and emits billing notifications there directly.

