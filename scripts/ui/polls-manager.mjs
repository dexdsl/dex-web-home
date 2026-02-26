import process from 'node:process';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { computeWindow } from './rolodex.mjs';
import { isBackspaceKey, shouldAppendWizardChar } from '../lib/input-guard.mjs';
import {
  createPollDraft,
  readPollsFile,
  setPollStatus,
  upsertPoll,
  writePollsFile,
} from '../lib/polls-store.mjs';
import { pollsStatusValues, pollsVisibilityValues } from '../lib/polls-schema.mjs';
import { publishPolls } from '../lib/polls-publish.mjs';

const STATUS_VALUES = Array.isArray(pollsStatusValues) ? pollsStatusValues : ['open', 'closed', 'draft'];
const VISIBILITY_VALUES = Array.isArray(pollsVisibilityValues) ? pollsVisibilityValues : ['public', 'members'];

function nowIso() {
  return new Date().toISOString();
}

function safeMessage(error) {
  if (!error) return 'Unknown error';
  return error?.message || String(error);
}

function formatShortDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'n/a';
  return date.toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function truncate(value, max) {
  const text = String(value || '');
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function parseOptionsInput(value) {
  return String(value || '')
    .split(/\n|\|/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseCloseAtToIso(value, fallbackIso) {
  const raw = String(value || '').trim();
  if (!raw) return fallbackIso || nowIso();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T23:59:59.000Z`);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid close date');
    return date.toISOString();
  }
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid close date');
  return date.toISOString();
}

function cycleIn(values, current, step) {
  const list = Array.isArray(values) ? values : [];
  if (!list.length) return current;
  const index = list.indexOf(current);
  const start = index >= 0 ? index : 0;
  const nextIndex = (start + step + list.length) % list.length;
  return list[nextIndex];
}

function makeBar(count, total, width = 18) {
  const safeTotal = Number(total) > 0 ? Number(total) : 0;
  const safeCount = Number(count) > 0 ? Number(count) : 0;
  const ratio = safeTotal > 0 ? Math.min(1, safeCount / safeTotal) : 0;
  const filled = Math.round(ratio * width);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
}

function parseResponseText(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function normalizeApiBase(value) {
  const parsed = new URL(String(value || '').trim());
  return parsed.toString().replace(/\/$/, '');
}

function resolveMetricsApiBase() {
  const fallback = 'https://dex-api.spring-fog-8edd.workers.dev';
  const explicit = process.env.DEX_POLLS_METRICS_API_BASE
    || process.env.DEX_POLLS_API_BASE
    || process.env.DEX_POLLS_API_BASE_PROD
    || process.env.DEX_API_BASE_URL
    || fallback;
  try {
    return normalizeApiBase(explicit);
  } catch {
    return fallback;
  }
}

function deriveStats(polls = [], metricsById = {}) {
  let open = 0;
  let closed = 0;
  let draft = 0;
  let members = 0;
  let publicCount = 0;
  let votesKnown = 0;
  let votesTotal = 0;

  for (const poll of polls) {
    if (poll.status === 'open') open += 1;
    if (poll.status === 'closed') closed += 1;
    if (poll.status === 'draft') draft += 1;
    if (poll.visibility === 'members') members += 1;
    if (poll.visibility === 'public') publicCount += 1;
    const metric = metricsById[poll.id];
    if (metric && !metric.loading && !metric.error && Number.isFinite(Number(metric.total))) {
      votesKnown += 1;
      votesTotal += Number(metric.total);
    }
  }

  return {
    total: polls.length,
    open,
    closed,
    draft,
    members,
    public: publicCount,
    votesKnown,
    votesTotal,
  };
}

function makeEditorFromPoll(mode, poll, fallbackData) {
  const source = poll || createPollDraft(fallbackData || {
    version: 1,
    updatedAt: nowIso(),
    polls: [],
  });
  return {
    mode,
    sourceId: source.id,
    fields: {
      id: String(source.id || ''),
      slug: String(source.slug || ''),
      question: String(source.question || ''),
      options: Array.isArray(source.options) ? source.options.join(' | ') : 'Option 1 | Option 2',
      visibility: source.visibility || 'public',
      status: source.status || 'draft',
      closeAt: formatShortDate(source.closeAt || nowIso()),
      manualClose: Boolean(source.manualClose),
    },
  };
}

export function PollsManager({ onExit, width = 100, height = 24 }) {
  const [pollsData, setPollsData] = useState(null);
  const [pollsFilePath, setPollsFilePath] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [statusLine, setStatusLine] = useState('Loading polls file…');
  const [metricsById, setMetricsById] = useState({});
  const [metricsBusy, setMetricsBusy] = useState(false);
  const [editor, setEditor] = useState(null);
  const [editorFieldIndex, setEditorFieldIndex] = useState(0);
  const [editorTyping, setEditorTyping] = useState(false);
  const [editorBuffer, setEditorBuffer] = useState('');
  const apiBase = useMemo(() => resolveMetricsApiBase(), []);
  const metricsToken = useMemo(
    () => process.env.DEX_POLLS_METRICS_BEARER || process.env.AUTH0_ACCESS_TOKEN || '',
    [],
  );

  const polls = useMemo(() => (Array.isArray(pollsData?.polls) ? pollsData.polls : []), [pollsData]);
  const selectedPoll = polls[selectedIndex] || null;
  const stats = useMemo(() => deriveStats(polls, metricsById), [polls, metricsById]);

  const reloadPolls = useCallback(async ({ keepId } = {}) => {
    setBusy(true);
    try {
      const previousId = keepId || null;
      const { data, filePath } = await readPollsFile();
      setPollsData(data);
      setPollsFilePath(filePath);
      if (Array.isArray(data.polls) && data.polls.length > 0) {
        const nextIndex = previousId
          ? data.polls.findIndex((poll) => poll.id === previousId)
          : -1;
        setSelectedIndex(nextIndex >= 0 ? nextIndex : 0);
      } else {
        setSelectedIndex(0);
      }
      setStatusLine(`Loaded ${Array.isArray(data.polls) ? data.polls.length : 0} polls.`);
    } catch (error) {
      setStatusLine(`Load failed: ${safeMessage(error)}`);
      setPollsData({ version: 1, updatedAt: nowIso(), polls: [] });
    } finally {
      setBusy(false);
    }
  }, []);

  const fetchMetricsForPoll = useCallback(async (pollId, { silent = false } = {}) => {
    if (!pollId) return null;
    const targetId = String(pollId);
    setMetricsById((previous) => ({
      ...previous,
      [targetId]: {
        ...(previous[targetId] || {}),
        loading: true,
        error: '',
      },
    }));
    try {
      const headers = { accept: 'application/json' };
      if (metricsToken) headers.authorization = `Bearer ${metricsToken}`;
      const response = await fetch(`${apiBase}/polls/${encodeURIComponent(targetId)}/results`, { headers });
      const text = await response.text();
      const payload = parseResponseText(text);
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      const total = Number(payload?.total || 0);
      const counts = payload?.counts && typeof payload.counts === 'object' ? payload.counts : {};
      setMetricsById((previous) => ({
        ...previous,
        [targetId]: {
          loading: false,
          error: '',
          total,
          counts,
          updatedAt: Date.now(),
        },
      }));
      if (!silent) setStatusLine(`Metrics refreshed for ${targetId}.`);
      return { total, counts };
    } catch (error) {
      setMetricsById((previous) => ({
        ...previous,
        [targetId]: {
          loading: false,
          error: safeMessage(error),
          total: 0,
          counts: {},
          updatedAt: Date.now(),
        },
      }));
      if (!silent) setStatusLine(`Metrics failed for ${targetId}: ${safeMessage(error)}`);
      return null;
    }
  }, [apiBase, metricsToken]);

  const refreshAllMetrics = useCallback(async () => {
    if (!polls.length || metricsBusy) return;
    setMetricsBusy(true);
    setStatusLine(`Refreshing results for ${polls.length} polls…`);
    try {
      for (const poll of polls) {
        // Sequential fetch avoids terminal API spam and preserves clear status.
        // eslint-disable-next-line no-await-in-loop
        await fetchMetricsForPoll(poll.id, { silent: true });
      }
      setStatusLine(`Metrics refreshed (${polls.length} polls).`);
    } finally {
      setMetricsBusy(false);
    }
  }, [fetchMetricsForPoll, metricsBusy, polls]);

  const persistPolls = useCallback(async (nextData, message, { selectId } = {}) => {
    setBusy(true);
    try {
      const written = await writePollsFile(nextData);
      setPollsData(written.data);
      setPollsFilePath(written.filePath);
      if (selectId) {
        const nextIndex = written.data.polls.findIndex((poll) => poll.id === selectId);
        setSelectedIndex(nextIndex >= 0 ? nextIndex : 0);
      }
      setStatusLine(message);
      return written.data;
    } catch (error) {
      setStatusLine(`${message} failed: ${safeMessage(error)}`);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const runPublish = useCallback(async (env) => {
    if (busy) return;
    setBusy(true);
    setStatusLine(`Publishing polls to ${env}…`);
    try {
      const result = await publishPolls({ env });
      const synced = Number(result?.payload?.synced || result?.payload?.count || result?.count || 0);
      const events = result?.events || null;
      const eventSuffix = events
        ? ` Events sent:${events.sent || 0} failed:${events.failed || 0} skipped:${events.skipped || 0}.`
        : '';
      setStatusLine(`Published ${synced || result.count} polls to ${result.env} (${result.apiBase}).${eventSuffix}`);
    } catch (error) {
      setStatusLine(`Publish ${env} failed: ${safeMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const openEditor = useCallback((mode) => {
    const target = mode === 'edit' ? selectedPoll : null;
    if (mode === 'edit' && !target) return;
    const nextEditor = makeEditorFromPoll(mode, target, pollsData);
    setEditor(nextEditor);
    setEditorFieldIndex(0);
    setEditorTyping(false);
    setEditorBuffer('');
    setStatusLine(mode === 'edit' ? `Editing ${target.id}` : 'Creating a new poll draft');
  }, [pollsData, selectedPoll]);

  const closeEditor = useCallback(() => {
    setEditor(null);
    setEditorFieldIndex(0);
    setEditorTyping(false);
    setEditorBuffer('');
  }, []);

  const applyStatus = useCallback(async (status) => {
    if (busy || !selectedPoll || !pollsData) return;
    try {
      const next = setPollStatus(pollsData, selectedPoll.id, status);
      const updated = await persistPolls(next, `${selectedPoll.id} → ${status}`, { selectId: selectedPoll.id });
      if (updated) {
        void fetchMetricsForPoll(selectedPoll.id, { silent: true });
      }
    } catch (error) {
      setStatusLine(`Status update failed: ${safeMessage(error)}`);
    }
  }, [busy, fetchMetricsForPoll, persistPolls, pollsData, selectedPoll]);

  const saveEditor = useCallback(async () => {
    if (!editor || !pollsData || busy) return;
    setBusy(true);
    try {
      const fields = editor.fields;
      const normalizedQuestion = String(fields.question || '').trim();
      const options = parseOptionsInput(fields.options);
      if (normalizedQuestion.length < 6) {
        throw new Error('Question must be at least 6 characters.');
      }
      if (options.length < 2) {
        throw new Error('At least two options are required.');
      }
      const closeAtIso = parseCloseAtToIso(fields.closeAt, nowIso());

      let nextPoll = null;
      if (editor.mode === 'create') {
        const requestedId = String(fields.id || '').trim();
        if (requestedId && polls.some((poll) => poll.id.toLowerCase() === requestedId.toLowerCase())) {
          throw new Error(`Poll id already exists: ${requestedId}`);
        }
        const draft = createPollDraft(pollsData, {
          id: requestedId || undefined,
          slug: String(fields.slug || '').trim() || undefined,
          question: normalizedQuestion,
          status: fields.status,
          visibility: fields.visibility,
          manualClose: Boolean(fields.manualClose),
        });
        nextPoll = {
          ...draft,
          question: normalizedQuestion,
          options,
          visibility: fields.visibility,
          status: fields.status,
          closeAt: closeAtIso,
          manualClose: Boolean(fields.manualClose),
        };
        if (String(fields.slug || '').trim()) {
          nextPoll.slug = String(fields.slug || '').trim();
        }
      } else {
        const current = polls.find((poll) => poll.id === editor.sourceId);
        if (!current) throw new Error(`Poll not found: ${editor.sourceId}`);
        nextPoll = {
          ...current,
          slug: String(fields.slug || '').trim() || undefined,
          question: normalizedQuestion,
          options,
          visibility: fields.visibility,
          status: fields.status,
          closeAt: closeAtIso,
          manualClose: Boolean(fields.manualClose),
        };
      }

      const nextData = upsertPoll(pollsData, nextPoll);
      const written = await writePollsFile(nextData);
      setPollsData(written.data);
      setPollsFilePath(written.filePath);
      const nextIndex = written.data.polls.findIndex((poll) => poll.id === nextPoll.id);
      setSelectedIndex(nextIndex >= 0 ? nextIndex : 0);
      setStatusLine(`${editor.mode === 'create' ? 'Created' : 'Updated'} ${nextPoll.id}`);
      closeEditor();
      void fetchMetricsForPoll(nextPoll.id, { silent: true });
    } catch (error) {
      setStatusLine(`Save failed: ${safeMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }, [busy, closeEditor, editor, fetchMetricsForPoll, polls, pollsData]);

  useEffect(() => {
    void reloadPolls();
  }, [reloadPolls]);

  useEffect(() => {
    if (!polls.length) return;
    setSelectedIndex((previous) => clamp(previous, 0, polls.length - 1));
  }, [polls.length]);

  useEffect(() => {
    if (!selectedPoll?.id) return;
    if (metricsById[selectedPoll.id]?.loading) return;
    if (metricsById[selectedPoll.id]?.updatedAt) return;
    void fetchMetricsForPoll(selectedPoll.id, { silent: true });
  }, [fetchMetricsForPoll, metricsById, selectedPoll]);

  const editorFields = useMemo(() => (editor?.mode === 'create'
    ? [
      { key: 'id', label: 'ID', type: 'text', hint: 'unique immutable key' },
      { key: 'slug', label: 'SLUG', type: 'text', hint: 'optional URL slug' },
      { key: 'question', label: 'QUESTION', type: 'text', hint: 'prompt shown to voters' },
      { key: 'options', label: 'OPTIONS', type: 'text', hint: 'pipe separated: A | B | C' },
      { key: 'visibility', label: 'VISIBILITY', type: 'enum', values: VISIBILITY_VALUES },
      { key: 'status', label: 'STATUS', type: 'enum', values: STATUS_VALUES },
      { key: 'closeAt', label: 'CLOSE DATE', type: 'text', hint: 'YYYY-MM-DD or ISO date-time' },
      { key: 'manualClose', label: 'MANUAL CLOSE', type: 'bool' },
    ]
    : [
      { key: 'slug', label: 'SLUG', type: 'text', hint: 'optional URL slug' },
      { key: 'question', label: 'QUESTION', type: 'text', hint: 'prompt shown to voters' },
      { key: 'options', label: 'OPTIONS', type: 'text', hint: 'pipe separated: A | B | C' },
      { key: 'visibility', label: 'VISIBILITY', type: 'enum', values: VISIBILITY_VALUES },
      { key: 'status', label: 'STATUS', type: 'enum', values: STATUS_VALUES },
      { key: 'closeAt', label: 'CLOSE DATE', type: 'text', hint: 'YYYY-MM-DD or ISO date-time' },
      { key: 'manualClose', label: 'MANUAL CLOSE', type: 'bool' },
    ]), [editor?.mode]);

  useInput((input, key) => {
    if (key.ctrl && (input === 'q' || input === 'Q')) return;

    if (editor) {
      const field = editorFields[editorFieldIndex];
      if (!field) return;

      if (editorTyping) {
        if (key.return) {
          const nextFields = { ...editor.fields, [field.key]: editorBuffer };
          setEditor((previous) => ({ ...previous, fields: nextFields }));
          setEditorTyping(false);
          setEditorBuffer('');
          return;
        }
        if (key.escape) {
          setEditorTyping(false);
          setEditorBuffer('');
          return;
        }
        if (isBackspaceKey(input, key) || key.delete) {
          setEditorBuffer((previous) => previous.slice(0, -1));
          return;
        }
        if (shouldAppendWizardChar(input, key)) {
          setEditorBuffer((previous) => previous + input);
        }
        return;
      }

      if (key.escape) {
        closeEditor();
        return;
      }
      if (key.upArrow) {
        setEditorFieldIndex((previous) => clamp(previous - 1, 0, editorFields.length - 1));
        return;
      }
      if (key.downArrow) {
        setEditorFieldIndex((previous) => clamp(previous + 1, 0, editorFields.length - 1));
        return;
      }
      if ((input === 's' || input === 'S') || (key.ctrl && (input === 's' || input === 'S'))) {
        void saveEditor();
        return;
      }

      if (field.type === 'enum') {
        if (key.leftArrow) {
          setEditor((previous) => ({
            ...previous,
            fields: { ...previous.fields, [field.key]: cycleIn(field.values, previous.fields[field.key], -1) },
          }));
          return;
        }
        if (key.rightArrow || key.return || input === ' ') {
          setEditor((previous) => ({
            ...previous,
            fields: { ...previous.fields, [field.key]: cycleIn(field.values, previous.fields[field.key], 1) },
          }));
          return;
        }
      } else if (field.type === 'bool') {
        if (key.leftArrow || key.rightArrow || key.return || input === ' ') {
          setEditor((previous) => ({
            ...previous,
            fields: { ...previous.fields, [field.key]: !previous.fields[field.key] },
          }));
          return;
        }
      } else if (field.type === 'text' && key.return) {
        setEditorTyping(true);
        setEditorBuffer(String(editor.fields[field.key] || ''));
      }
      return;
    }

    if (key.escape) {
      if (typeof onExit === 'function') onExit();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((previous) => clamp(previous - 1, 0, Math.max(0, polls.length - 1)));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((previous) => clamp(previous + 1, 0, Math.max(0, polls.length - 1)));
      return;
    }
    if (busy) return;

    const lower = String(input || '').toLowerCase();
    if (lower === 'n') {
      openEditor('create');
      return;
    }
    if (lower === 'e') {
      openEditor('edit');
      return;
    }
    if (lower === 'o') {
      void applyStatus('open');
      return;
    }
    if (lower === 'c') {
      void applyStatus('closed');
      return;
    }
    if (lower === 'r') {
      if (key.shift) {
        void reloadPolls({ keepId: selectedPoll?.id });
        return;
      }
      if (selectedPoll?.id) {
        void fetchMetricsForPoll(selectedPoll.id);
      }
      return;
    }
    if (lower === 'm') {
      void refreshAllMetrics();
      return;
    }
    if (lower === 't') {
      void runPublish('test');
      return;
    }
    if (lower === 'p') {
      void runPublish('prod');
    }
  });

  if (editor) {
    const activeField = editorFields[editorFieldIndex];
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { color: '#8f98a8' }, `${editor.mode === 'create' ? 'Create poll' : `Edit ${editor.sourceId}`}  (Esc close, Enter edit, S save)`),
      ...editorFields.map((field, index) => {
        const value = editor.fields[field.key];
        const displayValue = field.type === 'bool' ? (value ? 'true' : 'false') : String(value || '');
        const label = `${field.label.padEnd(13)} ${displayValue}`;
        if (index === editorFieldIndex) {
          const typingLine = editorTyping && activeField?.key === field.key
            ? ` > ${editorBuffer}`
            : label;
          return React.createElement(Text, { key: field.key, inverse: true }, typingLine);
        }
        return React.createElement(Text, { key: field.key, color: '#d0d5df' }, label);
      }),
      activeField?.hint
        ? React.createElement(Text, { color: '#8f98a8' }, `Hint: ${activeField.hint}`)
        : null,
      editorTyping
        ? React.createElement(Text, { color: '#8f98a8' }, 'Typing mode: Enter commit, Esc cancel.')
        : React.createElement(Text, { color: '#8f98a8' }, 'Field mode: ↑/↓ move, Enter edit text, ←/→ cycle enums, Space toggle bool, S save.'),
      React.createElement(Text, { color: '#8f98a8' }, `File: ${pollsFilePath || 'loading…'}`),
      React.createElement(Text, { color: '#a6e3a1' }, statusLine),
    );
  }

  if (!pollsData) {
    return React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { color: '#8f98a8' }, 'Loading polls…'),
      React.createElement(Text, { color: '#8f98a8' }, statusLine),
    );
  }

  const listWidth = width >= 130 ? Math.max(56, Math.floor(width * 0.58)) : width;
  const detailWidth = Math.max(32, width - listWidth - (width >= 130 ? 2 : 0));
  const listRows = Math.max(6, height - 11);
  const windowed = computeWindow({
    total: polls.length,
    cursor: clamp(selectedIndex, 0, Math.max(0, polls.length - 1)),
    height: listRows,
  });
  const selectedMetrics = selectedPoll ? metricsById[selectedPoll.id] : null;

  const listPanel = React.createElement(Box, { flexDirection: 'column', width: listWidth },
    React.createElement(Text, { color: '#8f98a8' }, `Polls (${stats.total})  open:${stats.open} closed:${stats.closed} draft:${stats.draft}  public:${stats.public} members:${stats.members}`),
    React.createElement(Text, { color: '#8f98a8' }, `Votes loaded: ${stats.votesKnown}/${stats.total} polls  total votes: ${stats.votesTotal}`),
    polls.length === 0
      ? React.createElement(Text, { color: '#d0d5df' }, 'No polls found. Press N to create a poll.')
      : null,
    windowed.start > 0 ? React.createElement(Text, { color: '#8f98a8' }, '…') : null,
    ...polls.slice(windowed.start, windowed.end).map((poll, localIndex) => {
      const absoluteIndex = windowed.start + localIndex;
      const metric = metricsById[poll.id];
      const votes = metric && !metric.loading && !metric.error ? String(metric.total || 0).padStart(4) : '   ?';
      const row = `${String(poll.status || '').padEnd(6)} ${String(poll.visibility || '').padEnd(7)} ${formatShortDate(poll.closeAt).padEnd(10)} v:${votes} ${truncate(poll.id, 28).padEnd(28)} ${truncate(poll.question, Math.max(10, listWidth - 68))}`;
      return React.createElement(Text, absoluteIndex === selectedIndex
        ? { key: poll.id, inverse: true }
        : { key: poll.id, color: '#d0d5df' }, row);
    }),
    windowed.end < polls.length ? React.createElement(Text, { color: '#8f98a8' }, '…') : null,
    React.createElement(Text, { color: '#8f98a8' }, 'Keys: N create  E edit  O open  C close  R refresh selected metrics  M refresh all metrics'),
    React.createElement(Text, { color: '#8f98a8' }, '      T publish test  P publish prod  Shift+R reload polls file  Esc back'),
    React.createElement(Text, { color: '#8f98a8' }, `API: ${apiBase}`),
    React.createElement(Text, metricsBusy || busy ? { color: '#ffcc66' } : { color: '#a6e3a1' }, statusLine),
  );

  const detailPanel = React.createElement(Box, { flexDirection: 'column', width: detailWidth },
    !selectedPoll
      ? React.createElement(Text, { color: '#8f98a8' }, 'Select a poll to inspect details and results.')
      : React.createElement(React.Fragment, null,
        React.createElement(Text, { color: '#8f98a8' }, `Selected: ${selectedPoll.id}`),
        React.createElement(Text, { color: '#d0d5df' }, `Status: ${selectedPoll.status}  Visibility: ${selectedPoll.visibility}`),
        React.createElement(Text, { color: '#d0d5df' }, `Created: ${formatShortDate(selectedPoll.createdAt)}  Close: ${formatShortDate(selectedPoll.closeAt)}  Manual close: ${selectedPoll.manualClose ? 'yes' : 'no'}`),
        React.createElement(Text, { color: '#d0d5df' }, `Question: ${selectedPoll.question}`),
        React.createElement(Text, { color: '#8f98a8' }, 'Live results'),
        selectedMetrics?.loading
          ? React.createElement(Text, { color: '#8f98a8' }, 'Loading results…')
          : selectedMetrics?.error
            ? React.createElement(Text, { color: '#ff7b72' }, `Results unavailable: ${selectedMetrics.error}`)
            : React.createElement(React.Fragment, null,
              React.createElement(Text, { color: '#d0d5df' }, `Total votes: ${Number(selectedMetrics?.total || 0)}`),
              ...(Array.isArray(selectedPoll.options) ? selectedPoll.options.map((option, index) => {
                const total = Number(selectedMetrics?.total || 0);
                const rawCount = Number(selectedMetrics?.counts?.[String(index)] ?? selectedMetrics?.counts?.[index] ?? 0);
                const percentage = total > 0 ? Math.round((rawCount / total) * 100) : 0;
                const line = `${String(index + 1).padStart(2)}. ${truncate(option, Math.max(6, detailWidth - 40)).padEnd(Math.max(6, detailWidth - 40))} ${String(rawCount).padStart(4)} (${String(percentage).padStart(3)}%) ${makeBar(rawCount, total)}`;
                return React.createElement(Text, { key: `${selectedPoll.id}-opt-${index}`, color: '#d0d5df' }, line);
              }) : []),
            ),
      ),
  );

  if (width >= 130) {
    return React.createElement(Box, { flexDirection: 'row' },
      listPanel,
      React.createElement(Box, { width: 2 }),
      detailPanel,
    );
  }

  return React.createElement(Box, { flexDirection: 'column' },
    listPanel,
    React.createElement(Box, { marginTop: 1 }, detailPanel),
  );
}
