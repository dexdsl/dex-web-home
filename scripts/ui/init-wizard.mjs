import fs from 'node:fs/promises';
import path from 'node:path';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { BUCKETS, slugify } from '../lib/entry-schema.mjs';
import { prepareTemplate, writeEntryFromData } from '../lib/init-core.mjs';

function iframeFor(url) {
  return `<iframe src="${url}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
}

function defaultSidebar() {
  return {
    lookupNumber: '',
    buckets: ['A'],
    specialEventImage: null,
    attributionSentence: '',
    credits: {
      artist: { name: '', links: [] },
      artistAlt: null,
      instruments: [],
      video: { director: { name: '', links: [] }, cinematography: { name: '', links: [] }, editing: { name: '', links: [] } },
      audio: { recording: { name: '', links: [] }, mix: { name: '', links: [] }, master: { name: '', links: [] } },
      year: new Date().getUTCFullYear(),
      season: 'S1',
      location: '',
    },
    fileSpecs: { bitDepth: 24, sampleRate: 48000, channels: 'stereo', staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' } },
    metadata: { sampleLength: '', tags: [] },
  };
}

const STEPS = [
  { id: 'title', label: 'Title', kind: 'text' },
  { id: 'slug', label: 'Slug', kind: 'text' },
  { id: 'lookupNumber', label: 'Lookup number', kind: 'text' },
  { id: 'videoUrl', label: 'Video URL', kind: 'text' },
  { id: 'descriptionHtml', label: 'Description', kind: 'textarea' },
  { id: 'buckets', label: 'Buckets', kind: 'multi' },
  { id: 'attributionSentence', label: 'Attribution sentence', kind: 'text' },
  { id: 'artistName', label: 'Artist name', kind: 'text' },
  { id: 'year', label: 'Year', kind: 'text' },
  { id: 'season', label: 'Season', kind: 'text' },
  { id: 'location', label: 'Location', kind: 'text' },
  { id: 'specialEventImage', label: 'Special event image URL (optional)', kind: 'text' },
  { id: 'manifestRaw', label: 'Manifest JSON', kind: 'textarea' },
  { id: 'authEnabled', label: 'Ensure auth snippet?', kind: 'toggle' },
  { id: 'summary', label: 'Summary', kind: 'summary' },
];

function withCaret(value, cursor, caretOn) {
  const safe = value || '';
  if (!caretOn) return safe;
  return `${safe.slice(0, cursor)}▌${safe.slice(cursor)}`;
}

function validateStep(stepId, form) {
  if (stepId === 'title' && !form.title.trim()) return 'Title is required.';
  if (stepId === 'slug' && !form.slug.trim()) return 'Slug is required.';
  if (stepId === 'lookupNumber' && !form.lookupNumber.trim()) return 'Lookup number is required.';
  if (stepId === 'videoUrl' && !form.videoUrl.trim()) return 'Video URL is required.';
  if (stepId === 'buckets' && form.buckets.length < 1) return 'Select at least one bucket.';
  if (stepId === 'attributionSentence' && !form.attributionSentence.trim()) return 'Attribution sentence is required.';
  if (stepId === 'artistName' && !form.artistName.trim()) return 'Artist name is required.';
  if (stepId === 'year') {
    if (!form.year.trim()) return 'Year is required.';
    if (Number.isNaN(Number(form.year))) return 'Year must be a number.';
  }
  if (stepId === 'season' && !form.season.trim()) return 'Season is required.';
  if (stepId === 'location' && !form.location.trim()) return 'Location is required.';
  if (stepId === 'manifestRaw') {
    try { JSON.parse(form.manifestRaw || '{}'); } catch { return 'Manifest must be valid JSON.'; }
  }
  return '';
}

export function InitWizard({ templateArg, outDirDefault, onCancel, onDone }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [caretOn, setCaretOn] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusLines, setStatusLines] = useState([]);
  const [doneReport, setDoneReport] = useState(null);
  const [multiCursor, setMultiCursor] = useState(0);
  const templateRef = useRef(null);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    slugTouched: false,
    lookupNumber: '',
    videoUrl: '',
    descriptionHtml: '<p></p>',
    buckets: ['A'],
    attributionSentence: '',
    artistName: '',
    year: `${new Date().getUTCFullYear()}`,
    season: 'S1',
    location: '',
    specialEventImage: '',
    manifestRaw: '{}',
    authEnabled: true,
  });
  const [cursorByStep, setCursorByStep] = useState({
    title: 0,
    slug: 0,
    lookupNumber: 0,
    videoUrl: 0,
    descriptionHtml: 0,
    attributionSentence: 0,
    artistName: 0,
    year: `${new Date().getUTCFullYear()}`.length,
    season: 2,
    location: 0,
    specialEventImage: 0,
    manifestRaw: 2,
  });

  const step = STEPS[stepIdx];
  const totalSteps = STEPS.length;

  useEffect(() => {
    if (process.env.DEX_NO_ANIM === '1') return undefined;
    const id = setInterval(() => setCaretOn((prev) => !prev), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!form.slugTouched) {
      const nextSlug = slugify(form.title || '');
      setForm((prev) => ({ ...prev, slug: nextSlug }));
      setCursorByStep((prev) => ({ ...prev, slug: nextSlug.length }));
    }
  }, [form.title, form.slugTouched]);

  const inputValue = step?.kind === 'text' || step?.kind === 'textarea' ? form[step.id] ?? '' : '';
  const cursor = cursorByStep[step?.id] ?? 0;

  const footer = useMemo(() => {
    if (doneReport) return 'Enter return to menu • Ctrl+C quit';
    if (step.kind === 'multi') return 'Space toggle • ↑/↓ move • Enter next • Esc back • Ctrl+C quit';
    if (step.kind === 'textarea') return 'Enter newline • Ctrl+Enter next • Esc back • Ctrl+C quit';
    if (step.kind === 'summary') return 'Enter generate • Esc back • Ctrl+C quit';
    if (step.kind === 'toggle') return 'Space toggle • Enter next • Esc back • Ctrl+C quit';
    return 'Enter next • Esc back • Ctrl+C quit';
  }, [doneReport, step.kind]);

  const shiftStep = (delta) => {
    setError('');
    setStepIdx((prev) => Math.max(0, Math.min(totalSteps - 1, prev + delta)));
  };

  const insertChar = (char) => {
    const value = form[step.id] ?? '';
    const pos = cursorByStep[step.id] ?? 0;
    const next = `${value.slice(0, pos)}${char}${value.slice(pos)}`;
    setForm((prev) => ({ ...prev, [step.id]: next, ...(step.id === 'slug' ? { slugTouched: true } : {}) }));
    setCursorByStep((prev) => ({ ...prev, [step.id]: pos + char.length }));
    setError('');
  };

  const mutateAtCursor = (mode) => {
    const value = form[step.id] ?? '';
    const pos = cursorByStep[step.id] ?? 0;
    if (mode === 'backspace' && pos > 0) {
      setForm((prev) => ({ ...prev, [step.id]: `${value.slice(0, pos - 1)}${value.slice(pos)}`, ...(step.id === 'slug' ? { slugTouched: true } : {}) }));
      setCursorByStep((prev) => ({ ...prev, [step.id]: pos - 1 }));
    }
    if (mode === 'delete' && pos < value.length) {
      setForm((prev) => ({ ...prev, [step.id]: `${value.slice(0, pos)}${value.slice(pos + 1)}`, ...(step.id === 'slug' ? { slugTouched: true } : {}) }));
    }
  };

  const maybeAdvance = async () => {
    const validation = validateStep(step.id, form);
    if (validation) {
      setError(validation);
      return;
    }

    if (step.id === 'slug') {
      const outDir = path.resolve(outDirDefault || './entries');
      const base = slugify(form.slug.trim());
      const deduped = await (async () => {
        const exists = new Set();
        try {
          const dirs = await fs.readdir(outDir, { withFileTypes: true });
          dirs.filter((d) => d.isDirectory()).forEach((d) => exists.add(d.name));
        } catch {}
        if (!exists.has(base)) return base;
        let i = 2;
        while (exists.has(`${base}-${i}`)) i += 1;
        return `${base}-${i}`;
      })();
      if (deduped !== form.slug) {
        setForm((prev) => ({ ...prev, slug: deduped, slugTouched: true }));
        setCursorByStep((prev) => ({ ...prev, slug: deduped.length }));
      }
    }

    if (step.id === 'summary') {
      setBusy(true);
      setError('');
      try {
        if (!templateRef.current) templateRef.current = await prepareTemplate({ templateArg });
        const manifest = JSON.parse(form.manifestRaw || '{}');
        const sidebar = defaultSidebar();
        sidebar.lookupNumber = form.lookupNumber;
        sidebar.buckets = form.buckets;
        sidebar.specialEventImage = form.specialEventImage || null;
        sidebar.attributionSentence = form.attributionSentence;
        sidebar.credits.artist.name = form.artistName;
        sidebar.credits.year = Number(form.year);
        sidebar.credits.season = form.season;
        sidebar.credits.location = form.location;

        const { report } = await writeEntryFromData({
          templatePath: templateRef.current.templatePath,
          templateHtml: templateRef.current.templateHtml,
          data: {
            slug: form.slug,
            title: form.title,
            video: { mode: 'url', dataUrl: form.videoUrl, dataHtml: iframeFor(form.videoUrl) },
            descriptionHtml: form.descriptionHtml || '<p></p>',
            sidebar,
            manifest,
            authEnabled: form.authEnabled,
            outDir: path.resolve(outDirDefault || './entries'),
          },
          opts: {},
        });

        setDoneReport(report);
        setStatusLines([
          `✓ Wrote entries/${report.slug}/index.html`,
          '✓ Wrote entry.json / manifest.json / description.html',
        ]);
      } catch (runError) {
        setError(runError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    shiftStep(1);
  };

  useInput((input, key) => {
    if (busy) return;
    if (doneReport) {
      if (key.return) onDone(doneReport);
      return;
    }

    if (key.escape) {
      if (stepIdx === 0) onCancel();
      else shiftStep(-1);
      return;
    }

    if (step.kind === 'multi') {
      if (key.upArrow) { setMultiCursor((prev) => (prev - 1 + BUCKETS.length) % BUCKETS.length); return; }
      if (key.downArrow) { setMultiCursor((prev) => (prev + 1) % BUCKETS.length); return; }
      if (input === ' ') {
        const bucket = BUCKETS[multiCursor];
        setForm((prev) => {
          const set = new Set(prev.buckets);
          if (set.has(bucket)) set.delete(bucket); else set.add(bucket);
          return { ...prev, buckets: BUCKETS.filter((b) => set.has(b)) };
        });
        return;
      }
      if (key.return) void maybeAdvance();
      return;
    }

    if (step.kind === 'toggle') {
      if (input === ' ' || key.upArrow || key.downArrow) {
        setForm((prev) => ({ ...prev, authEnabled: !prev.authEnabled }));
        return;
      }
      if (key.return) void maybeAdvance();
      return;
    }

    if (step.kind === 'summary') {
      if (key.return) void maybeAdvance();
      return;
    }

    if (key.leftArrow) { setCursorByStep((prev) => ({ ...prev, [step.id]: Math.max(0, (prev[step.id] ?? 0) - 1) })); return; }
    if (key.rightArrow) { setCursorByStep((prev) => ({ ...prev, [step.id]: Math.min((form[step.id] ?? '').length, (prev[step.id] ?? 0) + 1) })); return; }
    if (key.home) { setCursorByStep((prev) => ({ ...prev, [step.id]: 0 })); return; }
    if (key.end) { setCursorByStep((prev) => ({ ...prev, [step.id]: (form[step.id] ?? '').length })); return; }
    if (key.backspace) { mutateAtCursor('backspace'); return; }
    if (key.delete) { mutateAtCursor('delete'); return; }

    if (key.return) {
      if (step.kind === 'textarea' && !key.ctrl) {
        insertChar('\n');
        return;
      }
      void maybeAdvance();
      return;
    }

    if (!key.ctrl && !key.meta && input && input >= ' ' && input <= '~') {
      insertChar(input);
    }
  });

  return React.createElement(Box, { flexDirection: 'column', height: '100%' },
    React.createElement(Text, { color: '#8f98a8' }, `Step ${stepIdx + 1}/${totalSteps} — ${step.label}`),
    React.createElement(Box, { marginTop: 1, borderStyle: 'round', borderColor: '#6fa8ff', paddingX: 1, flexDirection: 'column' },
      step.kind === 'multi'
        ? React.createElement(Box, { flexDirection: 'column' },
          ...BUCKETS.map((bucket, idx) => React.createElement(Text, { key: bucket, color: idx === multiCursor ? '#ffffff' : '#d0d5df', inverse: idx === multiCursor }, `${idx === multiCursor ? '›' : ' '} [${form.buckets.includes(bucket) ? 'x' : ' '}] ${bucket}`)),
        )
        : step.kind === 'toggle'
          ? React.createElement(Text, { color: '#d0d5df' }, `› ${step.label}: [ ${form.authEnabled ? 'ON' : 'OFF'} ]`)
          : step.kind === 'summary'
            ? React.createElement(Box, { flexDirection: 'column' },
              React.createElement(Text, { color: '#d0d5df' }, `› Title: ${form.title}`),
              React.createElement(Text, { color: '#d0d5df' }, `› Slug: ${form.slug}`),
              React.createElement(Text, { color: '#d0d5df' }, `› Lookup: ${form.lookupNumber}`),
              React.createElement(Text, { color: '#d0d5df' }, `› Buckets: ${form.buckets.join(', ')}`),
              React.createElement(Text, { color: '#d0d5df' }, '› Press Enter to Generate'),
            )
            : React.createElement(Text, { color: '#d0d5df' }, `› ${step.label}: [ ${withCaret(inputValue, cursor, caretOn || process.env.DEX_NO_ANIM === '1')} ]`),
    ),
    busy ? React.createElement(Text, { color: '#ffcc66' }, 'Generating...') : null,
    error ? React.createElement(Text, { color: '#ff6b6b' }, error) : null,
    ...(doneReport ? statusLines.map((line, i) => React.createElement(Text, { key: `ok-${i}`, color: '#a6e3a1' }, line)) : []),
    React.createElement(Box, { marginTop: 1 }, React.createElement(Text, { color: '#6e7688' }, footer)),
  );
}
