import fs from 'node:fs/promises';
import path from 'node:path';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { BUCKETS, slugify } from '../lib/entry-schema.mjs';
import { buildEmptyManifestSkeleton, prepareTemplate, writeEntryFromData } from '../lib/init-core.mjs';
import { isBackspaceKey, shouldAppendWizardChar } from '../lib/input-guard.mjs';
import { computeWindow } from './rolodex.mjs';

const CHANNELS = ['mono', 'stereo', 'multichannel'];
const SERIES_OPTIONS = ['dex', 'inDex', 'dexFest'];
const LAST_CACHE = '.dex-last.json';

function iframeFor(url) { return `<iframe src="${url}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`; }
function emptyCredits() { return { artist: [], artistAlt: '', instruments: [], video: { director: [], cinematography: [], editing: [] }, audio: { recording: [], mix: [], master: [] }, year: `${new Date().getUTCFullYear()}`, season: 'S1', location: '' }; }
function emptyDownloadData() { return { mode: 'guided', series: 'dex', audio: {}, video: {}, fileSpecs: { bitDepth: '24', sampleRate: '48000', channels: 'stereo', staticSizes: { A: '', B: '', C: '', D: '', E: '', X: '' } }, metadata: { tagsSelected: [], tagsQuery: '', tagsCursor: 0 }, pasteBuffer: '', pasteError: '', pasteWarnings: [] }; }

function downloadWarnings(form, formatKeys) {
  const warnings = [];
  const buckets = Array.isArray(form?.buckets) ? form.buckets : [];
  const downloadData = form?.downloadData || emptyDownloadData();
  const keysByType = formatKeys || { audio: [], video: [] };
  for (const b of buckets) {
    for (const k of keysByType.audio || []) {
      if (!String(downloadData.audio?.[b]?.[k] || '').trim()) warnings.push(`audio ${b}/${k} missing`);
    }
    for (const k of keysByType.video || []) {
      if (!String(downloadData.video?.[b]?.[k] || '').trim()) warnings.push(`video ${b}/${k} missing`);
    }
  }
  return warnings;
}

export function createDefaultWizardForm() {
  return {
    title: '',
    slug: '',
    slugTouched: false,
    lookupNumber: '',
    videoUrl: '',
    descriptionText: '',
    series: 'dex',
    buckets: ['A'],
    attributionSentence: '',
    creditsData: emptyCredits(),
    downloadData: emptyDownloadData(),
  };
}
function withCaret(value, cursor, caretOn) { const safe = value || ''; return caretOn ? `${safe.slice(0, cursor)}▌${safe.slice(cursor)}` : safe; }
function looksLikeEscapeSequence(input) { return typeof input === 'string' && input.includes('\x1b'); }
function looksLikeBracketTildeSequence(input) {
  return typeof input === 'string' && (/^\[[0-9;]+~$/.test(input) || /^[0-9;]+~$/.test(input));
}
const safeList = (arr) => (Array.isArray(arr) ? arr.map((v) => String(v || '').trim()).filter(Boolean) : []);
const roleValue = (credits, roleKey) => roleKey.includes('.') ? credits[roleKey.split('.')[0]][roleKey.split('.')[1]] : credits[roleKey];
const roleSet = (credits, roleKey, value) => {
  if (roleKey.includes('.')) {
    const [g, k] = roleKey.split('.');
    return { ...credits, [g]: { ...credits[g], [k]: value } };
  }
  return { ...credits, [roleKey]: value };
};

export function applyKeyToInputState(state, input, key = {}) {
  const value = state?.value ?? '';
  const cursor = Math.max(0, Math.min(value.length, state?.cursor ?? 0));
  if ((key.ctrl && (input === 'q' || input === 'Q')) || input === '\x11') return { value, cursor, quit: true };
  const isLeft = !!(key.leftArrow || input === '\x1b[D' || input === '\x1bOD');
  const isRight = !!(key.rightArrow || input === '\x1b[C' || input === '\x1bOC');
  const isHome = !!(key.home || input === '\x1b[H' || input === '\x1bOH' || input === '\x1b[1~' || input === '\x1b[7~');
  const isEnd = !!(key.end || input === '\x1b[F' || input === '\x1bOF' || input === '\x1b[4~' || input === '\x1b[8~');
  const isDelete = !!(key.delete || (typeof input === 'string' && /^\x1b\[3(?:;\d+)*~$/.test(input)));
  if (isLeft) return { value, cursor: Math.max(0, cursor - 1) };
  if (isRight) return { value, cursor: Math.min(value.length, cursor + 1) };
  if (isHome) return { value, cursor: 0 };
  if (isEnd) return { value, cursor: value.length };
  if (isBackspaceKey(input, key)) { if (cursor === 0) return { value, cursor }; return { value: `${value.slice(0, cursor - 1)}${value.slice(cursor)}`, cursor: cursor - 1 }; }
  if (isDelete) { if (cursor >= value.length) return { value, cursor }; return { value: `${value.slice(0, cursor)}${value.slice(cursor + 1)}`, cursor }; }
  if (looksLikeBracketTildeSequence(input)) return { value, cursor };
  if (looksLikeEscapeSequence(input)) return { value, cursor };
  if (shouldAppendWizardChar(input, key)) return { value: `${value.slice(0, cursor)}${input}${value.slice(cursor)}`, cursor: cursor + 1 };
  return { value, cursor };
}

export function validateStep(stepId, form, selectedRole, formatKeys) {
  const safeForm = form || {};
  const buckets = Array.isArray(safeForm.buckets) ? safeForm.buckets : [];
  if (stepId === 'title' && !String(safeForm.title || '').trim()) return 'Title is required.';
  if (stepId === 'slug' && !String(safeForm.slug || '').trim()) return 'Slug is required.';
  if (stepId === 'lookupNumber' && !String(safeForm.lookupNumber || '').trim()) return 'Lookup number is required.';
  if (stepId === 'videoUrl' && !String(safeForm.videoUrl || '').trim()) return 'Video URL is required.';
  if (stepId === 'buckets' && buckets.length < 1) return 'Select at least one bucket.';
  if (stepId === 'attributionSentence' && !String(safeForm.attributionSentence || '').trim()) return 'Attribution sentence is required.';
  if (stepId === 'credits') {
    const creditsData = safeForm.creditsData || emptyCredits();
    const requiredRoles = [
      { key: 'artist', label: 'Artist(s)' },
      { key: 'instruments', label: 'Instruments' },
      { key: 'video.director', label: 'Video Director' },
      { key: 'video.cinematography', label: 'Video Cinematography' },
      { key: 'video.editing', label: 'Video Editing' },
      { key: 'audio.recording', label: 'Audio Recording' },
      { key: 'audio.mix', label: 'Audio Mix' },
      { key: 'audio.master', label: 'Audio Master' },
    ];
    for (const role of requiredRoles) {
      if (safeList(roleValue(creditsData, role.key)).length < 1) return `${role.label} needs at least one name.`;
    }
    if (!String(creditsData.year || '').trim()) return 'Year is required.';
    if (Number.isNaN(Number(creditsData.year))) return 'Year must be numeric.';
    if (!String(creditsData.season || '').trim()) return 'Season is required.';
    if (!String(creditsData.location || '').trim()) return 'Location is required.';
  }
  if (stepId === 'download') {
    const downloadData = safeForm.downloadData || emptyDownloadData();
    if (!downloadData || typeof downloadData !== 'object') return 'Download configuration is missing.';
    const bitDepth = Number(downloadData.fileSpecs?.bitDepth);
    const sampleRate = Number(downloadData.fileSpecs?.sampleRate);
    if (Number.isNaN(bitDepth) || bitDepth <= 0) return 'Bit depth must be numeric.';
    if (Number.isNaN(sampleRate) || sampleRate <= 0) return 'Sample rate must be numeric.';
    if (!CHANNELS.includes(downloadData.fileSpecs?.channels)) return 'Channels must be mono, stereo, or multichannel.';
    if (safeList(downloadData.metadata?.tagsSelected).length < 1) return 'Select at least one tag.';
    if (!formatKeys) void selectedRole;
  }
  return null;
}

function parseDriveId(value) {
  const id = String(value || '').trim();
  if (!id) return false;
  if (/http|\//i.test(id)) return false;
  return /^[A-Za-z0-9_-]{10,}$/.test(id);
}

function parsePasteBlock(buffer, selectedBuckets, formatKeys) {
  const rows = String(buffer || '').split(/\r?\n/).map((line, idx) => ({ line, idx: idx + 1 })).filter((r) => r.line.trim());
  const next = { audio: {}, video: {} };
  const errors = [];
  rows.forEach(({ line, idx }) => {
    const parts = line.includes('\t') ? line.split('\t') : line.split(',');
    if (parts.length < 4) return;
    const [typeRaw, bucketRaw, keyRaw, idRaw] = parts.map((p) => String(p || '').trim());
    if (idx === 1 && /type/i.test(typeRaw) && /bucket/i.test(bucketRaw)) return;
    const type = typeRaw.toLowerCase();
    if (!['audio', 'video'].includes(type)) { errors.push(`L${idx}: invalid type ${typeRaw}`); return; }
    const bucket = bucketRaw.toUpperCase();
    if (!selectedBuckets.includes(bucket)) { errors.push(`L${idx}: bucket ${bucket} not selected`); return; }
    if (!(formatKeys[type] || []).includes(keyRaw)) { errors.push(`L${idx}: invalid ${type} format ${keyRaw}`); return; }
    if (!parseDriveId(idRaw)) { errors.push(`L${idx}: invalid driveId`); return; }
    next[type][bucket] = next[type][bucket] || {};
    next[type][bucket][keyRaw] = idRaw;
  });
  return { errors, next };
}

const STEPS = [
  { id: 'title', label: 'Title', kind: 'text' },
  { id: 'slug', label: 'Slug', kind: 'text' },
  { id: 'lookupNumber', label: 'Lookup number', kind: 'text' },
  { id: 'videoUrl', label: 'Video URL', kind: 'text' },
  { id: 'descriptionText', label: 'Description', kind: 'text' },
  { id: 'series', label: 'Series', kind: 'select', options: SERIES_OPTIONS },
  { id: 'buckets', label: 'Buckets', kind: 'multi' },
  { id: 'attributionSentence', label: 'Attribution sentence', kind: 'text' },
  { id: 'credits', label: 'Credits', kind: 'credits' },
  { id: 'download', label: 'Download', kind: 'download' },
  { id: 'summary', label: 'Summary', kind: 'summary' },
];

export function InitWizard({ templateArg, outDirDefault, onCancel, onDone }) {
  const { stdout } = useStdout();
  const [stepIdx, setStepIdx] = useState(0); const [caretOn, setCaretOn] = useState(true); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [doneReport, setDoneReport] = useState(null); const [multiCursor, setMultiCursor] = useState(0);
  const [creditsCursor, setCreditsCursor] = useState(0); const [creditsInputState, setCreditsInputState] = useState({ value: '', cursor: 0 }); const [reuseAsked, setReuseAsked] = useState(false); const [reuseChoice, setReuseChoice] = useState(true);
  const [downloadCursor, setDownloadCursor] = useState(0); const [pasteMode, setPasteMode] = useState(false); const [downloadFocus, setDownloadFocus] = useState('rows');
  const [tagsCatalog, setTagsCatalog] = useState([]); const [tagsWarning, setTagsWarning] = useState('');
  const templateRef = useRef(null);
  const [form, setForm] = useState(createDefaultWizardForm());
  const [cursorByStep, setCursorByStep] = useState({ title: 0, slug: 0, lookupNumber: 0, videoUrl: 0, descriptionText: 0, attributionSentence: 0 });

  const step = STEPS[stepIdx]; const totalSteps = STEPS.length;
  const creditRoles = [{ key: 'artist', label: 'Artist(s)' }, { key: 'instruments', label: 'Instruments' }, { key: 'video.director', label: 'Video Director' }, { key: 'video.cinematography', label: 'Video Cinematography' }, { key: 'video.editing', label: 'Video Editing' }, { key: 'audio.recording', label: 'Audio Recording' }, { key: 'audio.mix', label: 'Audio Mix' }, { key: 'audio.master', label: 'Audio Master' }, { key: 'year', label: 'Year' }, { key: 'season', label: 'Season' }, { key: 'location', label: 'Location' }, { key: 'artistAlt', label: 'Artist Alt' }];
  const selectedRole = creditRoles[Math.min(creditsCursor, creditRoles.length - 1)];
  const scalarCreditKeys = new Set(['year', 'season', 'location', 'artistAlt']);

  useEffect(() => { if (process.env.DEX_NO_ANIM === '1') return undefined; const id = setInterval(() => setCaretOn((p) => !p), 500); return () => clearInterval(id); }, []);
  useEffect(() => { if (!form.slugTouched) { const s = slugify(form.title || ''); setForm((p) => ({ ...p, slug: s })); setCursorByStep((p) => ({ ...p, slug: s.length })); } }, [form.title, form.slugTouched]);
  useEffect(() => {
    const roleKey = selectedRole?.key || '';
    const value = scalarCreditKeys.has(roleKey) ? String(roleValue(form.creditsData, roleKey) || '') : '';
    setCreditsInputState({ value, cursor: value.length });
  }, [creditsCursor]);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const filePath = new URL('../data/tags.txt', import.meta.url);
        const raw = await fs.readFile(filePath, 'utf8');
        const tags = raw.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
        setTagsCatalog(tags);
      } catch {
        setTagsCatalog([]);
        setTagsWarning('Tags file unavailable: scripts/data/tags.txt');
      }
    };
    void loadTags();
  }, []);

  const shiftStep = (d) => { setError(''); setStepIdx((p) => Math.max(0, Math.min(totalSteps - 1, p + d))); };
  const applyTextEdit = (input, key = {}, stepId = step.id) => {
    const value = (stepId in form) ? form[stepId] ?? '' : '';
    const pos = cursorByStep[stepId] ?? value.length;
    const next = applyKeyToInputState({ value, cursor: pos }, input, key);
    if (next.value !== value || next.cursor !== pos) {
      setForm((p) => ({ ...p, [stepId]: next.value, ...(stepId === 'slug' ? { slugTouched: true } : {}) }));
      setCursorByStep((p) => ({ ...p, [stepId]: next.cursor }));
    }
    return next;
  };

  const loadRehydrate = async (slug) => {
    const outDir = path.resolve(outDirDefault || './entries');
    try {
      const entryPath = path.join(outDir, slug, 'entry.json');
      const entry = JSON.parse(await fs.readFile(entryPath, 'utf8'));
      setForm((p) => ({ ...p, title: entry.title || p.title, lookupNumber: entry.sidebarPageConfig?.lookupNumber || p.lookupNumber, videoUrl: entry.video?.dataUrl || p.videoUrl, descriptionText: entry.descriptionText || p.descriptionText, series: entry.series || p.series, buckets: safeList(entry.selectedBuckets || entry.sidebarPageConfig?.buckets || p.buckets), attributionSentence: entry.sidebarPageConfig?.attributionSentence || p.attributionSentence, creditsData: { ...emptyCredits(), ...(entry.creditsData || {}), ...(entry.sidebarPageConfig?.credits ? { artist: safeList([entry.sidebarPageConfig.credits.artist?.name]), instruments: safeList((entry.sidebarPageConfig.credits.instruments || []).map((x) => x.name)) } : {}) }, downloadData: { ...p.downloadData, series: entry.series || p.series, fileSpecs: { ...p.downloadData.fileSpecs, ...(entry.fileSpecs || {}) }, metadata: { ...p.downloadData.metadata, tagsSelected: Array.isArray(entry.metadata?.tags) ? safeList(entry.metadata.tags) : p.downloadData.metadata.tagsSelected, tagsQuery: '', tagsCursor: 0 }, audio: entry.manifest?.audio || p.downloadData.audio, video: entry.manifest?.video || p.downloadData.video } }));
      return true;
    } catch { return false; }
  };

  const maybeAdvance = async () => {
    if (!templateRef.current) templateRef.current = await prepareTemplate({ templateArg });
    const validation = validateStep(step.id, form, selectedRole, templateRef.current.formatKeys);
    if (validation) { setError(validation); return; }
    if (step.id === 'slug') {
      const outDir = path.resolve(outDirDefault || './entries');
      const slug = slugify(form.slug.trim());
      const rehydrated = await loadRehydrate(slug);
      if (!rehydrated) {
        const exists = new Set(); try { const dirs = await fs.readdir(outDir, { withFileTypes: true }); dirs.filter((d) => d.isDirectory()).forEach((d) => exists.add(d.name)); } catch {}
        let deduped = slug; let i = 2; while (exists.has(deduped)) { deduped = `${slug}-${i}`; i += 1; }
        setForm((p) => ({ ...p, slug: deduped, slugTouched: true }));
      }
    }
    if (step.id === 'credits' && !reuseAsked) {
      setReuseAsked(true);
      if (reuseChoice) {
        try { const cache = JSON.parse(await fs.readFile(path.join(path.resolve(outDirDefault || './entries'), LAST_CACHE), 'utf8')); if (Array.isArray(cache.lastInstruments)) setForm((p) => ({ ...p, creditsData: { ...p.creditsData, instruments: safeList(cache.lastInstruments) } })); } catch {}
      }
      return;
    }
    if (step.id === 'summary') {
      setBusy(true);
      try {
        const { formatKeys, templateHtml, templatePath } = templateRef.current;
        const manifest = buildEmptyManifestSkeleton(formatKeys);
        for (const bucket of BUCKETS) {
          manifest.audio[bucket] = { ...(manifest.audio[bucket] || {}), ...(form.downloadData.audio[bucket] || {}) };
          manifest.video[bucket] = { ...(manifest.video[bucket] || {}), ...(form.downloadData.video[bucket] || {}) };
        }
        const creditsData = {
          artist: safeList(form.creditsData.artist), artistAlt: form.creditsData.artistAlt || null, instruments: safeList(form.creditsData.instruments),
          video: { director: safeList(form.creditsData.video.director), cinematography: safeList(form.creditsData.video.cinematography), editing: safeList(form.creditsData.video.editing) },
          audio: { recording: safeList(form.creditsData.audio.recording), mix: safeList(form.creditsData.audio.mix), master: safeList(form.creditsData.audio.master) },
          year: Number(form.creditsData.year), season: form.creditsData.season, location: form.creditsData.location,
        };
        const sidebar = {
          lookupNumber: form.lookupNumber, buckets: form.buckets, specialEventImage: null, attributionSentence: form.attributionSentence,
          credits: { artist: { name: creditsData.artist.join(', '), links: [] }, artistAlt: creditsData.artistAlt, instruments: creditsData.instruments.map((n) => ({ name: n, links: [] })), video: { director: { name: creditsData.video.director.join(', '), links: [] }, cinematography: { name: creditsData.video.cinematography.join(', '), links: [] }, editing: { name: creditsData.video.editing.join(', '), links: [] } }, audio: { recording: { name: creditsData.audio.recording.join(', '), links: [] }, mix: { name: creditsData.audio.mix.join(', '), links: [] }, master: { name: creditsData.audio.master.join(', '), links: [] } }, year: creditsData.year, season: creditsData.season, location: creditsData.location },
          fileSpecs: { bitDepth: Number(form.downloadData.fileSpecs.bitDepth) || 24, sampleRate: Number(form.downloadData.fileSpecs.sampleRate) || 48000, channels: form.downloadData.fileSpecs.channels, staticSizes: form.downloadData.fileSpecs.staticSizes },
          metadata: { sampleLength: 'AUTO', tags: safeList(form.downloadData.metadata.tagsSelected) },
        };
        const { report } = await writeEntryFromData({ templatePath, templateHtml, data: { slug: form.slug, title: form.title, video: { mode: 'url', dataUrl: form.videoUrl, dataHtml: iframeFor(form.videoUrl) }, descriptionText: form.descriptionText || '', series: form.series, selectedBuckets: form.buckets, creditsData, fileSpecs: sidebar.fileSpecs, metadata: sidebar.metadata, sidebar, manifest, authEnabled: true, outDir: path.resolve(outDirDefault || './entries') }, opts: {} });
        await fs.mkdir(path.resolve(outDirDefault || './entries'), { recursive: true }).catch(() => {});
        await fs.writeFile(path.join(path.resolve(outDirDefault || './entries'), LAST_CACHE), `${JSON.stringify({ lastInstruments: creditsData.instruments }, null, 2)}\n`, 'utf8');
        setDoneReport(report);
      } catch (e) { setError(e.message); }
      setBusy(false);
      return;
    }
    shiftStep(1);
  };

  useInput((input, key) => {
    if (busy) return;
    if (doneReport) { if (key.return) onDone(doneReport); return; }
    if ((key.ctrl && (input === 'q' || input === 'Q')) || input === '\x11') { onCancel(); return; }
    if (key.escape && !pasteMode) { if (stepIdx === 0) onCancel(); else shiftStep(-1); return; }

    if (step.kind === 'text') { const next = applyTextEdit(input, key); if (next?.quit) { onCancel(); return; } if (key.return) void maybeAdvance(); return; }
    if (step.kind === 'select') { if (key.leftArrow || key.upArrow) setForm((p) => ({ ...p, series: SERIES_OPTIONS[(SERIES_OPTIONS.indexOf(p.series) - 1 + SERIES_OPTIONS.length) % SERIES_OPTIONS.length] })); if (key.rightArrow || key.downArrow) setForm((p) => ({ ...p, series: SERIES_OPTIONS[(SERIES_OPTIONS.indexOf(p.series) + 1) % SERIES_OPTIONS.length] })); if (key.return) void maybeAdvance(); return; }
    if (step.kind === 'multi') { if (key.upArrow) setMultiCursor((p) => (p - 1 + BUCKETS.length) % BUCKETS.length); if (key.downArrow) setMultiCursor((p) => (p + 1) % BUCKETS.length); if (input === ' ') setForm((p) => { const b = BUCKETS[multiCursor]; const s = new Set(Array.isArray(p.buckets) ? p.buckets : []); if (s.has(b)) s.delete(b); else s.add(b); return { ...p, buckets: BUCKETS.filter((x) => s.has(x)) }; }); if (key.return) void maybeAdvance(); return; }
    if (step.kind === 'credits') {
      if (key.upArrow) { setCreditsCursor((p) => Math.max(0, p - 1)); return; }
      if (key.downArrow) { setCreditsCursor((p) => Math.min(creditRoles.length - 1, p + 1)); return; }
      const isAdd = (key.ctrl && (input === 'a' || input === 'A')) || input === '\x01';
      const isRemoveLast = (key.ctrl && (input === 'd' || input === 'D')) || (key.ctrl && key.backspace);
      const isScalar = scalarCreditKeys.has(selectedRole?.key || '');
      if (isAdd && !isScalar) {
        const list = safeList(creditsInputState.value.split(','));
        if (list.length) {
          setForm((p) => ({ ...p, creditsData: roleSet(p.creditsData, selectedRole.key, [...safeList(roleValue(p.creditsData, selectedRole.key)), ...list]) }));
          setCreditsInputState({ value: '', cursor: 0 });
        }
        return;
      }
      if (isRemoveLast && !isScalar) {
        setForm((p) => ({ ...p, creditsData: roleSet(p.creditsData, selectedRole.key, safeList(roleValue(p.creditsData, selectedRole.key)).slice(0, -1)) }));
        return;
      }
      if (key.return) { void maybeAdvance(); return; }
      const next = applyKeyToInputState(creditsInputState, input, key);
      setCreditsInputState({ value: next.value, cursor: next.cursor });
      if (isScalar && selectedRole?.key) {
        setForm((p) => ({ ...p, creditsData: roleSet(p.creditsData, selectedRole.key, next.value) }));
      }
      return;
    }
    if (step.kind === 'download') {
      const fk = templateRef.current?.formatKeys || { audio: [], video: [] };
      const rows = [];
      form.buckets.forEach((b) => fk.audio.forEach((k) => rows.push({ type: 'audio', b, k }))); form.buckets.forEach((b) => fk.video.forEach((k) => rows.push({ type: 'video', b, k })));
      const isCtrlP = (key.ctrl && (input === 'p' || input === 'P')) || input === '\x10';
      const isCtrlG = (key.ctrl && (input === 'g' || input === 'G')) || input === '\x07';

      if (pasteMode) {
        if (key.escape) { setPasteMode(false); return; }
        if (isCtrlP) {
          const parsed = parsePasteBlock(form.downloadData.pasteBuffer, form.buckets, fk);
          if (parsed.errors.length) { setForm((p) => ({ ...p, downloadData: { ...p.downloadData, pasteError: parsed.errors.join(' | ') } })); return; }
          setForm((p) => ({ ...p, downloadData: { ...p.downloadData, audio: { ...p.downloadData.audio, ...parsed.next.audio }, video: { ...p.downloadData.video, ...parsed.next.video }, pasteError: '' } }));
          setPasteMode(false);
          return;
        }
        if (key.return) { setForm((p) => ({ ...p, downloadData: { ...p.downloadData, pasteBuffer: `${p.downloadData.pasteBuffer}\n` } })); return; }
        const n = applyKeyToInputState({ value: form.downloadData.pasteBuffer, cursor: form.downloadData.pasteBuffer.length }, input, key);
        setForm((p) => ({ ...p, downloadData: { ...p.downloadData, pasteBuffer: n.value } }));
        return;
      }

      if (isCtrlP) { setForm((p) => ({ ...p, downloadData: { ...p.downloadData, pasteError: '' } })); setPasteMode(true); return; }
      if (isCtrlG) { setForm((p) => ({ ...p, downloadData: { ...p.downloadData, fileSpecs: { ...p.downloadData.fileSpecs, channels: CHANNELS[(CHANNELS.indexOf(p.downloadData.fileSpecs.channels) + 1) % CHANNELS.length] } } })); return; }
      if (key.tab) { setDownloadFocus((p) => (p === 'rows' ? 'tags' : 'rows')); return; }

      const filteredTags = tagsCatalog.filter((tag) => tag.toLowerCase().includes((form.downloadData.metadata.tagsQuery || '').toLowerCase()));

      if (downloadFocus === 'tags') {
        if (key.upArrow) { setForm((p) => ({ ...p, downloadData: { ...p.downloadData, metadata: { ...p.downloadData.metadata, tagsCursor: Math.max(0, (p.downloadData.metadata.tagsCursor || 0) - 1) } } })); return; }
        if (key.downArrow) { setForm((p) => ({ ...p, downloadData: { ...p.downloadData, metadata: { ...p.downloadData.metadata, tagsCursor: Math.min(Math.max(0, filteredTags.length - 1), (p.downloadData.metadata.tagsCursor || 0) + 1) } } })); return; }
        if (input === ' ') {
          const currentTag = filteredTags[form.downloadData.metadata.tagsCursor || 0];
          if (currentTag) {
            setForm((p) => {
              const selected = new Set(safeList(p.downloadData.metadata.tagsSelected));
              if (selected.has(currentTag)) selected.delete(currentTag); else selected.add(currentTag);
              return { ...p, downloadData: { ...p.downloadData, metadata: { ...p.downloadData.metadata, tagsSelected: Array.from(selected) } } };
            });
          }
          return;
        }
        if (isBackspaceKey(input, key)) {
          setForm((p) => ({ ...p, downloadData: { ...p.downloadData, metadata: { ...p.downloadData.metadata, tagsQuery: String(p.downloadData.metadata.tagsQuery || '').slice(0, -1), tagsCursor: 0 } } }));
          return;
        }
        if (shouldAppendWizardChar(input, key)) {
          setForm((p) => ({ ...p, downloadData: { ...p.downloadData, metadata: { ...p.downloadData.metadata, tagsQuery: `${p.downloadData.metadata.tagsQuery || ''}${input}`, tagsCursor: 0 } } }));
          return;
        }
        if (key.return) { void maybeAdvance(); }
        return;
      }

      if (key.upArrow) { setDownloadCursor((p) => Math.max(0, p - 1)); return; }
      if (key.downArrow) { setDownloadCursor((p) => Math.min(rows.length - 1, p + 1)); return; }
      if (key.return) { void maybeAdvance(); return; }
      const cur = rows[downloadCursor];
      if (cur) {
        const current = form.downloadData[cur.type]?.[cur.b]?.[cur.k] || '';
        const n = applyKeyToInputState({ value: current, cursor: current.length }, input, key);
        setForm((p) => ({ ...p, downloadData: { ...p.downloadData, [cur.type]: { ...p.downloadData[cur.type], [cur.b]: { ...(p.downloadData[cur.type]?.[cur.b] || {}), [cur.k]: n.value } } } }));
      }
      return;
    }
    if (step.kind === 'summary' && key.return) void maybeAdvance();
  });

  const fk = templateRef.current?.formatKeys || { audio: [], video: [] };
  const downloadRows = [...form.buckets.flatMap((b) => fk.audio.map((k) => ({ type: 'audio', b, k }))), ...form.buckets.flatMap((b) => fk.video.map((k) => ({ type: 'video', b, k })))];
  const filteredTags = tagsCatalog.filter((tag) => tag.toLowerCase().includes((form.downloadData.metadata.tagsQuery || '').toLowerCase()));
  const safeTagCursor = Math.min(Math.max(0, form.downloadData.metadata.tagsCursor || 0), Math.max(0, filteredTags.length - 1));
  const rowsAvailable = Math.max(4, Math.min(12, (stdout?.rows || 24) - 16));
  const creditsWindow = computeWindow({ total: creditRoles.length, cursor: creditsCursor, height: rowsAvailable });
  const bucketsWindow = computeWindow({ total: BUCKETS.length, cursor: multiCursor, height: rowsAvailable });
  const downloadWindow = computeWindow({ total: downloadRows.length, cursor: downloadCursor, height: Math.max(4, Math.floor(rowsAvailable / 2)) });
  const tagsWindow = computeWindow({ total: filteredTags.length, cursor: safeTagCursor, height: Math.max(4, Math.floor(rowsAvailable / 2)) });
  const warnings = downloadWarnings(form, fk);

  const footer = doneReport
    ? 'Enter return to menu'
    : step.kind === 'credits'
      ? 'Type to edit • Ctrl+A add (lists) • Ctrl+D remove last • Enter next • Esc back • Ctrl+Q quit'
      : step.kind === 'download'
        ? (pasteMode
          ? 'Ctrl+P finish & parse • Esc cancel • Enter newline'
          : 'Ctrl+P paste mode • Ctrl+G cycle channels • Tab switch list/tags • Enter next • Esc back • Ctrl+Q quit')
        : 'Enter next • Esc back • Ctrl+Q quit';

  return React.createElement(Box, { flexDirection: 'column', height: '100%' },
    React.createElement(Text, { color: '#8f98a8' }, `Step ${stepIdx + 1}/${totalSteps} — ${step.label}`),
    React.createElement(Box, { marginTop: 1, borderStyle: 'round', borderColor: '#6fa8ff', paddingX: 1, flexDirection: 'column' },
      step.kind === 'text' ? React.createElement(Text, { color: '#d0d5df' }, `› ${step.label}: [ ${withCaret(form[step.id] || '', cursorByStep[step.id] ?? 0, caretOn || process.env.DEX_NO_ANIM === '1')} ]`) : null,
      step.kind === 'select' ? React.createElement(Text, { color: '#d0d5df' }, `› Series: ${form.series} (←/→)`) : null,
      step.kind === 'multi' ? React.createElement(Box, { flexDirection: 'column' },
        bucketsWindow.start > 0 ? React.createElement(Text, { color: '#8f98a8', key: 'buckets-up' }, '…') : null,
        ...BUCKETS.slice(bucketsWindow.start, bucketsWindow.end).map((b, localIdx) => {
          const i = bucketsWindow.start + localIdx;
          return React.createElement(Text, { key: b, inverse: i === multiCursor }, `${i === multiCursor ? '›' : ' '} [${form.buckets.includes(b) ? 'x' : ' '}] ${b}`);
        }),
        bucketsWindow.end < BUCKETS.length ? React.createElement(Text, { color: '#8f98a8', key: 'buckets-down' }, '…') : null,
      ) : null,
      step.kind === 'credits' ? React.createElement(Box, { flexDirection: 'column' },
        React.createElement(Text, { color: '#8f98a8' }, reuseAsked ? `Reuse instruments: ${reuseChoice ? 'yes' : 'no'}` : 'On Enter, instruments can reuse last entry cache'),
        React.createElement(Text, { color: '#d0d5df' }, `› Editing: ${selectedRole?.label || '-'}`),
        React.createElement(Text, { color: '#d0d5df' }, `Input: [ ${withCaret(creditsInputState.value, creditsInputState.cursor, caretOn || process.env.DEX_NO_ANIM === '1')} ]`),
        creditsWindow.start > 0 ? React.createElement(Text, { color: '#8f98a8', key: 'credits-up' }, '…') : null,
        ...creditRoles.slice(creditsWindow.start, creditsWindow.end).map((r, localIdx) => {
          const i = creditsWindow.start + localIdx;
          const raw = roleValue(form.creditsData, r.key);
          const display = Array.isArray(raw) ? (raw.join(', ') || '(empty)') : (String(raw || '').trim() || '(empty)');
          return React.createElement(Text, { key: r.key, inverse: i === creditsCursor }, `${i === creditsCursor ? '›' : ' '} ${r.label}: ${display}`);
        }),
        creditsWindow.end < creditRoles.length ? React.createElement(Text, { color: '#8f98a8', key: 'credits-down' }, '…') : null,
      ) : null,
      step.kind === 'download' ? React.createElement(Box, { flexDirection: 'column' },
        pasteMode ? React.createElement(Text, { color: '#d0d5df' }, `Paste rows type,bucket,formatKey,driveId\nCtrl+P finish & parse • Esc cancel\n${form.downloadData.pasteBuffer}`) : null,
        !pasteMode ? React.createElement(Text, { color: '#8f98a8' }, `channels=${form.downloadData.fileSpecs.channels} • focus=${downloadFocus}`) : null,
        !pasteMode && downloadWindow.start > 0 ? React.createElement(Text, { color: '#8f98a8' }, '…') : null,
        !pasteMode ? downloadRows.slice(downloadWindow.start, downloadWindow.end).map((row, localIdx) => {
          const idx = downloadWindow.start + localIdx;
          return React.createElement(Text, { key: `${row.type}-${row.b}-${row.k}`, inverse: idx === downloadCursor && downloadFocus === 'rows' }, `${idx === downloadCursor ? '›' : ' '} ${row.type} ${row.b}/${row.k}: ${form.downloadData[row.type]?.[row.b]?.[row.k] || ''}`);
        }) : null,
        !pasteMode && downloadWindow.end < downloadRows.length ? React.createElement(Text, { color: '#8f98a8' }, '…') : null,
        !pasteMode ? React.createElement(Text, { color: '#d0d5df' }, `sampleLength: AUTO`) : null,
        !pasteMode ? React.createElement(Text, { color: '#d0d5df' }, `Tags (required) [${safeList(form.downloadData.metadata.tagsSelected).length} selected]`) : null,
        !pasteMode ? React.createElement(Text, { color: '#8f98a8' }, `Filter: [ ${(downloadFocus === 'tags') ? withCaret(form.downloadData.metadata.tagsQuery || '', (form.downloadData.metadata.tagsQuery || '').length, caretOn || process.env.DEX_NO_ANIM === '1') : (form.downloadData.metadata.tagsQuery || '')} ]`) : null,
        !pasteMode && tagsWindow.start > 0 ? React.createElement(Text, { color: '#8f98a8' }, '…') : null,
        !pasteMode ? filteredTags.slice(tagsWindow.start, tagsWindow.end).map((tag, localIdx) => {
          const idx = tagsWindow.start + localIdx;
          const selected = safeList(form.downloadData.metadata.tagsSelected).includes(tag);
          return React.createElement(Text, { key: `tag-${tag}`, inverse: idx === safeTagCursor && downloadFocus === 'tags' }, `${idx === safeTagCursor ? '›' : ' '} [${selected ? 'x' : ' '}] ${tag}`);
        }) : null,
        !pasteMode && tagsWindow.end < filteredTags.length ? React.createElement(Text, { color: '#8f98a8' }, '…') : null,
        tagsWarning ? React.createElement(Text, { color: '#8f98a8', dimColor: true }, tagsWarning) : null,
        !pasteMode && warnings.length ? warnings.slice(0, 4).map((msg) => React.createElement(Text, { key: `warn-${msg}`, color: '#8f98a8', dimColor: true }, `warning: ${msg}`)) : null,
        !pasteMode && warnings.length > 4 ? React.createElement(Text, { color: '#8f98a8', dimColor: true }, `warning: +${warnings.length - 4} more`) : null,
        form.downloadData.pasteError ? React.createElement(Text, { color: '#ff6b6b' }, form.downloadData.pasteError) : null,
      ) : null,
      step.kind === 'summary' ? React.createElement(Box, { flexDirection: 'column' }, React.createElement(Text, { color: '#d0d5df' }, `› Title: ${form.title}`), React.createElement(Text, { color: '#d0d5df' }, `› Slug: ${form.slug}`), React.createElement(Text, { color: '#d0d5df' }, `› Buckets: ${form.buckets.join(', ')}`), React.createElement(Text, { color: '#d0d5df' }, '› Press Enter to Generate')) : null,
    ),
    busy ? React.createElement(Text, { color: '#ffcc66' }, 'Generating...') : null,
    error ? React.createElement(Text, { color: '#ff6b6b' }, error) : null,
    React.createElement(Box, { marginTop: 1 }, React.createElement(Text, { color: '#6e7688' }, footer)),
  );
}
