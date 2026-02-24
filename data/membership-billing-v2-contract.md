# Dex Membership Billing v2 Backend Contract (Workers Handoff)

This repo is frontend/static only. Implement the backend routes in the external Workers API and keep this contract stable.

## Required Environment
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PORTAL_CONFIGURATION_ID`
- `AUTH0_ISSUER_BASE_URL`
- `AUTH0_AUDIENCE` (must match frontend audience)
- `ALLOWED_ORIGINS` (include `https://dexdsl.github.io`, `https://dexdsl.org`, `https://dexdsl.com`)

## Required Endpoints
- `GET /me/billing/plans`
- `GET /me/billing/summary`
- `POST /me/billing/checkout-session`
- `POST /me/billing/portal-session`
- `POST /me/billing/subscription/pause`
- `POST /me/billing/subscription/resume`
- `POST /webhooks/stripe`

## Compatibility Aliases (temporary)
- `GET /prices` -> `GET /me/billing/plans`
- `GET /me/subscription` -> `GET /me/billing/summary`
- `POST /stripe/create-checkout-session` -> `POST /me/billing/checkout-session`
- `GET /me/invoices` retained for current preview card

## Stripe Catalog Mapping Source
- `/Users/seb/dexdsl.github.io/data/stripe-membership-products.json`

Current file contains product IDs, recurring `priceId` values, and target amounts for `S/M/L x month/year` in production + test.
Backend should load this map as immutable allowlist config by environment.

## Security Requirements
- Verify JWT (`iss`, `aud`, `exp`, key rotation)
- Verify Stripe webhook signatures
- Dedupe webhook events on `event.id`
- Enforce idempotency keys on mutation endpoints
- Never accept client-supplied `priceId`; resolve by allowlisted `tier + interval`
- Validate return path against allowlist before constructing absolute URLs
