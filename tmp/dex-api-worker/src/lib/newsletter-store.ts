import type { WorkerEnv } from "../types/env";

const DEFAULT_CONFIRM_TTL_SECONDS = 3 * 24 * 60 * 60;
const DEFAULT_UNSUB_TTL_SECONDS = 365 * 24 * 60 * 60;

export type NewsletterSubscriberState =
  | "pending_confirmation"
  | "active"
  | "unsubscribed"
  | "suppressed";

export type NewsletterCampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed";

export type NewsletterDeliveryStatus =
  | "queued"
  | "sent"
  | "failed"
  | "delivered"
  | "bounced"
  | "complained"
  | "opened"
  | "clicked";

export type NewsletterTokenPurpose = "confirm" | "unsubscribe";

export type NewsletterSubscriberRecord = {
  id: string;
  email: string;
  auth0Sub: string;
  state: NewsletterSubscriberState;
  newsletterEnabled: boolean;
  digestEnabled: boolean;
  timezone: string;
  tags: string[];
  source: string;
  consentEvidence: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string;
  unsubscribedAt: string;
  suppressedAt: string;
};

export type NewsletterCampaignRecord = {
  id: string;
  name: string;
  templateKey: string;
  subject: string;
  preheader: string;
  audienceSegment: string;
  variables: Record<string, unknown>;
  html: string;
  text: string;
  status: NewsletterCampaignStatus;
  scheduledAt: string;
  sentAt: string;
  recipientSnapshot: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type NewsletterCampaignStats = {
  campaignId: string;
  queued: number;
  sent: number;
  failed: number;
  delivered: number;
  bounced: number;
  complaints: number;
  opens: number;
  clicks: number;
  updatedAt: string;
};

type SubscriberRow = {
  id: string;
  email: string;
  auth0_sub: string | null;
  state: string;
  newsletter_enabled: number | null;
  digest_enabled: number | null;
  timezone: string | null;
  tags_json: string | null;
  source: string | null;
  consent_evidence_json: string | null;
  created_at: number;
  updated_at: number;
  confirmed_at: number | null;
  unsubscribed_at: number | null;
  suppressed_at: number | null;
};

type TokenRow = {
  id: string;
  subscriber_id: string;
  campaign_id: string | null;
  purpose: string;
  token_hash: string;
  expires_at: number;
  used_at: number | null;
};

type CampaignRow = {
  id: string;
  name: string;
  template_key: string;
  subject: string;
  preheader: string | null;
  audience_segment: string;
  variables_json: string | null;
  html: string;
  text: string;
  status: string;
  scheduled_at: number | null;
  sent_at: number | null;
  recipient_snapshot_json: string | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
};

type CampaignStatsRow = {
  campaign_id: string;
  queued_count: number | string | null;
  sent_count: number | string | null;
  failed_count: number | string | null;
  delivered_count: number | string | null;
  bounced_count: number | string | null;
  complaint_count: number | string | null;
  open_count: number | string | null;
  click_count: number | string | null;
  updated_at: number | string | null;
};

type WebhookEventRow = {
  provider_event_id: string;
};

type RateLimitRow = {
  key: string;
  count: number | string | null;
  window_start: number | string | null;
};

type DeliveryStatusCountRow = {
  status: string;
  count: number | string | null;
};

type PublicIdempotencyRow = {
  key: string;
  source: string | null;
  email: string | null;
  state: string | null;
  status_code: number | string | null;
  created_at: number | string | null;
  updated_at: number | string | null;
};

type DeliveryByProviderRow = {
  campaign_id: string;
  subscriber_id: string;
  id: string;
};

function toUnix(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.floor(num);
}

function toIso(unixSeconds: number | null): string {
  if (unixSeconds === null || !Number.isFinite(unixSeconds)) return "";
  return new Date(unixSeconds * 1000).toISOString();
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => normalizeTag(item))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeState(value: unknown): NewsletterSubscriberState {
  const state = String(value || "").trim().toLowerCase();
  if (
    state === "pending_confirmation" ||
    state === "active" ||
    state === "unsubscribed" ||
    state === "suppressed"
  ) {
    return state;
  }
  return "pending_confirmation";
}

function normalizeCampaignStatus(value: unknown): NewsletterCampaignStatus {
  const status = String(value || "").trim().toLowerCase();
  if (
    status === "draft" ||
    status === "scheduled" ||
    status === "sending" ||
    status === "sent" ||
    status === "failed"
  ) {
    return status;
  }
  return "draft";
}

function normalizeDeliveryStatus(value: unknown): NewsletterDeliveryStatus {
  const status = String(value || "").trim().toLowerCase();
  if (
    status === "queued" ||
    status === "sent" ||
    status === "failed" ||
    status === "delivered" ||
    status === "bounced" ||
    status === "complained" ||
    status === "opened" ||
    status === "clicked"
  ) {
    return status;
  }
  return "queued";
}

export function normalizeEmail(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized;
}

export function normalizeTimezone(value: unknown): string {
  const timezone = String(value ?? "").trim();
  if (!timezone) return "UTC";
  return timezone.slice(0, 120);
}

export function normalizeTag(value: unknown): string {
  const tag = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!tag) return "";
  return tag.slice(0, 48);
}

export function normalizeTagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = value.map((item) => normalizeTag(item)).filter(Boolean);
  return Array.from(new Set(out)).slice(0, 24);
}

function normalizeTokenPurpose(value: unknown): NewsletterTokenPurpose {
  const purpose = String(value || "").trim().toLowerCase();
  if (purpose === "unsubscribe") return "unsubscribe";
  return "confirm";
}

function textToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return textToHex(digest);
}

export async function hashNewsletterAddress(value: string): Promise<string> {
  const normalized = normalizeEmail(value);
  if (!normalized) return "";
  return sha256Hex(normalized);
}

function randomToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID().replace(/-/g, "")}`;
}

function subscriberRowToRecord(row: SubscriberRow): NewsletterSubscriberRecord {
  return {
    id: row.id,
    email: normalizeEmail(row.email),
    auth0Sub: String(row.auth0_sub || "").trim(),
    state: normalizeState(row.state),
    newsletterEnabled: Number(row.newsletter_enabled || 0) === 1,
    digestEnabled: Number(row.digest_enabled || 0) === 1,
    timezone: normalizeTimezone(row.timezone),
    tags: parseJsonArray(row.tags_json),
    source: String(row.source || "").trim(),
    consentEvidence: parseJsonObject(row.consent_evidence_json),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    confirmedAt: toIso(row.confirmed_at),
    unsubscribedAt: toIso(row.unsubscribed_at),
    suppressedAt: toIso(row.suppressed_at),
  };
}

function campaignRowToRecord(row: CampaignRow): NewsletterCampaignRecord {
  return {
    id: row.id,
    name: String(row.name || "").trim(),
    templateKey: String(row.template_key || "").trim(),
    subject: String(row.subject || "").trim(),
    preheader: String(row.preheader || "").trim(),
    audienceSegment: String(row.audience_segment || "all_subscribers").trim(),
    variables: parseJsonObject(row.variables_json),
    html: String(row.html || ""),
    text: String(row.text || ""),
    status: normalizeCampaignStatus(row.status),
    scheduledAt: toIso(row.scheduled_at),
    sentAt: toIso(row.sent_at),
    recipientSnapshot: parseJsonObject(row.recipient_snapshot_json),
    createdBy: String(row.created_by || "").trim(),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function statsRowToRecord(row: CampaignStatsRow): NewsletterCampaignStats {
  return {
    campaignId: String(row.campaign_id || "").trim(),
    queued: Math.max(0, toNumber(row.queued_count)),
    sent: Math.max(0, toNumber(row.sent_count)),
    failed: Math.max(0, toNumber(row.failed_count)),
    delivered: Math.max(0, toNumber(row.delivered_count)),
    bounced: Math.max(0, toNumber(row.bounced_count)),
    complaints: Math.max(0, toNumber(row.complaint_count)),
    opens: Math.max(0, toNumber(row.open_count)),
    clicks: Math.max(0, toNumber(row.click_count)),
    updatedAt: toIso(toUnix(row.updated_at)),
  };
}

export async function ensureNewsletterTables(env: WorkerEnv): Promise<void> {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      auth0_sub TEXT,
      state TEXT NOT NULL,
      newsletter_enabled INTEGER NOT NULL DEFAULT 1,
      digest_enabled INTEGER NOT NULL DEFAULT 0,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      tags_json TEXT NOT NULL DEFAULT '[]',
      source TEXT,
      consent_evidence_json TEXT NOT NULL DEFAULT '{}',
      confirmed_at INTEGER,
      unsubscribed_at INTEGER,
      suppressed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `).run();

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_state ON newsletter_subscribers(state, newsletter_enabled)",
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_auth0_sub ON newsletter_subscribers(auth0_sub)",
  ).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_subscriber_tags (
      subscriber_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (subscriber_id, tag)
    );
  `).run();

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_newsletter_subscriber_tags_tag ON newsletter_subscriber_tags(tag)",
  ).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_confirm_tokens (
      id TEXT PRIMARY KEY,
      subscriber_id TEXT NOT NULL,
      campaign_id TEXT,
      purpose TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `).run();

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_newsletter_confirm_tokens_lookup ON newsletter_confirm_tokens(token_hash, purpose, used_at, expires_at)",
  ).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      template_key TEXT NOT NULL,
      subject TEXT NOT NULL,
      preheader TEXT,
      audience_segment TEXT NOT NULL,
      variables_json TEXT NOT NULL DEFAULT '{}',
      html TEXT NOT NULL,
      text TEXT NOT NULL,
      status TEXT NOT NULL,
      scheduled_at INTEGER,
      sent_at INTEGER,
      recipient_snapshot_json TEXT NOT NULL DEFAULT '{}',
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `).run();

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_status_schedule ON newsletter_campaigns(status, scheduled_at)",
  ).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_campaign_deliveries (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      subscriber_id TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      provider_message_id TEXT,
      error TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      sent_at INTEGER,
      delivered_at INTEGER,
      bounced_at INTEGER,
      complained_at INTEGER,
      opened_at INTEGER,
      clicked_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (campaign_id, email)
    );
  `).run();

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_campaign_status ON newsletter_campaign_deliveries(campaign_id, status)",
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_provider_msg ON newsletter_campaign_deliveries(provider_message_id)",
  ).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_campaign_stats (
      campaign_id TEXT PRIMARY KEY,
      queued_count INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      delivered_count INTEGER NOT NULL DEFAULT 0,
      bounced_count INTEGER NOT NULL DEFAULT 0,
      complaint_count INTEGER NOT NULL DEFAULT 0,
      open_count INTEGER NOT NULL DEFAULT 0,
      click_count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_webhook_events (
      provider_event_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      event_type TEXT,
      payload_json TEXT NOT NULL,
      received_at INTEGER NOT NULL
    );
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_public_rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      window_start INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_public_rate_events (
      key TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `).run();

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_newsletter_public_rate_events_key_created ON newsletter_public_rate_events(key, created_at)",
  ).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS newsletter_public_idempotency (
      key TEXT PRIMARY KEY,
      source TEXT,
      email TEXT,
      state TEXT,
      status_code INTEGER NOT NULL DEFAULT 200,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `).run();

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_newsletter_public_idempotency_updated ON newsletter_public_idempotency(updated_at)",
  ).run();
}

export async function getSubscriberByEmail(
  env: WorkerEnv,
  email: string,
): Promise<NewsletterSubscriberRecord | null> {
  await ensureNewsletterTables(env);
  const row = await env.DB.prepare(
    `SELECT
      id, email, auth0_sub, state, newsletter_enabled, digest_enabled, timezone,
      tags_json, source, consent_evidence_json, created_at, updated_at, confirmed_at,
      unsubscribed_at, suppressed_at
     FROM newsletter_subscribers
     WHERE email = ?
     LIMIT 1`,
  )
    .bind(normalizeEmail(email))
    .first<SubscriberRow>();
  return row ? subscriberRowToRecord(row) : null;
}

export async function getSubscriberById(
  env: WorkerEnv,
  subscriberId: string,
): Promise<NewsletterSubscriberRecord | null> {
  await ensureNewsletterTables(env);
  const row = await env.DB.prepare(
    `SELECT
      id, email, auth0_sub, state, newsletter_enabled, digest_enabled, timezone,
      tags_json, source, consent_evidence_json, created_at, updated_at, confirmed_at,
      unsubscribed_at, suppressed_at
     FROM newsletter_subscribers
     WHERE id = ?
     LIMIT 1`,
  )
    .bind(subscriberId)
    .first<SubscriberRow>();
  return row ? subscriberRowToRecord(row) : null;
}

async function replaceSubscriberTags(
  env: WorkerEnv,
  subscriberId: string,
  tags: string[],
  nowUnix: number,
): Promise<void> {
  await env.DB.prepare(
    "DELETE FROM newsletter_subscriber_tags WHERE subscriber_id = ?",
  )
    .bind(subscriberId)
    .run();

  for (const tag of tags) {
    await env.DB.prepare(
      "INSERT INTO newsletter_subscriber_tags (subscriber_id, tag, created_at) VALUES (?, ?, ?)",
    )
      .bind(subscriberId, tag, nowUnix)
      .run();
  }
}

export async function upsertSubscriberPendingConfirmation(
  env: WorkerEnv,
  input: {
    email: string;
    auth0Sub?: string;
    timezone?: string;
    tags?: string[];
    source?: string;
    consentEvidence?: Record<string, unknown>;
  },
): Promise<{ subscriber: NewsletterSubscriberRecord; requiresConfirmation: boolean }> {
  await ensureNewsletterTables(env);
  const nowUnix = Math.floor(Date.now() / 1000);
  const email = normalizeEmail(input.email);
  const auth0Sub = String(input.auth0Sub || "").trim();
  const timezone = normalizeTimezone(input.timezone);
  const tags = normalizeTagList(input.tags || []);
  const source = String(input.source || "").trim().slice(0, 120);
  const consentEvidence =
    input.consentEvidence && typeof input.consentEvidence === "object"
      ? input.consentEvidence
      : {};

  const existing = await getSubscriberByEmail(env, email);
  if (!existing) {
    const subscriberId = `sub_${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO newsletter_subscribers (
        id, email, auth0_sub, state, newsletter_enabled, digest_enabled,
        timezone, tags_json, source, consent_evidence_json,
        confirmed_at, unsubscribed_at, suppressed_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'pending_confirmation', 1, 0, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
    )
      .bind(
        subscriberId,
        email,
        auth0Sub || null,
        timezone,
        JSON.stringify(tags),
        source || null,
        JSON.stringify(consentEvidence),
        nowUnix,
        nowUnix,
      )
      .run();
    await replaceSubscriberTags(env, subscriberId, tags, nowUnix);
    const fresh = await getSubscriberById(env, subscriberId);
    if (!fresh) {
      throw new Error("Failed to create subscriber");
    }
    return { subscriber: fresh, requiresConfirmation: true };
  }

  if (existing.state === "suppressed") {
    return { subscriber: existing, requiresConfirmation: false };
  }

  const nextState = existing.state === "active" ? "active" : "pending_confirmation";
  const requiresConfirmation = nextState !== "active";

  await env.DB.prepare(
    `UPDATE newsletter_subscribers
     SET auth0_sub = COALESCE(?, auth0_sub),
         state = ?,
         newsletter_enabled = 1,
         timezone = ?,
         tags_json = ?,
         source = COALESCE(?, source),
         consent_evidence_json = ?,
         unsubscribed_at = CASE WHEN ? = 'active' THEN unsubscribed_at ELSE NULL END,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      auth0Sub || null,
      nextState,
      timezone,
      JSON.stringify(tags),
      source || null,
      JSON.stringify({ ...existing.consentEvidence, ...consentEvidence }),
      nextState,
      nowUnix,
      existing.id,
    )
    .run();

  await replaceSubscriberTags(env, existing.id, tags, nowUnix);

  const fresh = await getSubscriberById(env, existing.id);
  if (!fresh) throw new Error("Failed to load subscriber");
  return { subscriber: fresh, requiresConfirmation };
}

export async function activateSubscriber(
  env: WorkerEnv,
  subscriberId: string,
): Promise<NewsletterSubscriberRecord | null> {
  await ensureNewsletterTables(env);
  const nowUnix = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE newsletter_subscribers
     SET state = 'active',
         newsletter_enabled = 1,
         confirmed_at = COALESCE(confirmed_at, ?),
         unsubscribed_at = NULL,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(nowUnix, nowUnix, subscriberId)
    .run();
  return getSubscriberById(env, subscriberId);
}

export async function unsubscribeSubscriber(
  env: WorkerEnv,
  subscriberId: string,
): Promise<NewsletterSubscriberRecord | null> {
  await ensureNewsletterTables(env);
  const nowUnix = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE newsletter_subscribers
     SET state = 'unsubscribed',
         newsletter_enabled = 0,
         unsubscribed_at = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(nowUnix, nowUnix, subscriberId)
    .run();
  return getSubscriberById(env, subscriberId);
}

export async function suppressSubscriberByEmail(
  env: WorkerEnv,
  email: string,
): Promise<NewsletterSubscriberRecord | null> {
  await ensureNewsletterTables(env);
  const nowUnix = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE newsletter_subscribers
     SET state = 'suppressed',
         newsletter_enabled = 0,
         suppressed_at = ?,
         updated_at = ?
     WHERE email = ?`,
  )
    .bind(nowUnix, nowUnix, normalizeEmail(email))
    .run();
  return getSubscriberByEmail(env, email);
}

export async function issueNewsletterToken(
  env: WorkerEnv,
  input: {
    subscriberId: string;
    purpose: NewsletterTokenPurpose;
    campaignId?: string;
    ttlSeconds?: number;
  },
): Promise<{ token: string; expiresAtUnix: number }> {
  await ensureNewsletterTables(env);
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const nowUnix = Math.floor(Date.now() / 1000);
  const ttlSeconds = Math.max(
    60,
    Math.floor(
      input.ttlSeconds ??
        (input.purpose === "unsubscribe"
          ? DEFAULT_UNSUB_TTL_SECONDS
          : DEFAULT_CONFIRM_TTL_SECONDS),
    ),
  );
  const expiresAtUnix = nowUnix + ttlSeconds;
  await env.DB.prepare(
    `INSERT INTO newsletter_confirm_tokens (
      id, subscriber_id, campaign_id, purpose, token_hash, expires_at, used_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
  )
    .bind(
      `tok_${crypto.randomUUID()}`,
      input.subscriberId,
      input.campaignId || null,
      input.purpose,
      tokenHash,
      expiresAtUnix,
      nowUnix,
    )
    .run();
  return { token, expiresAtUnix };
}

export async function consumeNewsletterToken(
  env: WorkerEnv,
  input: {
    token: string;
    purpose: NewsletterTokenPurpose;
  },
): Promise<{ subscriberId: string; campaignId: string | null } | null> {
  await ensureNewsletterTables(env);
  const tokenHash = await sha256Hex(input.token);
  const nowUnix = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT id, subscriber_id, campaign_id, purpose, token_hash, expires_at, used_at
     FROM newsletter_confirm_tokens
     WHERE token_hash = ?
       AND purpose = ?
       AND used_at IS NULL
       AND expires_at > ?
     LIMIT 1`,
  )
    .bind(tokenHash, normalizeTokenPurpose(input.purpose), nowUnix)
    .first<TokenRow>();

  if (!row) return null;

  await env.DB.prepare(
    "UPDATE newsletter_confirm_tokens SET used_at = ? WHERE id = ?",
  )
    .bind(nowUnix, row.id)
    .run();

  return {
    subscriberId: row.subscriber_id,
    campaignId: row.campaign_id,
  };
}

export async function resolveNewsletterTokenSubscriber(
  env: WorkerEnv,
  input: {
    token: string;
  },
): Promise<{ subscriberId: string; campaignId: string | null } | null> {
  await ensureNewsletterTables(env);
  const tokenHash = await sha256Hex(input.token);
  const nowUnix = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT subscriber_id, campaign_id
     FROM newsletter_confirm_tokens
     WHERE token_hash = ?
       AND expires_at > ?
     ORDER BY created_at DESC
     LIMIT 1`,
  )
    .bind(tokenHash, nowUnix)
    .first<{ subscriber_id: string; campaign_id: string | null }>();

  if (!row) return null;
  return {
    subscriberId: row.subscriber_id,
    campaignId: row.campaign_id,
  };
}

export async function listActiveNewsletterSubscribers(
  env: WorkerEnv,
): Promise<NewsletterSubscriberRecord[]> {
  await ensureNewsletterTables(env);
  const rows = await env.DB.prepare(
    `SELECT
      id, email, auth0_sub, state, newsletter_enabled, digest_enabled, timezone,
      tags_json, source, consent_evidence_json, created_at, updated_at, confirmed_at,
      unsubscribed_at, suppressed_at
     FROM newsletter_subscribers
     WHERE state = 'active'
       AND newsletter_enabled = 1
       AND suppressed_at IS NULL`,
  ).all<SubscriberRow>();

  return (rows.results || []).map((row) => subscriberRowToRecord(row));
}

export async function createCampaign(
  env: WorkerEnv,
  input: {
    name: string;
    templateKey: string;
    subject: string;
    preheader?: string;
    audienceSegment: string;
    variables?: Record<string, unknown>;
    html: string;
    text: string;
    createdBy?: string;
  },
): Promise<NewsletterCampaignRecord> {
  await ensureNewsletterTables(env);
  const nowUnix = Math.floor(Date.now() / 1000);
  const id = `cmp_${crypto.randomUUID()}`;
  await env.DB.prepare(
    `INSERT INTO newsletter_campaigns (
      id, name, template_key, subject, preheader, audience_segment,
      variables_json, html, text, status, scheduled_at, sent_at,
      recipient_snapshot_json, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, NULL, '{}', ?, ?, ?)`,
  )
    .bind(
      id,
      input.name,
      input.templateKey,
      input.subject,
      input.preheader || null,
      input.audienceSegment,
      JSON.stringify(input.variables || {}),
      input.html,
      input.text,
      input.createdBy || null,
      nowUnix,
      nowUnix,
    )
    .run();

  const row = await env.DB.prepare(
    `SELECT
      id, name, template_key, subject, preheader, audience_segment,
      variables_json, html, text, status, scheduled_at, sent_at,
      recipient_snapshot_json, created_by, created_at, updated_at
     FROM newsletter_campaigns
     WHERE id = ?
     LIMIT 1`,
  )
    .bind(id)
    .first<CampaignRow>();

  if (!row) throw new Error("Campaign creation failed");
  return campaignRowToRecord(row);
}

export async function listCampaigns(
  env: WorkerEnv,
  limit = 100,
): Promise<NewsletterCampaignRecord[]> {
  await ensureNewsletterTables(env);
  const bounded = Math.max(1, Math.min(200, Math.floor(limit)));
  const rows = await env.DB.prepare(
    `SELECT
      id, name, template_key, subject, preheader, audience_segment,
      variables_json, html, text, status, scheduled_at, sent_at,
      recipient_snapshot_json, created_by, created_at, updated_at
     FROM newsletter_campaigns
     ORDER BY created_at DESC
     LIMIT ?`,
  )
    .bind(bounded)
    .all<CampaignRow>();

  return (rows.results || []).map((row) => campaignRowToRecord(row));
}

export async function getCampaignById(
  env: WorkerEnv,
  campaignId: string,
): Promise<NewsletterCampaignRecord | null> {
  await ensureNewsletterTables(env);
  const row = await env.DB.prepare(
    `SELECT
      id, name, template_key, subject, preheader, audience_segment,
      variables_json, html, text, status, scheduled_at, sent_at,
      recipient_snapshot_json, created_by, created_at, updated_at
     FROM newsletter_campaigns
     WHERE id = ?
     LIMIT 1`,
  )
    .bind(campaignId)
    .first<CampaignRow>();
  return row ? campaignRowToRecord(row) : null;
}

export async function patchCampaignDraft(
  env: WorkerEnv,
  campaignId: string,
  patch: {
    name?: string;
    templateKey?: string;
    subject?: string;
    preheader?: string;
    audienceSegment?: string;
    variables?: Record<string, unknown>;
    html?: string;
    text?: string;
  },
): Promise<NewsletterCampaignRecord | null> {
  await ensureNewsletterTables(env);
  const current = await getCampaignById(env, campaignId);
  if (!current) return null;
  if (current.status !== "draft") return null;

  const nowUnix = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE newsletter_campaigns
     SET name = ?,
         template_key = ?,
         subject = ?,
         preheader = ?,
         audience_segment = ?,
         variables_json = ?,
         html = ?,
         text = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      patch.name ?? current.name,
      patch.templateKey ?? current.templateKey,
      patch.subject ?? current.subject,
      patch.preheader ?? current.preheader,
      patch.audienceSegment ?? current.audienceSegment,
      JSON.stringify(patch.variables ?? current.variables),
      patch.html ?? current.html,
      patch.text ?? current.text,
      nowUnix,
      campaignId,
    )
    .run();

  return getCampaignById(env, campaignId);
}

export async function scheduleCampaign(
  env: WorkerEnv,
  campaignId: string,
  scheduledAtUnix: number,
): Promise<NewsletterCampaignRecord | null> {
  await ensureNewsletterTables(env);
  const nowUnix = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    `UPDATE newsletter_campaigns
     SET status = 'scheduled',
         scheduled_at = ?,
         updated_at = ?
     WHERE id = ?
       AND status IN ('draft', 'scheduled')`,
  )
    .bind(scheduledAtUnix, nowUnix, campaignId)
    .run();

  if (Number(result.meta.changes || 0) <= 0) return null;
  return getCampaignById(env, campaignId);
}

export async function markCampaignSnapshot(
  env: WorkerEnv,
  campaignId: string,
  input: {
    recipientCount: number;
    subscriberIds: string[];
    generatedAtUnix?: number;
  },
): Promise<void> {
  await ensureNewsletterTables(env);
  const generatedAtUnix = input.generatedAtUnix ?? Math.floor(Date.now() / 1000);
  const snapshot = {
    recipientCount: Math.max(0, Math.floor(input.recipientCount)),
    subscriberIds: input.subscriberIds,
    generatedAt: toIso(generatedAtUnix),
  };
  await env.DB.prepare(
    `UPDATE newsletter_campaigns
     SET recipient_snapshot_json = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(JSON.stringify(snapshot), generatedAtUnix, campaignId)
    .run();
}

export async function markCampaignStatus(
  env: WorkerEnv,
  campaignId: string,
  status: NewsletterCampaignStatus,
  input?: {
    sentAtUnix?: number;
  },
): Promise<void> {
  await ensureNewsletterTables(env);
  const nowUnix = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE newsletter_campaigns
     SET status = ?,
         sent_at = CASE
           WHEN ? = 'sent' THEN COALESCE(sent_at, ?)
           ELSE sent_at
         END,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(status, status, input?.sentAtUnix ?? nowUnix, nowUnix, campaignId)
    .run();
}

export async function claimDueCampaigns(
  env: WorkerEnv,
  nowUnix: number,
  limit = 4,
): Promise<string[]> {
  await ensureNewsletterTables(env);
  const rows = await env.DB.prepare(
    `SELECT id
     FROM newsletter_campaigns
     WHERE status = 'scheduled'
       AND scheduled_at IS NOT NULL
       AND scheduled_at <= ?
     ORDER BY scheduled_at ASC, created_at ASC
     LIMIT ?`,
  )
    .bind(nowUnix, Math.max(1, Math.min(20, Math.floor(limit))))
    .all<{ id: string }>();

  const claimed: string[] = [];
  for (const row of rows.results || []) {
    const result = await env.DB.prepare(
      `UPDATE newsletter_campaigns
       SET status = 'sending',
           updated_at = ?
       WHERE id = ?
         AND status = 'scheduled'`,
    )
      .bind(nowUnix, row.id)
      .run();
    if (Number(result.meta.changes || 0) > 0) {
      claimed.push(row.id);
    }
  }
  return claimed;
}

export async function enqueueCampaignDelivery(
  env: WorkerEnv,
  input: {
    campaignId: string;
    subscriberId: string;
    email: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ id: string; inserted: boolean }> {
  await ensureNewsletterTables(env);
  const id = `dlv_${crypto.randomUUID()}`;
  const nowUnix = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    `INSERT INTO newsletter_campaign_deliveries (
      id, campaign_id, subscriber_id, email, status, provider_message_id, error,
      metadata_json, sent_at, delivered_at, bounced_at, complained_at, opened_at,
      clicked_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'queued', NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)
    ON CONFLICT(campaign_id, email) DO NOTHING`,
  )
    .bind(
      id,
      input.campaignId,
      input.subscriberId,
      normalizeEmail(input.email),
      JSON.stringify(input.metadata || {}),
      nowUnix,
      nowUnix,
    )
    .run();

  return {
    id,
    inserted: Number(result.meta.changes || 0) > 0,
  };
}

export async function markDeliverySent(
  env: WorkerEnv,
  input: {
    campaignId: string;
    email: string;
    providerMessageId?: string;
  },
): Promise<void> {
  await ensureNewsletterTables(env);
  const nowUnix = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE newsletter_campaign_deliveries
     SET status = 'sent',
         provider_message_id = COALESCE(?, provider_message_id),
         sent_at = COALESCE(sent_at, ?),
         error = NULL,
         updated_at = ?
     WHERE campaign_id = ? AND email = ?`,
  )
    .bind(
      input.providerMessageId || null,
      nowUnix,
      nowUnix,
      input.campaignId,
      normalizeEmail(input.email),
    )
    .run();
}

export async function markDeliveryFailed(
  env: WorkerEnv,
  input: {
    campaignId: string;
    email: string;
    error?: string;
  },
): Promise<void> {
  await ensureNewsletterTables(env);
  const nowUnix = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE newsletter_campaign_deliveries
     SET status = 'failed',
         error = ?,
         updated_at = ?
     WHERE campaign_id = ? AND email = ?`,
  )
    .bind(
      String(input.error || "").trim().slice(0, 400) || "unknown_error",
      nowUnix,
      input.campaignId,
      normalizeEmail(input.email),
    )
    .run();
}

export async function getDeliveryStatsForCampaign(
  env: WorkerEnv,
  campaignId: string,
): Promise<NewsletterCampaignStats> {
  await ensureNewsletterTables(env);
  const rows = await env.DB.prepare(
    `SELECT status, COUNT(*) AS count
     FROM newsletter_campaign_deliveries
     WHERE campaign_id = ?
     GROUP BY status`,
  )
    .bind(campaignId)
    .all<DeliveryStatusCountRow>();

  let queued = 0;
  let sent = 0;
  let failed = 0;
  let delivered = 0;
  let bounced = 0;
  let complaints = 0;
  let opens = 0;
  let clicks = 0;

  for (const row of rows.results || []) {
    const count = Math.max(0, toNumber(row.count));
    const status = normalizeDeliveryStatus(row.status);
    if (status === "queued") queued += count;
    if (status === "failed") failed += count;
    if (status === "sent") sent += count;
    if (status === "delivered") {
      delivered += count;
      sent += count;
    }
    if (status === "bounced") {
      bounced += count;
      sent += count;
    }
    if (status === "complained") {
      complaints += count;
      sent += count;
    }
    if (status === "opened") {
      opens += count;
      delivered += count;
      sent += count;
    }
    if (status === "clicked") {
      clicks += count;
      opens += count;
      delivered += count;
      sent += count;
    }
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO newsletter_campaign_stats (
      campaign_id,
      queued_count,
      sent_count,
      failed_count,
      delivered_count,
      bounced_count,
      complaint_count,
      open_count,
      click_count,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaign_id) DO UPDATE SET
      queued_count = excluded.queued_count,
      sent_count = excluded.sent_count,
      failed_count = excluded.failed_count,
      delivered_count = excluded.delivered_count,
      bounced_count = excluded.bounced_count,
      complaint_count = excluded.complaint_count,
      open_count = excluded.open_count,
      click_count = excluded.click_count,
      updated_at = excluded.updated_at`,
  )
    .bind(
      campaignId,
      queued,
      sent,
      failed,
      delivered,
      bounced,
      complaints,
      opens,
      clicks,
      nowUnix,
    )
    .run();

  return {
    campaignId,
    queued,
    sent,
    failed,
    delivered,
    bounced,
    complaints,
    opens,
    clicks,
    updatedAt: toIso(nowUnix),
  };
}

export async function getStoredCampaignStats(
  env: WorkerEnv,
  campaignId: string,
): Promise<NewsletterCampaignStats | null> {
  await ensureNewsletterTables(env);
  const row = await env.DB.prepare(
    `SELECT
      campaign_id,
      queued_count,
      sent_count,
      failed_count,
      delivered_count,
      bounced_count,
      complaint_count,
      open_count,
      click_count,
      updated_at
     FROM newsletter_campaign_stats
     WHERE campaign_id = ?
     LIMIT 1`,
  )
    .bind(campaignId)
    .first<CampaignStatsRow>();

  return row ? statsRowToRecord(row) : null;
}

export async function countPendingCampaignDeliveries(
  env: WorkerEnv,
  campaignId: string,
): Promise<number> {
  await ensureNewsletterTables(env);
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM newsletter_campaign_deliveries
     WHERE campaign_id = ? AND status = 'queued'`,
  )
    .bind(campaignId)
    .first<{ count: number | string | null }>();
  return Math.max(0, toNumber(row?.count));
}

export async function markCampaignCompletedFromDeliveryState(
  env: WorkerEnv,
  campaignId: string,
): Promise<void> {
  const stats = await getDeliveryStatsForCampaign(env, campaignId);
  if (stats.queued > 0) return;
  if (stats.sent > 0) {
    await markCampaignStatus(env, campaignId, "sent", { sentAtUnix: Math.floor(Date.now() / 1000) });
    return;
  }
  await markCampaignStatus(env, campaignId, "failed");
}

export async function recordWebhookEventIfNew(
  env: WorkerEnv,
  input: {
    providerEventId: string;
    provider: string;
    eventType: string;
    payload: Record<string, unknown>;
  },
): Promise<boolean> {
  await ensureNewsletterTables(env);
  const nowUnix = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    `INSERT INTO newsletter_webhook_events (
      provider_event_id,
      provider,
      event_type,
      payload_json,
      received_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(provider_event_id) DO NOTHING`,
  )
    .bind(
      input.providerEventId,
      input.provider,
      input.eventType,
      JSON.stringify(input.payload),
      nowUnix,
    )
    .run();

  return Number(result.meta.changes || 0) > 0;
}

export async function applyWebhookDeliveryEvent(
  env: WorkerEnv,
  input: {
    providerMessageId: string;
    eventType: string;
  },
): Promise<{ campaignId: string } | null> {
  await ensureNewsletterTables(env);
  const row = await env.DB.prepare(
    `SELECT campaign_id, subscriber_id, id
     FROM newsletter_campaign_deliveries
     WHERE provider_message_id = ?
     LIMIT 1`,
  )
    .bind(input.providerMessageId)
    .first<DeliveryByProviderRow>();

  if (!row) return null;

  const nowUnix = Math.floor(Date.now() / 1000);
  const eventType = String(input.eventType || "").trim().toLowerCase();

  if (eventType === "delivered") {
    await env.DB.prepare(
      `UPDATE newsletter_campaign_deliveries
       SET status = CASE
             WHEN status IN ('bounced', 'complained') THEN status
             ELSE 'delivered'
           END,
           delivered_at = COALESCE(delivered_at, ?),
           updated_at = ?
       WHERE id = ?`,
    )
      .bind(nowUnix, nowUnix, row.id)
      .run();
  } else if (eventType === "opened") {
    await env.DB.prepare(
      `UPDATE newsletter_campaign_deliveries
       SET status = CASE
             WHEN status IN ('bounced', 'complained') THEN status
             ELSE 'opened'
           END,
           opened_at = COALESCE(opened_at, ?),
           delivered_at = COALESCE(delivered_at, ?),
           updated_at = ?
       WHERE id = ?`,
    )
      .bind(nowUnix, nowUnix, nowUnix, row.id)
      .run();
  } else if (eventType === "clicked") {
    await env.DB.prepare(
      `UPDATE newsletter_campaign_deliveries
       SET status = CASE
             WHEN status IN ('bounced', 'complained') THEN status
             ELSE 'clicked'
           END,
           clicked_at = COALESCE(clicked_at, ?),
           opened_at = COALESCE(opened_at, ?),
           delivered_at = COALESCE(delivered_at, ?),
           updated_at = ?
       WHERE id = ?`,
    )
      .bind(nowUnix, nowUnix, nowUnix, nowUnix, row.id)
      .run();
  } else if (eventType === "bounced") {
    await env.DB.prepare(
      `UPDATE newsletter_campaign_deliveries
       SET status = 'bounced',
           bounced_at = COALESCE(bounced_at, ?),
           updated_at = ?
       WHERE id = ?`,
    )
      .bind(nowUnix, nowUnix, row.id)
      .run();
  } else if (eventType === "complained") {
    await env.DB.prepare(
      `UPDATE newsletter_campaign_deliveries
       SET status = 'complained',
           complained_at = COALESCE(complained_at, ?),
           updated_at = ?
       WHERE id = ?`,
    )
      .bind(nowUnix, nowUnix, row.id)
      .run();
  }

  return { campaignId: row.campaign_id };
}

export async function enforcePublicRateLimit(
  env: WorkerEnv,
  input: {
    key: string;
    maxCount: number;
    windowSeconds: number;
  },
): Promise<boolean> {
  await ensureNewsletterTables(env);
  const nowUnix = Math.floor(Date.now() / 1000);
  const key = String(input.key || "").trim();
  if (!key) return true;

  const maxCount = Math.max(1, Math.floor(input.maxCount));
  const windowSeconds = Math.max(10, Math.floor(input.windowSeconds));
  const cutoffUnix = Math.max(0, nowUnix - windowSeconds);

  await env.DB.prepare(
    `DELETE FROM newsletter_public_rate_events
     WHERE key = ? AND created_at < ?`,
  )
    .bind(key, cutoffUnix)
    .run();

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as count
     FROM newsletter_public_rate_events
     WHERE key = ? AND created_at >= ?`,
  )
    .bind(key, cutoffUnix)
    .first<{ count: number | string | null }>();

  const count = Math.max(0, toNumber(countRow?.count));
  if (count >= maxCount) {
    return false;
  }

  await env.DB.prepare(
    `INSERT INTO newsletter_public_rate_events (key, created_at)
     VALUES (?, ?)`,
  )
    .bind(key, nowUnix)
    .run();
  return true;
}

export async function getPublicIdempotencyRecord(
  env: WorkerEnv,
  keyRaw: string,
): Promise<{
  key: string;
  source: string;
  email: string;
  state: string;
  statusCode: number;
  createdAtUnix: number;
  updatedAtUnix: number;
} | null> {
  await ensureNewsletterTables(env);
  const key = String(keyRaw || "").trim();
  if (!key) return null;

  const row = await env.DB.prepare(
    `SELECT key, source, email, state, status_code, created_at, updated_at
     FROM newsletter_public_idempotency
     WHERE key = ?
     LIMIT 1`,
  )
    .bind(key)
    .first<PublicIdempotencyRow>();

  if (!row) return null;
  return {
    key: String(row.key || "").trim(),
    source: String(row.source || "").trim(),
    email: normalizeEmail(row.email || ""),
    state: String(row.state || "").trim(),
    statusCode: Math.max(100, Math.min(599, toNumber(row.status_code, 200))),
    createdAtUnix: toNumber(row.created_at, 0),
    updatedAtUnix: toNumber(row.updated_at, 0),
  };
}

export async function setPublicIdempotencyRecord(
  env: WorkerEnv,
  input: {
    key: string;
    source?: string;
    email?: string;
    state?: string;
    statusCode?: number;
  },
): Promise<void> {
  await ensureNewsletterTables(env);
  const key = String(input.key || "").trim();
  if (!key) return;
  const nowUnix = Math.floor(Date.now() / 1000);
  const statusCode = Math.max(100, Math.min(599, Number(input.statusCode || 200)));

  await env.DB.prepare(
    `INSERT INTO newsletter_public_idempotency (
      key, source, email, state, status_code, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      source = excluded.source,
      email = excluded.email,
      state = excluded.state,
      status_code = excluded.status_code,
      updated_at = excluded.updated_at`,
  )
    .bind(
      key,
      String(input.source || "").trim(),
      normalizeEmail(input.email || ""),
      String(input.state || "").trim(),
      statusCode,
      nowUnix,
      nowUnix,
    )
    .run();
}

export async function upsertImportedSubscriber(
  env: WorkerEnv,
  input: {
    email: string;
    auth0Sub?: string;
    timezone?: string;
    tags?: string[];
    source?: string;
    consentEvidence?: Record<string, unknown>;
    active?: boolean;
  },
): Promise<NewsletterSubscriberRecord> {
  await ensureNewsletterTables(env);
  const nowUnix = Math.floor(Date.now() / 1000);
  const email = normalizeEmail(input.email);
  const tags = normalizeTagList(input.tags || []);
  const state: NewsletterSubscriberState = input.active === false ? "pending_confirmation" : "active";
  const existing = await getSubscriberByEmail(env, email);

  if (!existing) {
    const id = `sub_${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO newsletter_subscribers (
        id, email, auth0_sub, state, newsletter_enabled, digest_enabled,
        timezone, tags_json, source, consent_evidence_json,
        confirmed_at, unsubscribed_at, suppressed_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
    )
      .bind(
        id,
        email,
        input.auth0Sub || null,
        state,
        normalizeTimezone(input.timezone),
        JSON.stringify(tags),
        String(input.source || "import").trim().slice(0, 120),
        JSON.stringify(input.consentEvidence || {}),
        state === "active" ? nowUnix : null,
        nowUnix,
        nowUnix,
      )
      .run();
    await replaceSubscriberTags(env, id, tags, nowUnix);
    const fresh = await getSubscriberById(env, id);
    if (!fresh) throw new Error("Failed to import subscriber");
    return fresh;
  }

  await env.DB.prepare(
    `UPDATE newsletter_subscribers
     SET auth0_sub = COALESCE(?, auth0_sub),
         state = ?,
         newsletter_enabled = 1,
         timezone = ?,
         tags_json = ?,
         source = COALESCE(?, source),
         consent_evidence_json = ?,
         confirmed_at = CASE WHEN ? = 'active' THEN COALESCE(confirmed_at, ?) ELSE confirmed_at END,
         unsubscribed_at = NULL,
         suppressed_at = NULL,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      input.auth0Sub || null,
      state,
      normalizeTimezone(input.timezone),
      JSON.stringify(tags),
      String(input.source || "import").trim().slice(0, 120) || null,
      JSON.stringify({ ...existing.consentEvidence, ...(input.consentEvidence || {}) }),
      state,
      nowUnix,
      nowUnix,
      existing.id,
    )
    .run();

  await replaceSubscriberTags(env, existing.id, tags, nowUnix);
  const fresh = await getSubscriberById(env, existing.id);
  if (!fresh) throw new Error("Failed to update imported subscriber");
  return fresh;
}

export async function listSubscribersByIds(
  env: WorkerEnv,
  subscriberIds: string[],
): Promise<NewsletterSubscriberRecord[]> {
  await ensureNewsletterTables(env);
  const uniqueIds = Array.from(new Set(subscriberIds.map((id) => String(id || "").trim()).filter(Boolean)));
  if (!uniqueIds.length) return [];

  const placeholders = uniqueIds.map(() => "?").join(",");
  const query = `SELECT
      id, email, auth0_sub, state, newsletter_enabled, digest_enabled, timezone,
      tags_json, source, consent_evidence_json, created_at, updated_at, confirmed_at,
      unsubscribed_at, suppressed_at
    FROM newsletter_subscribers
    WHERE id IN (${placeholders})`;
  const rows = await env.DB.prepare(query).bind(...uniqueIds).all<SubscriberRow>();
  return (rows.results || []).map((row) => subscriberRowToRecord(row));
}

export async function getCampaignStats(
  env: WorkerEnv,
  campaignId: string,
): Promise<NewsletterCampaignStats> {
  await ensureNewsletterTables(env);
  await getDeliveryStatsForCampaign(env, campaignId);
  const stats = await getStoredCampaignStats(env, campaignId);
  if (stats) return stats;
  return {
    campaignId,
    queued: 0,
    sent: 0,
    failed: 0,
    delivered: 0,
    bounced: 0,
    complaints: 0,
    opens: 0,
    clicks: 0,
    updatedAt: toIso(Math.floor(Date.now() / 1000)),
  };
}

export async function findSubscriberByEmail(
  env: WorkerEnv,
  email: string,
): Promise<NewsletterSubscriberRecord | null> {
  return getSubscriberByEmail(env, email);
}

export async function listSubscribersByTag(
  env: WorkerEnv,
  tag: string,
): Promise<NewsletterSubscriberRecord[]> {
  await ensureNewsletterTables(env);
  const normalizedTag = normalizeTag(tag);
  if (!normalizedTag) return [];
  const rows = await env.DB.prepare(
    `SELECT
      s.id, s.email, s.auth0_sub, s.state, s.newsletter_enabled, s.digest_enabled,
      s.timezone, s.tags_json, s.source, s.consent_evidence_json,
      s.created_at, s.updated_at, s.confirmed_at, s.unsubscribed_at, s.suppressed_at
     FROM newsletter_subscribers s
     INNER JOIN newsletter_subscriber_tags t ON t.subscriber_id = s.id
     WHERE t.tag = ?
       AND s.state = 'active'
       AND s.newsletter_enabled = 1
       AND s.suppressed_at IS NULL`,
  )
    .bind(normalizedTag)
    .all<SubscriberRow>();
  return (rows.results || []).map((row) => subscriberRowToRecord(row));
}

export async function getWebhookEventById(
  env: WorkerEnv,
  providerEventId: string,
): Promise<boolean> {
  await ensureNewsletterTables(env);
  const row = await env.DB.prepare(
    "SELECT provider_event_id FROM newsletter_webhook_events WHERE provider_event_id = ? LIMIT 1",
  )
    .bind(providerEventId)
    .first<WebhookEventRow>();
  return !!row;
}
