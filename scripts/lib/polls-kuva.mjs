let kuvaModulePromise = null;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function padRight(value, width) {
  const text = String(value ?? '');
  if (text.length >= width) return text;
  return `${text}${' '.repeat(width - text.length)}`;
}

function normalizeSeries(series = []) {
  return Array.isArray(series)
    ? series.map((item) => ({
      t: String(item?.t || item?.timestamp || item?.bucket || '').trim(),
      value: toNumber(item?.value ?? item?.total ?? item?.count, 0),
    }))
      .filter((item) => item.t)
    : [];
}

function fallbackLineChart(series = [], { title = 'Trend', width = 36 } = {}) {
  const points = normalizeSeries(series);
  const max = points.reduce((acc, item) => Math.max(acc, item.value), 0);
  const safeMax = max > 0 ? max : 1;
  const rows = points.map((item) => {
    const ratio = Math.max(0, Math.min(1, item.value / safeMax));
    const bars = Math.round(ratio * width);
    return `${padRight(item.t, 12)} ${String(item.value).padStart(4)} ${'█'.repeat(bars)}${'░'.repeat(Math.max(0, width - bars))}`;
  });
  return [title, ...rows].join('\n');
}

function fallbackStackedChart(seriesByOption = {}, { title = 'Trend (stacked)', width = 26 } = {}) {
  const optionKeys = Object.keys(seriesByOption || {});
  if (!optionKeys.length) return `${title}\n(no data)`;
  const byTime = new Map();
  for (const optionKey of optionKeys) {
    const series = normalizeSeries(seriesByOption[optionKey]);
    for (const point of series) {
      if (!byTime.has(point.t)) byTime.set(point.t, {});
      byTime.get(point.t)[optionKey] = point.value;
    }
  }
  const timeLabels = Array.from(byTime.keys()).sort();
  const rows = [];
  for (const label of timeLabels) {
    const row = byTime.get(label) || {};
    const total = optionKeys.reduce((sum, key) => sum + toNumber(row[key], 0), 0);
    const safeTotal = total > 0 ? total : 1;
    const segments = optionKeys.map((key, index) => {
      const value = toNumber(row[key], 0);
      const ratio = value / safeTotal;
      const bars = Math.max(0, Math.round(ratio * width));
      const glyph = ['█', '▓', '▒', '░'][index % 4];
      return `${glyph.repeat(bars)}`;
    }).join('');
    const normalizedSegments = segments.length > width
      ? segments.slice(0, width)
      : `${segments}${' '.repeat(Math.max(0, width - segments.length))}`;
    rows.push(`${padRight(label, 12)} ${String(total).padStart(4)} ${normalizedSegments}`);
  }
  rows.push('');
  rows.push(`Legend: ${optionKeys.map((key, index) => `${['█', '▓', '▒', '░'][index % 4]}=${key}`).join('  ')}`);
  return [title, ...rows].join('\n');
}

function fallbackVelocityChart(series = [], { title = 'Trend velocity', width = 32 } = {}) {
  const points = normalizeSeries(series);
  const rows = [];
  let prev = null;
  for (const point of points) {
    const delta = prev == null ? 0 : point.value - prev;
    const magnitude = Math.min(width, Math.abs(delta));
    const glyph = delta >= 0 ? '+' : '-';
    rows.push(`${padRight(point.t, 12)} ${String(point.value).padStart(4)} Δ${String(delta).padStart(4)} ${glyph.repeat(magnitude)}`);
    prev = point.value;
  }
  return [title, ...rows].join('\n');
}

async function loadKuva() {
  if (kuvaModulePromise) return kuvaModulePromise;
  kuvaModulePromise = import('kuva').catch(() => null);
  return kuvaModulePromise;
}

function tryKuvaRender(module, kind, input, opts) {
  if (!module || typeof module !== 'object') return '';
  const candidates = [
    module?.[kind],
    module?.default?.[kind],
    module?.render?.[kind],
  ].filter((candidate) => typeof candidate === 'function');
  for (const candidate of candidates) {
    try {
      const rendered = candidate(input, opts || {});
      if (typeof rendered === 'string' && rendered.trim()) return rendered;
    } catch {
      // fall through
    }
  }
  return '';
}

export async function renderLineTrend(series = [], opts = {}) {
  const kuva = await loadKuva();
  const rendered = tryKuvaRender(kuva, 'line', series, opts);
  if (rendered) return rendered;
  return fallbackLineChart(series, opts);
}

export async function renderStackedOptionTrend(seriesByOption = {}, opts = {}) {
  const kuva = await loadKuva();
  const rendered = tryKuvaRender(kuva, 'stacked', seriesByOption, opts);
  if (rendered) return rendered;
  return fallbackStackedChart(seriesByOption, opts);
}

export async function renderVelocityTrend(series = [], opts = {}) {
  const kuva = await loadKuva();
  const rendered = tryKuvaRender(kuva, 'velocity', series, opts);
  if (rendered) return rendered;
  return fallbackVelocityChart(series, opts);
}
