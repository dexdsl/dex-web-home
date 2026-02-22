import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RAW_PATH = path.join(ROOT, 'artifacts', 'style-inventory.raw.json');
const DEDUP_PATH = path.join(ROOT, 'artifacts', 'style-inventory.dedup.json');
const TOKENS_JSON_PATH = path.join(ROOT, 'tokens.candidates.json');
const TOKENS_CSS_PATH = path.join(ROOT, 'css', 'tokens.css');

const COLOR_FIELDS = [
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'textDecorationColor',
  'fill',
  'stroke',
];

const SPACE_FIELDS = [
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'gap',
  'rowGap',
  'columnGap',
];

const RADIUS_FIELDS = [
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
];

const BORDER_WIDTH_FIELDS = [
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
];

const SHADOW_FIELDS = ['boxShadow'];

const TYPO_FIELDS = ['fontSize', 'lineHeight', 'letterSpacing', 'fontWeight', 'fontStyle', 'textTransform'];

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureFiles() {
  if (!fs.existsSync(RAW_PATH)) {
    throw new Error('Missing artifacts/style-inventory.raw.json. Run phase2:inventory first.');
  }
  fs.mkdirSync(path.dirname(DEDUP_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(TOKENS_CSS_PATH), { recursive: true });
}

function deduplicate(raw) {
  const fieldMap = new Map();

  for (const entry of raw) {
    const provenance = {
      page: entry.page,
      viewport: entry.viewport,
      role: entry.role,
      selectorHint: entry.selectorHint,
    };

    for (const [field, value] of Object.entries(entry.styles || {})) {
      if (!fieldMap.has(field)) {
        fieldMap.set(field, new Map());
      }
      const valueMap = fieldMap.get(field);
      const val = value ?? '';
      if (!valueMap.has(val)) {
        valueMap.set(val, { count: 0, examples: [] });
      }
      const meta = valueMap.get(val);
      meta.count += 1;
      if (meta.examples.length < 10) {
        meta.examples.push(provenance);
      }
    }
  }

  const fields = {};
  const sortedFieldNames = Array.from(fieldMap.keys()).sort();
  for (const field of sortedFieldNames) {
    const values = fieldMap.get(field);
    const sortedValues = Array.from(values.entries()).sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return a[0].localeCompare(b[0]);
    });
    const valueObj = {};
    for (const [val, meta] of sortedValues) {
      valueObj[val] = meta;
    }
    fields[field] = valueObj;
  }

  const dedup = { fields };
  fs.writeFileSync(DEDUP_PATH, JSON.stringify(dedup, null, 2));
  return dedup;
}

function aggregateColors(dedup) {
  const map = new Map();
  for (const field of COLOR_FIELDS) {
    const values = dedup.fields[field];
    if (!values) continue;
    for (const [val, meta] of Object.entries(values)) {
      const existing = map.get(val) || { count: 0, examples: [] };
      existing.count += meta.count;
      if (existing.examples.length < 10) {
        existing.examples.push(...meta.examples.slice(0, 10 - existing.examples.length));
      }
      map.set(val, existing);
    }
  }
  return map;
}

function normalizePx(value) {
  if (typeof value !== 'string') return null;
  if (!value.trim().endsWith('px')) return null;
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return null;
  const normalized = Math.round(num * 2) / 2;
  return `${normalized}px`;
}

function aggregateNumeric(dedup, fields) {
  const map = new Map();
  for (const field of fields) {
    const values = dedup.fields[field];
    if (!values) continue;
    for (const [val, meta] of Object.entries(values)) {
      const normalized = normalizePx(val);
      if (!normalized) continue;
      const existing = map.get(normalized) || { count: 0, examples: [] };
      existing.count += meta.count;
      if (existing.examples.length < 10) {
        existing.examples.push(...meta.examples.slice(0, 10 - existing.examples.length));
      }
      map.set(normalized, existing);
    }
  }
  return map;
}

function aggregateShadows(dedup) {
  const map = new Map();
  for (const field of SHADOW_FIELDS) {
    const values = dedup.fields[field];
    if (!values) continue;
    for (const [val, meta] of Object.entries(values)) {
      const existing = map.get(val) || { count: 0, examples: [] };
      existing.count += meta.count;
      if (existing.examples.length < 10) {
        existing.examples.push(...meta.examples.slice(0, 10 - existing.examples.length));
      }
      map.set(val, existing);
    }
  }
  return map;
}

function aggregateTypography(raw) {
  const map = new Map();
  for (const entry of raw) {
    const styles = entry.styles || {};
    const keyParts = TYPO_FIELDS.map((k) => styles[k] || '');
    const tupleKey = keyParts.join('||');
    if (!map.has(tupleKey)) {
      map.set(tupleKey, {
        count: 0,
        values: {
          fontSize: styles.fontSize || '',
          lineHeight: styles.lineHeight || '',
          letterSpacing: styles.letterSpacing || '',
          fontWeight: styles.fontWeight || '',
          fontStyle: styles.fontStyle || '',
          textTransform: styles.textTransform || '',
        },
        examples: [],
      });
    }
    const meta = map.get(tupleKey);
    meta.count += 1;
    if (meta.examples.length < 10) {
      meta.examples.push({
        page: entry.page,
        viewport: entry.viewport,
        role: entry.role,
        selectorHint: entry.selectorHint,
      });
    }
  }
  return map;
}

function toSortedArray(map) {
  return Array.from(map.entries())
    .sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return String(a[0]).localeCompare(String(b[0]));
    })
    .map(([value, meta], idx) => ({ value, ...meta, order: idx + 1 }));
}

function buildTokens({ colors, spaces, radii, borders, shadows, typography }) {
  const tokens = {
    colors: [],
    typography: [],
    spaces: [],
    radii: [],
    borders: [],
    shadows: [],
  };

  for (const entry of colors) {
    const name = `--color-${String(entry.order).padStart(3, '0')}`;
    tokens.colors.push({ name, value: entry.value, type: 'color', frequency: entry.count, examples: entry.examples });
  }

  let textIndex = 1;
  for (const entry of typography) {
    const baseName = `--text-${String(textIndex).padStart(3, '0')}`;
    const common = { type: 'text', frequency: entry.count, examples: entry.examples };
    tokens.typography.push({ name: `${baseName}-font-size`, value: entry.values.fontSize, ...common });
    tokens.typography.push({ name: `${baseName}-line-height`, value: entry.values.lineHeight, ...common });
    tokens.typography.push({ name: `${baseName}-letter-spacing`, value: entry.values.letterSpacing, ...common });
    tokens.typography.push({ name: `${baseName}-weight`, value: entry.values.fontWeight, ...common });
    tokens.typography.push({ name: `${baseName}-style`, value: entry.values.fontStyle, ...common });
    tokens.typography.push({ name: `${baseName}-transform`, value: entry.values.textTransform, ...common });
    textIndex += 1;
  }

  for (const entry of spaces) {
    const name = `--space-${String(entry.order).padStart(3, '0')}`;
    tokens.spaces.push({ name, value: entry.value, type: 'space', frequency: entry.count, examples: entry.examples });
  }

  for (const entry of radii) {
    const name = `--radius-${String(entry.order).padStart(3, '0')}`;
    tokens.radii.push({ name, value: entry.value, type: 'radius', frequency: entry.count, examples: entry.examples });
  }

  for (const entry of borders) {
    const name = `--border-${String(entry.order).padStart(3, '0')}`;
    tokens.borders.push({ name, value: entry.value, type: 'border', frequency: entry.count, examples: entry.examples });
  }

  for (const entry of shadows) {
    const name = `--shadow-${String(entry.order).padStart(3, '0')}`;
    tokens.shadows.push({ name, value: entry.value, type: 'shadow', frequency: entry.count, examples: entry.examples });
  }

  return tokens;
}

function writeTokensCSS(tokens) {
  const lines = [':root {'];

  for (const token of tokens.colors) {
    lines.push(`  ${token.name}: ${token.value};`);
  }

  const groupedText = {};
  for (const token of tokens.typography) {
    const [, group] = token.name.match(/^--text-(\d{3})/) || [];
    if (!group) continue;
    if (!groupedText[group]) groupedText[group] = [];
    groupedText[group].push(token);
  }
  const orderedTextGroups = Object.keys(groupedText).sort();
  for (const group of orderedTextGroups) {
    const parts = groupedText[group].sort((a, b) => a.name.localeCompare(b.name));
    for (const token of parts) {
      lines.push(`  ${token.name}: ${token.value};`);
    }
  }

  for (const token of tokens.spaces) {
    lines.push(`  ${token.name}: ${token.value};`);
  }

  for (const token of tokens.radii) {
    lines.push(`  ${token.name}: ${token.value};`);
  }

  for (const token of tokens.borders) {
    lines.push(`  ${token.name}: ${token.value};`);
  }

  for (const token of tokens.shadows) {
    lines.push(`  ${token.name}: ${token.value};`);
  }

  lines.push('}');
  fs.writeFileSync(TOKENS_CSS_PATH, lines.join('\n'));
}

function summarize(tokens) {
  const topColors = tokens.colors.slice(0, 10).map((t) => `${t.name}=${t.value} (${t.frequency})`);
  const topSpaces = tokens.spaces.slice(0, 10).map((t) => `${t.name}=${t.value} (${t.frequency})`);

  console.log('Token candidates generated.');
  console.log(`Colors: ${tokens.colors.length}`);
  console.log(`Typography groups: ${tokens.typography.length / 6}`);
  console.log(`Spaces: ${tokens.spaces.length}`);
  console.log(`Radii: ${tokens.radii.length}`);
  console.log(`Borders: ${tokens.borders.length}`);
  console.log(`Shadows: ${tokens.shadows.length}`);
  console.log('Top colors:', topColors.join(', '));
  console.log('Top spaces:', topSpaces.join(', '));
}

function main() {
  ensureFiles();
  const raw = readJSON(RAW_PATH);
  const dedup = deduplicate(raw);

  const colorMap = aggregateColors(dedup);
  const spaceMap = aggregateNumeric(dedup, SPACE_FIELDS);
  const radiusMap = aggregateNumeric(dedup, RADIUS_FIELDS);
  const borderMap = aggregateNumeric(dedup, BORDER_WIDTH_FIELDS);
  const shadowMap = aggregateShadows(dedup);
  const typographyMap = aggregateTypography(raw);

  const colors = toSortedArray(colorMap);
  const spaces = toSortedArray(spaceMap);
  const radii = toSortedArray(radiusMap);
  const borders = toSortedArray(borderMap);
  const shadows = toSortedArray(shadowMap);
  const typography = toSortedArray(typographyMap);

  const tokens = buildTokens({ colors, spaces, radii, borders, shadows, typography });
  fs.writeFileSync(TOKENS_JSON_PATH, JSON.stringify(tokens, null, 2));
  writeTokensCSS(tokens);
  summarize(tokens);
}

main();
