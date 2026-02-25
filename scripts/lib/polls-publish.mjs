import { readPollsFile } from './polls-store.mjs';

const DEFAULT_API_BY_ENV = {
  prod: 'https://dex-api.spring-fog-8edd.workers.dev',
  test: 'https://dex-api.spring-fog-8edd.workers.dev',
};

function normalizeEnv(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'prod' || raw === 'production') return 'prod';
  if (raw === 'test' || raw === 'sandbox' || raw === 'staging') return 'test';
  throw new Error(`Unsupported publish env: ${value}`);
}

function normalizeBaseUrl(value) {
  const parsed = new URL(String(value || '').trim());
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Unsupported API protocol: ${parsed.protocol}`);
  }
  return parsed.toString().replace(/\/$/, '');
}

function resolveApiBase(envName) {
  const env = normalizeEnv(envName);
  const fromEnv = env === 'prod'
    ? process.env.DEX_POLLS_API_BASE_PROD || process.env.DEX_API_BASE_PROD || process.env.DEX_API_BASE_URL
    : process.env.DEX_POLLS_API_BASE_TEST || process.env.DEX_API_BASE_TEST || process.env.DEX_API_BASE_URL;
  const fallback = DEFAULT_API_BY_ENV[env];
  return normalizeBaseUrl(fromEnv || fallback);
}

function resolveAdminToken(envName) {
  const env = normalizeEnv(envName);
  const direct = env === 'prod'
    ? process.env.DEX_POLLS_SYNC_ADMIN_TOKEN_PROD || process.env.POLL_SYNC_ADMIN_TOKEN_PROD
    : process.env.DEX_POLLS_SYNC_ADMIN_TOKEN_TEST || process.env.POLL_SYNC_ADMIN_TOKEN_TEST;
  const shared = process.env.DEX_POLLS_SYNC_ADMIN_TOKEN || process.env.POLL_SYNC_ADMIN_TOKEN;
  const token = direct || shared;
  if (!token) {
    throw new Error(
      `Missing polls admin token for ${env}. Set DEX_POLLS_SYNC_ADMIN_TOKEN_${env.toUpperCase()} or DEX_POLLS_SYNC_ADMIN_TOKEN.`,
    );
  }
  return String(token).trim();
}

export async function publishPolls({ env = 'test', filePath } = {}) {
  const { data } = await readPollsFile(filePath);
  const apiBase = resolveApiBase(env);
  const token = resolveAdminToken(env);
  const syncUrl = `${apiBase}/admin/polls/sync`;

  const response = await fetch(syncUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      version: data.version,
      updatedAt: data.updatedAt,
      polls: data.polls,
    }),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `Poll sync failed (${response.status}) at ${syncUrl}: ${typeof payload === 'object' ? JSON.stringify(payload) : String(payload)}`,
    );
  }

  return {
    env: normalizeEnv(env),
    apiBase,
    count: Array.isArray(data.polls) ? data.polls.length : 0,
    payload,
  };
}
