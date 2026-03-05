import { getClientIp, requireNewsletterAdmin, requireNewsletterPublicEnabled } from "../lib/newsletter-auth";
import { requireUser } from "../lib/auth";
import {
  applyWebhookDeliveryEvent,
  activateSubscriber,
  claimDueCampaigns,
  consumeNewsletterToken,
  countPendingCampaignDeliveries,
  createCampaign,
  enqueueCampaignDelivery,
  enforcePublicRateLimit,
  findSubscriberByEmail,
  getCampaignById,
  getCampaignStats,
  getPublicIdempotencyRecord,
  getSubscriberById,
  issueNewsletterToken,
  listCampaigns,
  markCampaignCompletedFromDeliveryState,
  markCampaignSnapshot,
  markCampaignStatus,
  markDeliveryFailed,
  markDeliverySent,
  hashNewsletterAddress,
  normalizeEmail,
  normalizeTagList,
  normalizeTimezone,
  patchCampaignDraft,
  recordWebhookEventIfNew,
  resolveNewsletterTokenSubscriber,
  scheduleCampaign,
  setPublicIdempotencyRecord,
  suppressSubscriberByEmail,
  type NewsletterCampaignRecord,
  type NewsletterCampaignStatus,
  unsubscribeSubscriber,
  upsertImportedSubscriber,
  upsertSubscriberPendingConfirmation,
} from "../lib/newsletter-store";
import { estimateNewsletterSegment, resolveNewsletterSegmentSubscribers } from "../lib/newsletter-segments";
import type { WorkerEnv } from "../types/env";

type ResendSendResult = {
  ok: boolean;
  id?: string;
  error?: string;
};

type NewsletterCampaignPayload = {
  name?: unknown;
  templateKey?: unknown;
  subject?: unknown;
  preheader?: unknown;
  audienceSegment?: unknown;
  variables?: unknown;
  html?: unknown;
  text?: unknown;
};

const DEFAULT_CONFIRM_BASE_URL = "https://dexdsl.github.io/newsletter/confirm/";
const DEFAULT_UNSUBSCRIBE_BASE_URL = "https://dexdsl.github.io/newsletter/unsubscribe/";
const DEFAULT_FROM = "Dex Digital Sample Library <notifications@updates.dexdsl.com>";
const DEFAULT_BRAND_NAME = "Dex Digital Sample Library";
const DEFAULT_BRAND_ADDRESS = "Dex Digital Sample Library, Los Angeles, CA 90021";
const DEFAULT_BRAND_LOGO_URL = "https://dexdsl.github.io/assets/img/54952c48d15771b9cb2a.ico";
const DEFAULT_PUBLIC_SOURCE = "call-page";
const DEFAULT_PUBLIC_TAGS = ["status-watcher"];
const DEFAULT_ALLOWED_PUBLIC_SOURCES = [
  "call-page",
  "settings-newsletter",
  "settings-newsletter-manage",
  "settings-newsletter-pause",
  "settings-newsletter-unsubscribe",
];
const DEFAULT_ALLOWED_MARKETING_ORIGINS = ["https://dexdsl.org"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const LOCAL_DEV_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9:_-]{8,180}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NewsletterPublicSuccessState = "pending_confirmation" | "active";
type NewsletterPublicErrorCode =
  | "RATE_LIMIT"
  | "INVALID_EMAIL"
  | "CHALLENGE_FAILED"
  | "BAD_ORIGIN"
  | "TEMPORARY_UNAVAILABLE";

function isSettingsNewsletterSource(source: string): boolean {
  return /^settings-newsletter(?:-|$)/i.test(String(source || "").trim());
}

function isUuid(value: unknown): boolean {
  return UUID_RE.test(String(value ?? "").trim());
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function errorResponse(error: unknown): Response {
  if (error instanceof Response) return error;
  console.error("newsletter handler error", error);
  return json({ error: "Internal Server Error", detail: messageOf(error) }, 500);
}

function toText(value: unknown, fallback = "", max = 1000): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.slice(0, max);
}

function toOptionalText(value: unknown, max = 1000): string {
  return String(value ?? "").trim().slice(0, max);
}

function parseBoolean(value: unknown, fallback = false): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function toPositiveInteger(value: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(max, Math.floor(parsed)));
}

function parseCsvSet(
  value: unknown,
  {
    lowercase = false,
    maxItemLength = 200,
  }: {
    lowercase?: boolean;
    maxItemLength?: number;
  } = {},
): Set<string> {
  const text = String(value ?? "").trim();
  if (!text) return new Set();
  const out = new Set<string>();
  const chunks = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    let normalized = chunk.slice(0, maxItemLength);
    if (lowercase) normalized = normalized.toLowerCase();
    if (normalized) out.add(normalized);
  }
  return out;
}

function getAllowedPublicSources(env: WorkerEnv): Set<string> {
  const out = new Set(DEFAULT_ALLOWED_PUBLIC_SOURCES.map((item) => item.toLowerCase()));
  const configured = parseCsvSet(env.NEWSLETTER_PUBLIC_ALLOWED_SOURCES, {
    lowercase: true,
    maxItemLength: 120,
  });
  for (const source of configured) out.add(source);
  return out;
}

function parsePublicSource(env: WorkerEnv, value: unknown): string {
  const candidate = toText(value, "", 120).toLowerCase();
  if (!candidate) return DEFAULT_PUBLIC_SOURCE;
  const allowed = getAllowedPublicSources(env);
  if (!allowed.has(candidate)) return "";
  return candidate;
}

function getAllowedPublicOrigins(env: WorkerEnv): Set<string> {
  const configured = toText(
    env.NEWSLETTER_PUBLIC_ALLOWED_ORIGINS || env.ALLOWED_ORIGINS,
    "",
    4000,
  );
  const origins =
    configured
      ? parseCsvSet(configured, { lowercase: false, maxItemLength: 260 })
      : new Set(DEFAULT_ALLOWED_MARKETING_ORIGINS);
  const out = new Set<string>();
  for (const origin of origins) {
    try {
      out.add(new URL(origin).origin);
    } catch {
      // Ignore malformed entries in config.
    }
  }
  return out;
}

function isLocalDevRequest(request: Request): boolean {
  try {
    const url = new URL(request.url);
    const host = String(url.hostname || "").trim().toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function isAllowedPublicOrigin(origin: string, env: WorkerEnv, request: Request): boolean {
  const normalizedOrigin = toText(origin, "", 320);
  if (!normalizedOrigin) return false;
  if (LOCAL_DEV_ORIGIN_RE.test(normalizedOrigin)) {
    return isLocalDevRequest(request);
  }
  const allowed = getAllowedPublicOrigins(env);
  return allowed.has(normalizedOrigin);
}

function enforceNewsletterOriginIfRequired(request: Request, env: WorkerEnv): void {
  if (!parseBoolean(env.NEWSLETTER_PUBLIC_REQUIRE_ORIGIN, false)) return;
  const origin = toText(request.headers.get("origin"), "", 320);
  if (!origin || !isAllowedPublicOrigin(origin, env, request)) {
    throw json({ error: "Origin denied" }, 403);
  }
}

function parseClientEpochMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 0 && value < 2_000_000_000) return Math.floor(value * 1000);
    return Math.floor(value);
  }

  const text = String(value ?? "").trim();
  if (!text) return 0;

  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    if (numeric > 0 && numeric < 2_000_000_000) return Math.floor(numeric * 1000);
    return Math.floor(numeric);
  }

  const asDate = Date.parse(text);
  if (Number.isFinite(asDate)) return Math.floor(asDate);
  return 0;
}

function getSubmitElapsedMs(body: Record<string, unknown>): number {
  const startedAt = parseClientEpochMs(
    body.submittedAt ??
      body.submitted_at ??
      body.startedAt ??
      body.started_at ??
      body.formStartedAt ??
      body.clientStartedAt,
  );
  if (!startedAt) return 0;
  return Date.now() - startedAt;
}

function getBotTrapValue(body: Record<string, unknown>): string {
  const candidates = [
    body.honey,
    body.honeypot,
    body.website,
    body.company,
    body.url,
    body.hp,
    body._hp,
  ];
  for (const candidate of candidates) {
    const text = String(candidate ?? "").trim();
    if (text) return text.slice(0, 240);
  }
  return "";
}

function parseIdempotencyKey(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (!IDEMPOTENCY_KEY_RE.test(text)) return "";
  return text;
}

function getPublicIdempotencyKey(request: Request, body: Record<string, unknown>): string {
  const fromHeader =
    parseIdempotencyKey(request.headers.get("x-dx-idempotency-key")) ||
    parseIdempotencyKey(request.headers.get("idempotency-key"));
  if (fromHeader) return fromHeader;
  return parseIdempotencyKey(body.idempotencyKey ?? body.clientRequestId);
}

function getHeaderIdempotencyKey(request: Request): string {
  return (
    parseIdempotencyKey(request.headers.get("x-dx-idempotency-key")) ||
    parseIdempotencyKey(request.headers.get("idempotency-key"))
  );
}

function getClientRequestId(body: Record<string, unknown>): string {
  const fromBody = toText(body.clientRequestId, "", 120);
  if (!fromBody || !isUuid(fromBody)) return "";
  return fromBody;
}

function getTurnstileToken(request: Request, body: Record<string, unknown>): string {
  const fromHeader = String(request.headers.get("cf-turnstile-response") || "").trim();
  if (fromHeader) return fromHeader.slice(0, 4096);
  const fromBody = String(
    body.challengeToken ??
      body.turnstileToken ??
      body.turnstile ??
      body.cfTurnstileResponse ??
      "",
  ).trim();
  return fromBody.slice(0, 4096);
}

function createNewsletterRequestId(): string {
  return `nl_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

type TurnstileVerificationResult = {
  ok: boolean;
  reason: string;
};

async function verifyTurnstileToken(
  env: WorkerEnv,
  input: {
    token: string;
    ip: string;
  },
): Promise<TurnstileVerificationResult> {
  const secret = toText(env.NEWSLETTER_PUBLIC_TURNSTILE_SECRET, "", 320);
  if (!secret) {
    return {
      ok: false,
      reason: "turnstile_secret_missing",
    };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", input.token);
  if (input.ip && input.ip !== "unknown") {
    form.set("remoteip", input.ip);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: `turnstile_http_${response.status}`,
    };
  }

  const payload = await response
    .json<{
      success?: boolean;
      action?: string;
      hostname?: string;
      "error-codes"?: unknown;
    }>()
    .catch(() => null);

  if (!payload || payload.success !== true) {
    const codes = Array.isArray(payload?.["error-codes"])
      ? payload?.["error-codes"].map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    return {
      ok: false,
      reason: codes[0] || "turnstile_failed",
    };
  }

  const expectedAction = toText(env.NEWSLETTER_PUBLIC_TURNSTILE_ACTION, "", 120);
  const action = toText(payload.action, "", 120);
  if (expectedAction && action !== expectedAction) {
    return {
      ok: false,
      reason: "turnstile_action_mismatch",
    };
  }

  const allowedHostnames = parseCsvSet(env.NEWSLETTER_PUBLIC_TURNSTILE_HOSTNAMES, {
    lowercase: true,
    maxItemLength: 180,
  });
  const hostname = toText(payload.hostname, "", 180).toLowerCase();
  if (allowedHostnames.size > 0 && (!hostname || !allowedHostnames.has(hostname))) {
    return {
      ok: false,
      reason: "turnstile_hostname_mismatch",
    };
  }

  return {
    ok: true,
    reason: "ok",
  };
}

function isStrictMarketingMode(env: WorkerEnv): boolean {
  return parseBoolean(env.NEWSLETTER_PUBLIC_MARKETING_STRICT, false);
}

function getIdempotencyTtlSeconds(env: WorkerEnv): number {
  return toPositiveInteger(env.NEWSLETTER_PUBLIC_IDEMPOTENCY_TTL_SECONDS, 24 * 60 * 60, 14 * 24 * 60 * 60);
}

function logNewsletterSubscribeEvent(
  requestId: string,
  event: string,
  detail: Record<string, unknown> = {},
): void {
  const payload = {
    scope: "newsletter_subscribe",
    requestId,
    event,
    ...detail,
  };
  console.log(JSON.stringify(payload));
}

function buildPublicSuccessPayload(
  requestId: string,
  state: NewsletterPublicSuccessState,
  message = "",
): {
  ok: true;
  state: NewsletterPublicSuccessState;
  requestId: string;
  message?: string;
} {
  const out: {
    ok: true;
    state: NewsletterPublicSuccessState;
    requestId: string;
    message?: string;
  } = {
    ok: true,
    state,
    requestId,
  };
  if (message) out.message = message;
  return out;
}

function buildPublicErrorPayload(
  requestId: string,
  code: NewsletterPublicErrorCode,
  retryAfterSeconds = 0,
): {
  ok: false;
  code: NewsletterPublicErrorCode;
  requestId: string;
  retryAfterSeconds?: number;
} {
  const out: {
    ok: false;
    code: NewsletterPublicErrorCode;
    requestId: string;
    retryAfterSeconds?: number;
  } = {
    ok: false,
    code,
    requestId,
  };
  if (retryAfterSeconds > 0) {
    out.retryAfterSeconds = retryAfterSeconds;
  }
  return out;
}

function toObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) return value as Record<string, unknown>;
  return {};
}

function parseJsonBody<T>(raw: unknown): T {
  if (!raw || typeof raw !== "object") {
    throw json({ error: "Invalid JSON body" }, 400);
  }
  return raw as T;
}

function parseEmail(value: unknown): string {
  const email = normalizeEmail(value);
  if (!EMAIL_RE.test(email) || email.length > 320) {
    throw json({ error: "Invalid email" }, 422);
  }
  return email;
}

function parseIsoToUnix(value: unknown): number {
  const text = toText(value, "", 120);
  if (!text) throw json({ error: "Missing schedule timestamp" }, 422);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    throw json({ error: "Invalid schedule timestamp" }, 422);
  }
  return Math.floor(parsed / 1000);
}

function getConfirmBaseUrl(env: WorkerEnv): string {
  const configured = toText(env.NEWSLETTER_CONFIRM_BASE_URL, "", 400);
  if (!configured) return DEFAULT_CONFIRM_BASE_URL;
  return configured;
}

function getUnsubscribeBaseUrl(env: WorkerEnv): string {
  const configured = toText(env.NEWSLETTER_UNSUBSCRIBE_BASE_URL, "", 400);
  if (!configured) return DEFAULT_UNSUBSCRIBE_BASE_URL;
  return configured;
}

function getBrandName(env: WorkerEnv): string {
  return toText(env.NEWSLETTER_BRAND_NAME, DEFAULT_BRAND_NAME, 160);
}

function getBrandAddress(env: WorkerEnv): string {
  return toText(env.NEWSLETTER_BRAND_ADDRESS, DEFAULT_BRAND_ADDRESS, 220);
}

function getBrandLogoUrl(env: WorkerEnv): string {
  return toText(env.NEWSLETTER_BRAND_LOGO_URL, DEFAULT_BRAND_LOGO_URL, 600);
}

function appendToken(urlBase: string, token: string): string {
  try {
    const parsed = new URL(urlBase);
    parsed.searchParams.set("token", token);
    return parsed.toString();
  } catch {
    const separator = urlBase.includes("?") ? "&" : "?";
    return `${urlBase}${separator}token=${encodeURIComponent(token)}`;
  }
}

function buildConfirmUrl(env: WorkerEnv, token: string): string {
  return appendToken(getConfirmBaseUrl(env), token);
}

function buildUnsubscribeUrl(env: WorkerEnv, token: string): string {
  return appendToken(getUnsubscribeBaseUrl(env), token);
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const bytes = new Uint8Array(signature);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Base64(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function secureCompare(a: string, b: string): boolean {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let out = 0;
  for (let index = 0; index < left.length; index += 1) {
    out |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return out === 0;
}

async function verifyResendWebhookSignature(
  request: Request,
  payload: string,
  secret: string,
): Promise<boolean> {
  const auth = toText(request.headers.get("authorization"), "", 500);
  if (auth) {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match?.[1] && secureCompare(match[1].trim(), secret)) {
      return true;
    }
  }

  const headerRaw =
    request.headers.get("x-resend-signature") ||
    request.headers.get("x-webhook-signature") ||
    request.headers.get("svix-signature") ||
    "";

  if (!headerRaw) return false;

  const expectedHex = await hmacSha256Hex(secret, payload);
  const expectedBase64 = await hmacSha256Base64(secret, payload);
  const pieces = headerRaw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const piece of pieces) {
    const normalized = piece.includes("=") ? piece.split("=").pop() || "" : piece;
    const candidate = normalized.trim();
    if (!candidate) continue;
    if (secureCompare(candidate, expectedHex)) return true;
    if (secureCompare(candidate, expectedBase64)) return true;
  }

  return false;
}

function injectCampaignTokens(
  campaign: NewsletterCampaignRecord,
  input: {
    unsubscribeUrl: string;
  },
): { html: string; text: string } {
  const unsubscribeUrl = input.unsubscribeUrl;
  let html = campaign.html || "";
  let text = campaign.text || "";

  if (html.includes("{{unsubscribeUrl}}")) {
    html = html.replaceAll("{{unsubscribeUrl}}", unsubscribeUrl);
  } else {
    html += `\n<p style="font-size:12px;color:#666">Manage subscription: <a href="${unsubscribeUrl}">${unsubscribeUrl}</a></p>`;
  }

  if (text.includes("{{unsubscribeUrl}}")) {
    text = text.replaceAll("{{unsubscribeUrl}}", unsubscribeUrl);
  } else {
    text += `\n\nManage subscription: ${unsubscribeUrl}`;
  }

  return { html, text };
}

async function sendResendEmail(
  env: WorkerEnv,
  input: {
    to: string;
    subject: string;
    html: string;
    text: string;
    listUnsubscribe?: string;
  },
): Promise<ResendSendResult> {
  const apiKey = toText(env.RESEND_API_KEY, "", 320);
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY missing" };
  }

  const from = toText(env.RESEND_FROM, "", 240) || DEFAULT_FROM;
  const headers: Record<string, string> = {};
  if (input.listUnsubscribe) {
    headers["List-Unsubscribe"] = `<${input.listUnsubscribe}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      headers,
    }),
  });

  const payload = await response
    .json<{ id?: string; message?: string; error?: { message?: string } }>()
    .catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      error:
        payload?.error?.message ||
        payload?.message ||
        `Resend request failed (${response.status})`,
    };
  }

  return {
    ok: true,
    id: payload?.id,
  };
}

async function sendConfirmationEmail(
  env: WorkerEnv,
  input: {
    email: string;
    confirmUrl: string;
    unsubscribeUrl: string;
  },
): Promise<ResendSendResult> {
  const brandName = getBrandName(env);
  const brandAddress = getBrandAddress(env);
  const brandLogoUrl = getBrandLogoUrl(env);
  const subject = `Confirm your ${brandName} newsletter subscription`;
  const text = [
    `You requested to subscribe to the ${brandName} newsletter.`,
    "",
    `Confirm subscription: ${input.confirmUrl}`,
    "",
    `Cancel this request: ${input.unsubscribeUrl}`,
    "",
    "If this was not you, you can cancel this request or ignore this email.",
    "",
    brandAddress,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;background:#f8fafc;padding:18px;">
      <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;">
        <img src="${brandLogoUrl}" alt="${brandName}" width="40" height="40" style="display:block;border-radius:8px;border:1px solid #d1d5db;background:#f9fafb;padding:4px;" />
        <h2 style="margin:14px 0 8px;font-size:22px;line-height:1.25;">Confirm your newsletter subscription</h2>
        <p style="margin:0 0 12px;">You requested to subscribe to the ${brandName} newsletter.</p>
        <p style="margin:0 0 12px;"><a href="${input.confirmUrl}" style="display:inline-block;background:#f97316;color:#111827;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;">Confirm subscription</a></p>
        <p style="margin:0 0 12px;">If this was not you, <a href="${input.unsubscribeUrl}">cancel this request</a> or ignore this email.</p>
        <p style="margin:0;color:#6b7280;font-size:12px;">${brandAddress}</p>
      </div>
    </div>
  `;

  return sendResendEmail(env, {
    to: input.email,
    subject,
    html,
    text,
    listUnsubscribe: input.unsubscribeUrl,
  });
}

async function sendManageSubscriptionEmail(
  env: WorkerEnv,
  input: {
    email: string;
    unsubscribeUrl: string;
  },
): Promise<ResendSendResult> {
  const brandName = getBrandName(env);
  const brandAddress = getBrandAddress(env);
  const brandLogoUrl = getBrandLogoUrl(env);
  const subject = `${brandName} newsletter subscription links`;
  const text = [
    `You are already subscribed to the ${brandName} newsletter.`,
    "",
    `Manage subscription: ${input.unsubscribeUrl}`,
    "",
    "Use the link above to unsubscribe at any time.",
    "",
    brandAddress,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;background:#f8fafc;padding:18px;">
      <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;">
        <img src="${brandLogoUrl}" alt="${brandName}" width="40" height="40" style="display:block;border-radius:8px;border:1px solid #d1d5db;background:#f9fafb;padding:4px;" />
        <h2 style="margin:14px 0 8px;font-size:22px;line-height:1.25;">Manage your newsletter subscription</h2>
        <p style="margin:0 0 12px;">You are already subscribed to the ${brandName} newsletter.</p>
        <p style="margin:0 0 12px;"><a href="${input.unsubscribeUrl}" style="display:inline-block;background:#f97316;color:#111827;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;">Manage subscription</a></p>
        <p style="margin:0 0 12px;">Use this link to unsubscribe at any time.</p>
        <p style="margin:0;color:#6b7280;font-size:12px;">${brandAddress}</p>
      </div>
    </div>
  `;

  return sendResendEmail(env, {
    to: input.email,
    subject,
    html,
    text,
    listUnsubscribe: input.unsubscribeUrl,
  });
}

function normalizeCampaignInput(payload: NewsletterCampaignPayload): {
  name: string;
  templateKey: string;
  subject: string;
  preheader: string;
  audienceSegment: string;
  variables: Record<string, unknown>;
  html: string;
  text: string;
} {
  const name = toText(payload.name, "", 180);
  const templateKey = toText(payload.templateKey, "", 120);
  const subject = toText(payload.subject, "", 200);
  const preheader = toOptionalText(payload.preheader, 240);
  const audienceSegment = toText(payload.audienceSegment, "all_subscribers", 80);
  const variables = toObject(payload.variables);
  const html = String(payload.html ?? "");
  const text = String(payload.text ?? "");

  if (!name) throw json({ error: "name is required" }, 422);
  if (!templateKey) throw json({ error: "templateKey is required" }, 422);
  if (!subject) throw json({ error: "subject is required" }, 422);
  if (!html.trim()) throw json({ error: "html is required" }, 422);
  if (!text.trim()) throw json({ error: "text is required" }, 422);

  return {
    name,
    templateKey,
    subject,
    preheader,
    audienceSegment,
    variables,
    html,
    text,
  };
}

function parseWebhookEvent(payload: Record<string, unknown>): {
  providerEventId: string;
  eventType: string;
  providerMessageId: string;
  recipientEmail: string;
} {
  const dataValue = payload.data;
  const dataObject = Array.isArray(dataValue) ? dataValue[0] : dataValue;
  const event = toObject(dataObject ?? payload);

  const providerEventId =
    toText(payload.id, "", 240) ||
    toText(event.id, "", 240) ||
    `resend_evt_${crypto.randomUUID()}`;

  const rawType =
    toText(payload.type, "", 120) ||
    toText(event.type, "", 120) ||
    toText(payload.event, "", 120) ||
    "unknown";

  const normalizedType = rawType.toLowerCase();
  let eventType = "unknown";
  if (normalizedType.includes("delivered")) eventType = "delivered";
  else if (normalizedType.includes("open")) eventType = "opened";
  else if (normalizedType.includes("click")) eventType = "clicked";
  else if (normalizedType.includes("bounce")) eventType = "bounced";
  else if (normalizedType.includes("complaint") || normalizedType.includes("spam")) eventType = "complained";

  const providerMessageId =
    toText(event.email_id, "", 240) ||
    toText(event.id, "", 240) ||
    toText(payload.email_id, "", 240);

  const recipientEmail = normalizeEmail(
    event.to || event.email || payload.to || payload.email,
  );

  return {
    providerEventId,
    eventType,
    providerMessageId,
    recipientEmail,
  };
}

async function sendCampaignToRecipient(
  env: WorkerEnv,
  input: {
    campaign: NewsletterCampaignRecord;
    subscriberId: string;
    email: string;
  },
): Promise<{ ok: boolean; providerId?: string; error?: string }> {
  const unsubscribeToken = await issueNewsletterToken(env, {
    subscriberId: input.subscriberId,
    campaignId: input.campaign.id,
    purpose: "unsubscribe",
  });
  const unsubscribeUrl = buildUnsubscribeUrl(env, unsubscribeToken.token);
  const rendered = injectCampaignTokens(input.campaign, {
    unsubscribeUrl,
  });

  const response = await sendResendEmail(env, {
    to: input.email,
    subject: input.campaign.subject,
    html: rendered.html,
    text: rendered.text,
    listUnsubscribe: unsubscribeUrl,
  });

  if (!response.ok) {
    return { ok: false, error: response.error || "send_failed" };
  }

  return { ok: true, providerId: response.id };
}

export async function postNewsletterSubscribe(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const requestId = createNewsletterRequestId();
  const respond = (payload: unknown, status = 200, retryAfterSeconds = 0): Response => {
    const response = json(payload, status);
    response.headers.set("x-dx-newsletter-request-id", requestId);
    if (retryAfterSeconds > 0) {
      response.headers.set("retry-after", String(retryAfterSeconds));
    }
    return response;
  };
  const respondSuccess = (
    state: NewsletterPublicSuccessState,
    message = "",
    status = 200,
  ): Response => respond(buildPublicSuccessPayload(requestId, state, message), status);
  const respondError = (
    code: NewsletterPublicErrorCode,
    status: number,
    opts: {
      retryAfterSeconds?: number;
      logReason?: string;
      logDetail?: Record<string, unknown>;
    } = {},
  ): Response => {
    logNewsletterSubscribeEvent(requestId, "reject", {
      code,
      status,
      reason: opts.logReason || code.toLowerCase(),
      ...(opts.logDetail || {}),
    });
    return respond(
      buildPublicErrorPayload(requestId, code, toPositiveInteger(opts.retryAfterSeconds, 0, 7200)),
      status,
      toPositiveInteger(opts.retryAfterSeconds, 0, 7200),
    );
  };

  try {
    requireNewsletterPublicEnabled(env);
    enforceNewsletterOriginIfRequired(request, env);

    const body = parseJsonBody<{
      email?: unknown;
      source?: unknown;
      tags?: unknown;
      timezone?: unknown;
      auth0Sub?: unknown;
      context?: unknown;
      idempotencyKey?: unknown;
      challengeToken?: unknown;
      honey?: unknown;
      submittedAt?: unknown;
      clientRequestId?: unknown;
      honeypot?: unknown;
      website?: unknown;
      company?: unknown;
      startedAt?: unknown;
      turnstileToken?: unknown;
      turnstile?: unknown;
      cfTurnstileResponse?: unknown;
    }>(await request.json<unknown>().catch(() => null));
    const bodyRecord = toObject(body);

    let email = "";
    try {
      email = parseEmail(body.email);
    } catch {
      return respondError("INVALID_EMAIL", 422, {
        logReason: "invalid_email",
      });
    }

    const parsedSource = parsePublicSource(env, body.source);
    const source = parsedSource || DEFAULT_PUBLIC_SOURCE;
    const sourceAllowed = Boolean(parsedSource);
    const timezone = normalizeTimezone(body.timezone);
    const tags = normalizeTagList(Array.isArray(body.tags) ? body.tags : DEFAULT_PUBLIC_TAGS);
    const auth0SubRaw = toText(body.auth0Sub, "", 240);
    const ip = getClientIp(request);
    const settingsSource = isSettingsNewsletterSource(source);
    const strictMode = isStrictMarketingMode(env);
    const idempotencyTtlSeconds = getIdempotencyTtlSeconds(env);
    const idempotencyKey = getPublicIdempotencyKey(request, bodyRecord);
    const idempotencyHeaderKey = getHeaderIdempotencyKey(request);
    const clientRequestId = getClientRequestId(bodyRecord);
    const origin = toText(request.headers.get("origin"), "", 320);
    const referer = toText(request.headers.get("referer"), "", 520);
    const userAgent = toText(request.headers.get("user-agent"), "", 260);
    const context = toObject(body.context);
    const contextPagePath = toText(context.pagePath, "", 280);
    const contextReferrer = toText(context.referrer, "", 420);
    const contextUserAgentHint = toText(context.userAgentHint, "", 260);
    const marketingSubmittedAt = parseClientEpochMs(bodyRecord.submittedAt);
    const elapsedMs = getSubmitElapsedMs(bodyRecord);
    const minSubmitMs = toPositiveInteger(env.NEWSLETTER_PUBLIC_MIN_SUBMIT_MS, 0, 120_000);
    const challengeToken = getTurnstileToken(request, bodyRecord);
    const honeyFieldPresent = Object.prototype.hasOwnProperty.call(bodyRecord, "honey");
    const honeyValue = toText(bodyRecord.honey, "", 240);

    let trustedSettingsSub = "";
    if (settingsSource) {
      try {
        const user = await requireUser(request, env);
        trustedSettingsSub = toText(user.sub, "", 240);
      } catch {
        trustedSettingsSub = "";
      }
    }
    const trustedSettingsFlow = settingsSource && Boolean(trustedSettingsSub);
    const publicMarketingFlow = !trustedSettingsFlow;

    if (publicMarketingFlow && !sourceAllowed) {
      if (strictMode) {
        return respondError("BAD_ORIGIN", 403, {
          logReason: "source_not_allowlisted",
          logDetail: { source },
        });
      }
      logNewsletterSubscribeEvent(requestId, "compat_missing_fields", {
        source,
        missing: ["source_allowlist"],
      });
    }

    if (publicMarketingFlow) {
      const requireOrigin = strictMode || parseBoolean(env.NEWSLETTER_PUBLIC_REQUIRE_ORIGIN, false);
      if (requireOrigin && (!origin || !isAllowedPublicOrigin(origin, env, request))) {
        return respondError("BAD_ORIGIN", 403, {
          logReason: "origin_not_allowlisted",
          logDetail: { origin: origin || "(missing)" },
        });
      }
    }

    if (publicMarketingFlow && !strictMode) {
      const missingFields: string[] = [];
      if (!idempotencyHeaderKey) missingFields.push("idempotency_header");
      if (!challengeToken) missingFields.push("challengeToken");
      if (!honeyFieldPresent) missingFields.push("honey");
      if (!marketingSubmittedAt) missingFields.push("submittedAt");
      if (!clientRequestId) missingFields.push("clientRequestId");
      if (missingFields.length) {
        logNewsletterSubscribeEvent(requestId, "compat_missing_fields", {
          source,
          missing: missingFields,
        });
      }
    }

    if (publicMarketingFlow && strictMode) {
      if (!idempotencyHeaderKey || !isUuid(idempotencyHeaderKey)) {
        return respondError("TEMPORARY_UNAVAILABLE", 400, {
          logReason: "idempotency_header_required",
        });
      }
      if (!clientRequestId || !isUuid(clientRequestId)) {
        return respondError("TEMPORARY_UNAVAILABLE", 400, {
          logReason: "client_request_id_invalid",
        });
      }
      if (!honeyFieldPresent || honeyValue) {
        return respondError("CHALLENGE_FAILED", 403, {
          logReason: !honeyFieldPresent ? "honey_missing" : "honey_not_empty",
        });
      }
      if (!marketingSubmittedAt) {
        return respondError("CHALLENGE_FAILED", 403, {
          logReason: "submittedAt_missing",
        });
      }
    }

    const emailHash = await hashNewsletterAddress(email);

    const rememberIdempotency = async (state: string, statusCode = 200): Promise<void> => {
      if (!idempotencyKey) return;
      await setPublicIdempotencyRecord(env, {
        key: idempotencyKey,
        source,
        email: emailHash,
        state,
        statusCode,
      });
    };

    if (idempotencyKey) {
      const existing = await getPublicIdempotencyRecord(env, idempotencyKey);
      if (existing) {
        const isExpired =
          existing.updatedAtUnix > 0 &&
          Math.floor(Date.now() / 1000) - existing.updatedAtUnix > idempotencyTtlSeconds;
        if (!isExpired) {
          const existingSource = toText(existing.source, "", 120).toLowerCase();
          const existingEmailKeyRaw = toText(existing.email, "", 320).toLowerCase();
          const existingEmailKey = existingEmailKeyRaw.includes("@")
            ? await hashNewsletterAddress(existingEmailKeyRaw)
            : existingEmailKeyRaw;
          if (
            (existingSource && existingSource !== source) ||
            (existingEmailKey && existingEmailKey !== emailHash)
          ) {
            return respondError("TEMPORARY_UNAVAILABLE", 409, {
              logReason: "idempotency_conflict",
              logDetail: { source },
            });
          }

          const replayStatus = Math.max(100, Math.min(599, toPositiveInteger(existing.statusCode, 200, 599)));
          const replayState = toText(existing.state, "pending_confirmation", 80).toLowerCase();
          if (replayStatus < 400) {
            if (replayState === "active") {
              return respondSuccess("active");
            }
            return respondSuccess("pending_confirmation");
          }
          if (replayState === "rate_limited" || replayStatus === 429) {
            return respondError("RATE_LIMIT", 429, {
              retryAfterSeconds: 60,
              logReason: "idempotent_rate_limit",
            });
          }
          if (replayState === "challenge_failed") {
            return respondError("CHALLENGE_FAILED", 403, {
              logReason: "idempotent_challenge_failed",
            });
          }
          if (replayState === "bad_origin") {
            return respondError("BAD_ORIGIN", 403, {
              logReason: "idempotent_bad_origin",
            });
          }
          return respondError("TEMPORARY_UNAVAILABLE", replayStatus, {
            logReason: "idempotent_temporary_unavailable",
          });
        }
      }
    }

    if (!trustedSettingsFlow) {
      const botTrapValue = getBotTrapValue(bodyRecord);
      if (botTrapValue) {
        await rememberIdempotency(strictMode ? "challenge_failed" : "pending_confirmation", strictMode ? 403 : 200);
        if (strictMode) {
          return respondError("CHALLENGE_FAILED", 403, {
            logReason: "honeypot_rejected",
          });
        }
        return respondSuccess("pending_confirmation");
      }

      if (minSubmitMs > 0) {
        if (elapsedMs > 0 && elapsedMs < minSubmitMs) {
          await rememberIdempotency(strictMode ? "challenge_failed" : "pending_confirmation", strictMode ? 403 : 200);
          if (strictMode) {
            return respondError("CHALLENGE_FAILED", 403, {
              logReason: "submitted_too_fast",
              logDetail: { elapsedMs, minSubmitMs },
            });
          }
          return respondSuccess("pending_confirmation");
        }
      }

      const turnstileRequired =
        strictMode || parseBoolean(env.NEWSLETTER_PUBLIC_TURNSTILE_REQUIRED, false);
      const turnstileSecret = toText(env.NEWSLETTER_PUBLIC_TURNSTILE_SECRET, "", 320);
      const shouldVerifyTurnstile = Boolean(turnstileSecret) && (turnstileRequired || Boolean(challengeToken));

      if (turnstileRequired && !turnstileSecret) {
        await rememberIdempotency("temporary_unavailable", 503);
        return respondError("TEMPORARY_UNAVAILABLE", 503, {
          logReason: "turnstile_secret_missing",
        });
      }

      if (turnstileRequired && !challengeToken) {
        await rememberIdempotency("challenge_failed", 403);
        return respondError("CHALLENGE_FAILED", 403, {
          logReason: "turnstile_token_missing",
        });
      }

      if (shouldVerifyTurnstile && challengeToken) {
        const turnstile = await verifyTurnstileToken(env, {
          token: challengeToken,
          ip,
        });
        if (!turnstile.ok) {
          await rememberIdempotency("challenge_failed", 403);
          return respondError("CHALLENGE_FAILED", 403, {
            logReason: turnstile.reason,
          });
        }
      }
    }

    const auth0Sub = trustedSettingsSub || auth0SubRaw;
    const emailRateLimitKey = trustedSettingsSub
      ? `newsletter:settings:email:${emailHash}`
      : `newsletter:email:${emailHash}`;
    const actorRateLimitKey = trustedSettingsSub
      ? `newsletter:settings:sub:${trustedSettingsSub}`
      : `newsletter:ip:${ip}`;
    const emailRateWindowSeconds = 60 * 60;
    const actorRateWindowSeconds = 60 * 60;

    const emailRateOk = await enforcePublicRateLimit(env, {
      key: emailRateLimitKey,
      maxCount: trustedSettingsSub ? 30 : 5,
      windowSeconds: emailRateWindowSeconds,
    });
    const actorRateOk = await enforcePublicRateLimit(env, {
      key: actorRateLimitKey,
      maxCount: trustedSettingsSub ? 60 : 20,
      windowSeconds: actorRateWindowSeconds,
    });

    if (!emailRateOk || !actorRateOk) {
      const retryAfterSeconds = Math.max(emailRateWindowSeconds, actorRateWindowSeconds);
      await rememberIdempotency("rate_limited", 429);
      return respondError("RATE_LIMIT", 429, {
        retryAfterSeconds,
        logReason: "rate_limit_exceeded",
      });
    }

    const upserted = await upsertSubscriberPendingConfirmation(env, {
      email,
      source,
      timezone,
      tags,
      auth0Sub: auth0Sub || undefined,
      consentEvidence: {
        source,
        ip,
        capturedAt: new Date().toISOString(),
        origin,
        referer,
        userAgent,
        requestId,
        idempotencyKey,
        trustedSettingsFlow,
        clientRequestId,
        context: {
          pagePath: contextPagePath,
          referrer: contextReferrer,
          userAgentHint: contextUserAgentHint,
        },
        submittedAt: marketingSubmittedAt ? new Date(marketingSubmittedAt).toISOString() : "",
      },
    });

    if (upserted.subscriber.state === "suppressed") {
      await rememberIdempotency("pending_confirmation", 200);
      logNewsletterSubscribeEvent(requestId, "suppressed_address", {
        source,
      });
      return respondSuccess("pending_confirmation");
    }

    if (!upserted.requiresConfirmation) {
      const unsubscribeToken = await issueNewsletterToken(env, {
        subscriberId: upserted.subscriber.id,
        purpose: "unsubscribe",
      });
      const unsubscribeUrl = buildUnsubscribeUrl(env, unsubscribeToken.token);
      const sendResult = await sendManageSubscriptionEmail(env, {
        email,
        unsubscribeUrl,
      });

      if (!sendResult.ok) {
        await rememberIdempotency("temporary_unavailable", 502);
        return respondError("TEMPORARY_UNAVAILABLE", 502, {
          logReason: sendResult.error || "manage_link_send_failed",
        });
      }

      await rememberIdempotency("active", 200);
      logNewsletterSubscribeEvent(requestId, "subscribed_active", {
        source,
      });
      return respondSuccess("active");
    }

    const token = await issueNewsletterToken(env, {
      subscriberId: upserted.subscriber.id,
      purpose: "confirm",
    });
    const unsubscribeToken = await issueNewsletterToken(env, {
      subscriberId: upserted.subscriber.id,
      purpose: "unsubscribe",
    });

    const confirmUrl = buildConfirmUrl(env, token.token);
    const unsubscribeUrl = buildUnsubscribeUrl(env, unsubscribeToken.token);
    const sendResult = await sendConfirmationEmail(env, {
      email,
      confirmUrl,
      unsubscribeUrl,
    });

    if (!sendResult.ok) {
      await rememberIdempotency("temporary_unavailable", 502);
      return respondError("TEMPORARY_UNAVAILABLE", 502, {
        logReason: sendResult.error || "confirmation_send_failed",
      });
    }

    await rememberIdempotency("pending_confirmation", 200);
    logNewsletterSubscribeEvent(requestId, "subscribed_pending_confirmation", {
      source,
    });
    return respondSuccess("pending_confirmation");
  } catch (error) {
    if (error instanceof Response) {
      const status = Math.max(100, Math.min(599, toPositiveInteger(error.status, 500, 599)));
      if (status === 429) {
        return respondError("RATE_LIMIT", 429, {
          retryAfterSeconds: 60,
          logReason: "thrown_rate_limit",
        });
      }
      if (status === 400 || status === 422) {
        return respondError("INVALID_EMAIL", status, {
          logReason: "thrown_invalid_email",
        });
      }
      if (status === 403) {
        return respondError("BAD_ORIGIN", 403, {
          logReason: "thrown_bad_origin",
        });
      }
      if (status === 503 || status === 502) {
        return respondError("TEMPORARY_UNAVAILABLE", status, {
          logReason: "thrown_temporary_unavailable",
        });
      }
      return respondError("TEMPORARY_UNAVAILABLE", status, {
        logReason: "thrown_response_error",
      });
    }
    logNewsletterSubscribeEvent(requestId, "error", {
      reason: messageOf(error),
    });
    return respondError("TEMPORARY_UNAVAILABLE", 503, {
      logReason: "internal_error",
    });
  }
}

export async function postNewsletterConfirm(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  try {
    requireNewsletterPublicEnabled(env);

    const body = parseJsonBody<{ token?: unknown }>(
      await request.json<unknown>().catch(() => null),
    );
    const token = toText(body.token, "", 800);
    if (!token) return json({ error: "Missing token" }, 422);

    const consumed = await consumeNewsletterToken(env, {
      token,
      purpose: "confirm",
    });

    if (!consumed) {
      return json({ error: "Invalid or expired token" }, 400);
    }

    const subscriber = await activateSubscriber(env, consumed.subscriberId);
    if (!subscriber) {
      return json({ error: "Subscriber not found" }, 404);
    }

    return json({ ok: true, state: "active" });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function postNewsletterUnsubscribe(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  try {
    requireNewsletterPublicEnabled(env);

    const body = parseJsonBody<{ token?: unknown }>(
      await request.json<unknown>().catch(() => null),
    );
    const token = toText(body.token, "", 800);
    if (!token) return json({ error: "Missing token" }, 422);

    let consumed = await consumeNewsletterToken(env, {
      token,
      purpose: "unsubscribe",
    });

    if (!consumed) {
      consumed = await consumeNewsletterToken(env, {
        token,
        purpose: "confirm",
      });
    }

    if (!consumed) {
      consumed = await resolveNewsletterTokenSubscriber(env, { token });
    }

    if (!consumed) {
      return json({ error: "Invalid or expired token" }, 400);
    }

    const subscriber = await unsubscribeSubscriber(env, consumed.subscriberId);
    if (!subscriber) {
      return json({ error: "Subscriber not found" }, 404);
    }

    return json({ ok: true, state: "unsubscribed" });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function getAdminNewsletterCampaigns(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  try {
    requireNewsletterAdmin(request, env);
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 100)));
    const campaigns = await listCampaigns(env, limit);
    return json({ campaigns });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function postAdminNewsletterCampaigns(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  try {
    requireNewsletterAdmin(request, env);
    const body = parseJsonBody<NewsletterCampaignPayload>(
      await request.json<unknown>().catch(() => null),
    );
    const normalized = normalizeCampaignInput(body);
    const campaign = await createCampaign(env, normalized);
    return json({ ok: true, campaign }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function patchAdminNewsletterCampaign(
  request: Request,
  env: WorkerEnv,
  campaignIdRaw: string,
): Promise<Response> {
  try {
    requireNewsletterAdmin(request, env);
    const campaignId = decodeURIComponent(campaignIdRaw || "").trim();
    if (!campaignId) return json({ error: "Invalid campaign id" }, 400);

    const body = parseJsonBody<NewsletterCampaignPayload>(
      await request.json<unknown>().catch(() => null),
    );
    const current = await getCampaignById(env, campaignId);
    if (!current) return json({ error: "Campaign not found" }, 404);

    const patch = {
      name: body.name === undefined ? undefined : toText(body.name, "", 180),
      templateKey:
        body.templateKey === undefined ? undefined : toText(body.templateKey, "", 120),
      subject: body.subject === undefined ? undefined : toText(body.subject, "", 200),
      preheader: body.preheader === undefined ? undefined : toOptionalText(body.preheader, 240),
      audienceSegment:
        body.audienceSegment === undefined
          ? undefined
          : toText(body.audienceSegment, "", 80),
      variables: body.variables === undefined ? undefined : toObject(body.variables),
      html: body.html === undefined ? undefined : String(body.html || ""),
      text: body.text === undefined ? undefined : String(body.text || ""),
    };

    const updated = await patchCampaignDraft(env, campaignId, patch);
    if (!updated) {
      return json({ error: "Campaign cannot be edited unless it is in draft state" }, 409);
    }
    return json({ ok: true, campaign: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function postAdminNewsletterCampaignTestSend(
  request: Request,
  env: WorkerEnv,
  campaignIdRaw: string,
): Promise<Response> {
  try {
    requireNewsletterAdmin(request, env);
    const campaignId = decodeURIComponent(campaignIdRaw || "").trim();
    if (!campaignId) return json({ error: "Invalid campaign id" }, 400);

    const campaign = await getCampaignById(env, campaignId);
    if (!campaign) return json({ error: "Campaign not found" }, 404);

    const body = parseJsonBody<{ to?: unknown }>(
      await request.json<unknown>().catch(() => null),
    );
    const to = parseEmail(body.to);

    const existing = await findSubscriberByEmail(env, to);
    const subscriber = existing
      ? existing
      : await upsertImportedSubscriber(env, {
          email: to,
          source: "admin-test-send",
          consentEvidence: {
            source: "admin-test-send",
            createdAt: new Date().toISOString(),
          },
          tags: [],
          active: true,
        });

    const unsubscribeToken = await issueNewsletterToken(env, {
      subscriberId: subscriber.id,
      campaignId: campaign.id,
      purpose: "unsubscribe",
      ttlSeconds: 30 * 24 * 60 * 60,
    });

    const unsubscribeUrl = buildUnsubscribeUrl(env, unsubscribeToken.token);
    const rendered = injectCampaignTokens(campaign, { unsubscribeUrl });
    const sendResult = await sendResendEmail(env, {
      to,
      subject: `[TEST] ${campaign.subject}`,
      html: rendered.html,
      text: rendered.text,
      listUnsubscribe: unsubscribeUrl,
    });

    if (!sendResult.ok) {
      return json({ error: sendResult.error || "test_send_failed" }, 502);
    }

    return json({ ok: true, id: sendResult.id || null });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function postAdminNewsletterCampaignSchedule(
  request: Request,
  env: WorkerEnv,
  campaignIdRaw: string,
): Promise<Response> {
  try {
    requireNewsletterAdmin(request, env);
    const campaignId = decodeURIComponent(campaignIdRaw || "").trim();
    if (!campaignId) return json({ error: "Invalid campaign id" }, 400);

    const body = parseJsonBody<{ at?: unknown }>(
      await request.json<unknown>().catch(() => null),
    );
    const scheduledAtUnix = parseIsoToUnix(body.at);

    const scheduled = await scheduleCampaign(env, campaignId, scheduledAtUnix);
    if (!scheduled) {
      return json({ error: "Campaign not found or cannot be scheduled" }, 409);
    }

    return json({ ok: true, campaign: scheduled });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function postAdminNewsletterCampaignSendNow(
  request: Request,
  env: WorkerEnv,
  campaignIdRaw: string,
): Promise<Response> {
  try {
    requireNewsletterAdmin(request, env);
    const campaignId = decodeURIComponent(campaignIdRaw || "").trim();
    if (!campaignId) return json({ error: "Invalid campaign id" }, 400);

    const scheduled = await scheduleCampaign(env, campaignId, Math.floor(Date.now() / 1000));
    if (!scheduled) {
      return json({ error: "Campaign not found or cannot be scheduled" }, 409);
    }

    return json({ ok: true, campaign: scheduled });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function getAdminNewsletterCampaignStats(
  request: Request,
  env: WorkerEnv,
  campaignIdRaw: string,
): Promise<Response> {
  try {
    requireNewsletterAdmin(request, env);
    const campaignId = decodeURIComponent(campaignIdRaw || "").trim();
    if (!campaignId) return json({ error: "Invalid campaign id" }, 400);

    const campaign = await getCampaignById(env, campaignId);
    if (!campaign) return json({ error: "Campaign not found" }, 404);

    const stats = await getCampaignStats(env, campaignId);
    return json({ ok: true, campaignId, stats });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function getAdminNewsletterSegmentEstimate(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  try {
    requireNewsletterAdmin(request, env);
    const url = new URL(request.url);
    const segment = url.searchParams.get("segment") || "all_subscribers";
    const estimate = await estimateNewsletterSegment(env, segment);
    return json({ ok: true, estimate });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function postAdminNewsletterSubscribersImport(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  try {
    requireNewsletterAdmin(request, env);
    const body = parseJsonBody<{
      source?: unknown;
      consentMode?: unknown;
      rows?: unknown;
    }>(await request.json<unknown>().catch(() => null));

    const source = toText(body.source, "import", 120);
    const consentMode = toText(body.consentMode, "verified", 120).toLowerCase();
    const rows = Array.isArray(body.rows) ? body.rows : [];

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ index: number; reason: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const raw = toObject(rows[index]);
      const email = normalizeEmail(raw.email);
      if (!EMAIL_RE.test(email)) {
        skipped += 1;
        errors.push({ index, reason: "invalid_email" });
        continue;
      }

      if (consentMode !== "verified" && raw.consentVerified !== true) {
        skipped += 1;
        errors.push({ index, reason: "consent_not_verified" });
        continue;
      }

      const tags = normalizeTagList(Array.isArray(raw.tags) ? raw.tags : []);
      const timezone = normalizeTimezone(raw.timezone);
      const auth0Sub = toText(raw.auth0Sub, "", 240);

      await upsertImportedSubscriber(env, {
        email,
        auth0Sub: auth0Sub || undefined,
        timezone,
        tags,
        source,
        active: true,
        consentEvidence: {
          source,
          consentMode,
          importedAt: new Date().toISOString(),
          rawConsentEvidence: toObject(raw.consentEvidence),
        },
      });
      imported += 1;
    }

    return json({
      ok: true,
      source,
      consentMode,
      imported,
      skipped,
      errors,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function postResendWebhook(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  try {
    const secret = toText(env.RESEND_WEBHOOK_SECRET, "", 320);
    if (!secret) {
      return json({ error: "RESEND_WEBHOOK_SECRET missing" }, 503);
    }

    const rawBody = await request.text();
    const verified = await verifyResendWebhookSignature(request, rawBody, secret);
    if (!verified) {
      return json({ error: "Invalid webhook signature" }, 401);
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const parsed = parseWebhookEvent(payload);

    const inserted = await recordWebhookEventIfNew(env, {
      providerEventId: parsed.providerEventId,
      provider: "resend",
      eventType: parsed.eventType,
      payload,
    });

    if (!inserted) {
      return json({ ok: true, deduped: true });
    }

    if (parsed.providerMessageId && parsed.eventType !== "unknown") {
      const applied = await applyWebhookDeliveryEvent(env, {
        providerMessageId: parsed.providerMessageId,
        eventType: parsed.eventType,
      });
      if (applied?.campaignId) {
        await getCampaignStats(env, applied.campaignId);
      }
    }

    if (
      (parsed.eventType === "bounced" || parsed.eventType === "complained") &&
      parsed.recipientEmail
    ) {
      await suppressSubscriberByEmail(env, parsed.recipientEmail);
    }

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function runNewsletterMaintenance(
  env: WorkerEnv,
  nowMs = Date.now(),
): Promise<{
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const nowUnix = Math.floor(nowMs / 1000);
  const claimedIds = await claimDueCampaigns(env, nowUnix, 6);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const campaignId of claimedIds) {
    const campaign = await getCampaignById(env, campaignId);
    if (!campaign) {
      skipped += 1;
      continue;
    }

    const resolved = await resolveNewsletterSegmentSubscribers(env, campaign.audienceSegment);
    await markCampaignSnapshot(env, campaign.id, {
      recipientCount: resolved.subscribers.length,
      subscriberIds: resolved.subscribers.map((subscriber) => subscriber.id),
      generatedAtUnix: nowUnix,
    });

    if (!resolved.subscribers.length) {
      await markCampaignStatus(env, campaign.id, "sent", { sentAtUnix: nowUnix });
      await getCampaignStats(env, campaign.id);
      skipped += 1;
      continue;
    }

    for (const subscriber of resolved.subscribers) {
      await enqueueCampaignDelivery(env, {
        campaignId: campaign.id,
        subscriberId: subscriber.id,
        email: subscriber.email,
      });

      const delivery = await sendCampaignToRecipient(env, {
        campaign,
        subscriberId: subscriber.id,
        email: subscriber.email,
      });

      if (delivery.ok) {
        await markDeliverySent(env, {
          campaignId: campaign.id,
          email: subscriber.email,
          providerMessageId: delivery.providerId,
        });
        sent += 1;
      } else {
        await markDeliveryFailed(env, {
          campaignId: campaign.id,
          email: subscriber.email,
          error: delivery.error,
        });
        failed += 1;
      }
    }

    const pending = await countPendingCampaignDeliveries(env, campaign.id);
    if (pending === 0) {
      await markCampaignCompletedFromDeliveryState(env, campaign.id);
    }
  }

  return {
    claimed: claimedIds.length,
    sent,
    failed,
    skipped,
  };
}
