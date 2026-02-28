# Protected Assets Control Plane

This document defines the D1 and Worker contracts expected by the assets manifest tooling (`dex assets ...`).

## Tables

```sql
CREATE TABLE IF NOT EXISTS asset_lookup (
  lookup_number TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  season TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_file (
  lookup_number TEXT NOT NULL,
  file_id TEXT NOT NULL,
  bucket_number TEXT NOT NULL,
  bucket TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  drive_file_id TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mime TEXT,
  position INTEGER NOT NULL,
  storage_bucket TEXT NOT NULL,
  PRIMARY KEY (lookup_number, bucket_number),
  UNIQUE (file_id),
  UNIQUE (r2_key)
);

CREATE TABLE IF NOT EXISTS asset_entitlement (
  lookup_number TEXT NOT NULL,
  entitlement_type TEXT NOT NULL,
  entitlement_value TEXT NOT NULL,
  PRIMARY KEY (lookup_number, entitlement_type, entitlement_value)
);

CREATE TABLE IF NOT EXISTS bundle_job (
  job_id TEXT PRIMARY KEY,
  lookup_number TEXT NOT NULL,
  user_sub TEXT NOT NULL,
  status TEXT NOT NULL,
  zip_key TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Admin endpoints

- `POST /admin/assets/publish`
  - Bearer token required (`DEX_ASSETS_ADMIN_TOKEN_*`)
  - Request payload from `buildProtectedAssetsPayload(...)` plus `manifestHash`.
  - Must perform idempotent upsert into `asset_lookup`, `asset_file`, `asset_entitlement`.

- `GET /admin/assets/state`
  - Bearer token required.
  - Returns current rows and `manifestHash` for CLI diff.

- `POST /admin/assets/bucket/ensure`
  - Bearer token required.
  - Body: `{ bucket: string, dryRun?: boolean }`.

## User endpoints

- `GET /me/assets/:lookup`
  - Returns lookup metadata and entitled file list.

- `POST /me/assets/:lookup/bundle`
  - Entitlement gated.
  - Hybrid behavior:
    - sync zip when `total_size <= 200MB` and `file_count <= 25`
    - async otherwise (`bundle_job` + signed URL on completion)

- `GET /me/assets/bundle/:jobId`
  - Returns async zip status and signed URL when ready.

## Security constraints

- Frontend must request by lookup/bucket number only.
- Do not expose raw Drive IDs or private R2 keys in public HTML/runtime payloads.
- Entitlement checks must happen server-side before file metadata or bundle URLs are returned.
