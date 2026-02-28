const LOOKUP_BUCKET_NUMBER_PATTERN = /^[A-Z]\.[A-Za-z0-9._-]{1,64}$/i;
const LOOKUP_SUBMISSION_PATTERN = /^SUB\d{2,4}-[A-Z]\.[A-Za-z]{3}\s[A-Za-z]{2}\s(?:AV|A|V|O)\d{4}$/i;
const LOOKUP_CATALOG_PATTERN = /^[A-Z]\.[A-Za-z]{3}\.\s[A-Za-z]{2}\s(?:AV|A|V|O)\d{4}(?:\sS\d+)?$/i;
const ASSET_OR_BUNDLE_VALUE_PATTERN = /^[A-Za-z0-9._:-]{3,160}$/;

function toText(value) {
  return String(value ?? '').trim();
}

function baseError(message, context = '') {
  const scope = toText(context);
  if (!scope) return new Error(message);
  return new Error(`${scope}: ${message}`);
}

function parseLookupValue(value, context = '') {
  const raw = toText(value);
  if (!raw) {
    throw baseError('lookup token value is required', context);
  }
  if (
    LOOKUP_BUCKET_NUMBER_PATTERN.test(raw)
    || LOOKUP_SUBMISSION_PATTERN.test(raw)
    || LOOKUP_CATALOG_PATTERN.test(raw)
  ) {
    return raw;
  }
  throw baseError(`invalid lookup token value "${raw}"`, context);
}

function parseAssetOrBundleValue(value, kind, context = '') {
  const raw = toText(value);
  if (!raw) {
    throw baseError(`${kind} token value is required`, context);
  }
  if (!ASSET_OR_BUNDLE_VALUE_PATTERN.test(raw)) {
    throw baseError(`invalid ${kind} token value "${raw}"`, context);
  }
  return raw;
}

export function parseAssetReferenceToken(value, { context = '' } = {}) {
  const raw = toText(value);
  if (!raw) {
    throw baseError('asset reference token is required', context);
  }
  if (/^https?:\/\//i.test(raw)) {
    throw baseError('asset reference token cannot be a URL', context);
  }

  const colonIndex = raw.indexOf(':');
  if (colonIndex <= 0 || colonIndex === raw.length - 1) {
    throw baseError(`unsupported token "${raw}" (expected lookup:/asset:/bundle:)`, context);
  }

  const prefix = raw.slice(0, colonIndex).toLowerCase();
  const tokenValue = raw.slice(colonIndex + 1).trim();

  if (prefix === 'lookup') {
    const parsedLookup = parseLookupValue(tokenValue, context);
    return {
      raw,
      kind: 'lookup',
      value: parsedLookup,
      normalized: `lookup:${parsedLookup}`,
    };
  }
  if (prefix === 'asset' || prefix === 'bundle') {
    const parsedValue = parseAssetOrBundleValue(tokenValue, prefix, context);
    return {
      raw,
      kind: prefix,
      value: parsedValue,
      normalized: `${prefix}:${parsedValue}`,
    };
  }

  throw baseError(`unsupported token prefix "${prefix}" (expected lookup:/asset:/bundle:)`, context);
}

export function isAssetReferenceToken(value) {
  try {
    parseAssetReferenceToken(value);
    return true;
  } catch {
    return false;
  }
}

export function assertAssetReferenceToken(value, context = '') {
  return parseAssetReferenceToken(value, { context });
}

