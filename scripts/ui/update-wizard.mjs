import fs from 'node:fs/promises';
import path from 'node:path';
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { prepareTemplate } from '../lib/init-core.mjs';
import { loadTagsCatalog } from '../lib/tags.mjs';
import { readEntryFolder, writeEntryFolder, normalizeManifestWithFormats, generateIndexHtml } from '../lib/entry-store.mjs';
import { isBackspaceKey, shouldAppendWizardChar } from '../lib/input-guard.mjs';
import { computeWindow } from './rolodex.mjs';

const CHECKS = ['Title', 'Description', 'Lookup #', 'Video URL', 'Series', 'Buckets', 'License sentence', 'Instruments', 'Credits / People', 'Downloads', 'File Specs', 'Metadata'];

function toPeople(list = []) { return list.map((name) => ({ name, links: [] })); }
function mapSeriesToImage(series) {
  if (series === 'dex') return '/assets/series/dex.png';
  if (series === 'inDex') return '/assets/series/index.png';
  if (series === 'dexFest') return '/assets/series/dexfest.png';
  return '/assets/series/dex.png';
}

export function UpdateWizard({ initialSlug = '', onDone, onCancel }) {
  const [entries, setEntries] = useState([]);
  const [slug, setSlug] = useState(initialSlug);
  const [stage, setStage] = useState(initialSlug ? 'checklist' : 'select');
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [checks, setChecks] = useState(CHECKS.map((label) => ({ label, selected: false })));
  const [form, setForm] = useState(null);
  const [fieldCursor, setFieldCursor] = useState(0);
  const [msg, setMsg] = useState('');
  const [tagsCatalog, setTagsCatalog] = useState([]);

  useEffect(() => { void fs.readdir(path.resolve('./entries'), { withFileTypes: true }).then((dirs) => setEntries(dirs.filter((d) => d.isDirectory()).map((d) => d.name).sort())).catch(() => setEntries([])); }, []);
  useEffect(() => { void loadTagsCatalog().then(setTagsCatalog); }, []);

  const filtered = useMemo(() => {
    if (!query) return entries;
    return entries.filter((s) => s.toLowerCase().includes(query.toLowerCase()));
  }, [entries, query]);

  const selectedSections = checks.filter((c) => c.selected).map((c) => c.label);

  async function loadForm(targetSlug) {
    const payload = await readEntryFolder(targetSlug, { entriesDir: './entries' });
    const last = JSON.parse(await fs.readFile(path.join(path.resolve('./entries'), '.dex-last.json'), 'utf8').catch(() => '{}'));
    const instruments = Array.isArray(last.lastInstruments) && last.lastInstruments.length ? last.lastInstruments : (payload.entry.sidebarPageConfig?.credits?.instruments || []);
    const credits = payload.entry.sidebarPageConfig?.credits || {};
    setForm({
      payload,
      title: payload.entry.title || '',
      descriptionText: payload.descriptionText || payload.entry.descriptionText || '',
      lookupNumber: payload.entry.sidebarPageConfig?.lookupNumber || '',
      videoUrl: payload.entry.video?.dataUrl || '',
      series: payload.entry.series || 'dex',
      buckets: payload.entry.selectedBuckets || payload.entry.sidebarPageConfig?.buckets || ['A'],
      attributionSentence: payload.entry.sidebarPageConfig?.attributionSentence || '',
      instruments,
      credits,
      metadataTags: payload.entry.metadata?.tags || payload.entry.sidebarPageConfig?.metadata?.tags || [],
    });
  }

  async function saveAll() {
    const { formatKeys, templateHtml } = await prepareTemplate({});
    const entry = { ...form.payload.entry };
    if (selectedSections.includes('Title')) entry.title = form.title;
    if (selectedSections.includes('Description')) entry.descriptionText = form.descriptionText;
    if (selectedSections.includes('Lookup #')) entry.sidebarPageConfig.lookupNumber = form.lookupNumber;
    if (selectedSections.includes('Video URL')) entry.video = { mode: 'url', dataUrl: form.videoUrl, dataHtml: `<iframe src="${form.videoUrl}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>` };
    if (selectedSections.includes('Series')) {
      entry.series = form.series;
      entry.sidebarPageConfig.specialEventImage = mapSeriesToImage(form.series);
    }
    if (selectedSections.includes('Buckets')) { entry.selectedBuckets = form.buckets; entry.sidebarPageConfig.buckets = form.buckets; }
    if (selectedSections.includes('License sentence')) entry.sidebarPageConfig.attributionSentence = form.attributionSentence;
    if (selectedSections.includes('Instruments')) entry.sidebarPageConfig.credits.instruments = form.instruments;
    if (selectedSections.includes('Credits / People')) {
      entry.sidebarPageConfig.credits.artist = toPeople((entry.creditsData?.artist || ['']));
      entry.sidebarPageConfig.credits.video = {
        director: toPeople(entry.creditsData?.video?.director || ['']),
        cinematography: toPeople(entry.creditsData?.video?.cinematography || ['']),
        editing: toPeople(entry.creditsData?.video?.editing || ['']),
      };
      entry.sidebarPageConfig.credits.audio = {
        recording: toPeople(entry.creditsData?.audio?.recording || ['']),
        mix: toPeople(entry.creditsData?.audio?.mix || ['']),
        master: toPeople(entry.creditsData?.audio?.master || ['']),
      };
    }
    if (selectedSections.includes('Metadata')) {
      entry.metadata = { ...(entry.metadata || {}), tags: form.metadataTags };
      entry.sidebarPageConfig.metadata = { ...(entry.sidebarPageConfig.metadata || {}), tags: form.metadataTags };
    }

    const manifest = normalizeManifestWithFormats(form.payload.manifest, formatKeys);
    const indexHtml = generateIndexHtml({ templateHtml, entry, descriptionText: entry.descriptionText || form.descriptionText, manifest });
    const res = await writeEntryFolder(slug, { entry, descriptionText: entry.descriptionText || form.descriptionText, manifest, indexHtml }, { entriesDir: './entries' });
    setMsg(`Updated ${slug}: ${res.wroteFiles.length} files`);
    if (onDone) onDone({ slug, wroteFiles: res.wroteFiles });
  }

  useInput((input, key) => {
    if (stage === 'select') {
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow) setCursor((c) => Math.min(filtered.length - 1, c + 1));
      else if (key.return) {
        const chosen = filtered[cursor];
        if (!chosen) return;
        setSlug(chosen);
        void loadForm(chosen).then(() => setStage('checklist'));
      } else if (isBackspaceKey(input, key)) setQuery((q) => q.slice(0, -1));
      else if (shouldAppendWizardChar(input, key)) setQuery((q) => q + input);
      return;
    }
    if (stage === 'checklist') {
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow) setCursor((c) => Math.min(checks.length - 1, c + 1));
      else if (input === ' ') setChecks((c) => c.map((it, i) => (i === cursor ? { ...it, selected: !it.selected } : it)));
      else if (key.return) { setStage('edit'); setFieldCursor(0); }
      return;
    }
    if (stage === 'edit') {
      const fields = selectedSections;
      if (key.upArrow) setFieldCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow) setFieldCursor((c) => Math.min(fields.length - 1, c + 1));
      else if (key.return && fieldCursor >= fields.length - 1) setStage('review');
      else if (shouldAppendWizardChar(input, key)) {
        const field = fields[fieldCursor];
        if (field === 'Title') setForm((f) => ({ ...f, title: `${f.title}${input}` }));
        if (field === 'Description') setForm((f) => ({ ...f, descriptionText: `${f.descriptionText}${input}` }));
      } else if (isBackspaceKey(input, key)) {
        const field = fields[fieldCursor];
        if (field === 'Title') setForm((f) => ({ ...f, title: f.title.slice(0, -1) }));
        if (field === 'Description') setForm((f) => ({ ...f, descriptionText: f.descriptionText.slice(0, -1) }));
      } else if (key.ctrl && (input === 'p' || input === 'P')) {
        setMsg('Paste mode toggled (Ctrl+P).');
      } else if (key.ctrl && (input === 'g' || input === 'G')) {
        setMsg('Channel cycle (Ctrl+G).');
      }
      return;
    }
    if (stage === 'review' && key.ctrl && (input === 's' || input === 'S')) {
      void saveAll();
    }
    if (key.escape && onCancel) onCancel();
  });

  if (stage === 'select') {
    const w = computeWindow({ total: filtered.length, cursor, height: 10 });
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, {}, `Select entry: ${query}`),
      ...filtered.slice(w.start, w.end).map((s, i) => React.createElement(Text, cursor === (w.start + i) ? { key: s, inverse: true } : { key: s }, s)),
    );
  }

  if (stage === 'checklist') {
    const w = computeWindow({ total: checks.length, cursor, height: 10 });
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, {}, `Update checklist for ${slug}`),
      ...checks.slice(w.start, w.end).map((c, i) => React.createElement(Text, cursor === (w.start + i) ? { key: c.label, inverse: true } : { key: c.label }, `[${c.selected ? 'x' : ' '}] ${c.label}`)),
      React.createElement(Text, { color: '#6e7688' }, 'Space toggle   Enter continue'),
    );
  }

  if (stage === 'edit') {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, {}, `Editing ${slug}`),
      ...selectedSections.map((s, i) => React.createElement(Text, fieldCursor === i ? { key: s, inverse: true } : { key: s }, `${s}${s === 'Metadata' ? `: ${form.metadataTags.filter((t) => tagsCatalog.includes(t)).join(', ')}` : ''}`)),
      React.createElement(Text, { color: '#6e7688' }, 'Ctrl+P paste mode   Ctrl+G cycle channels'),
      msg ? React.createElement(Text, { color: '#a6e3a1' }, msg) : null,
    );
  }

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Text, {}, `Review ${slug}`),
    React.createElement(Text, {}, `Sections: ${selectedSections.join(', ') || '(none)'}`),
    React.createElement(Text, {}, 'Ctrl+S save and regenerate index.html'),
    msg ? React.createElement(Text, { color: '#a6e3a1' }, msg) : null,
  );
}
