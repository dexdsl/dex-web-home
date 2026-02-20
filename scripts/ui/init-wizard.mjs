import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import { BUCKETS, slugify } from '../lib/entry-schema.mjs';

function iframeFor(url) {
  return `<iframe src="${url}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
}

function nowStamp() {
  return new Date().toISOString().slice(11, 19);
}

function pushLog(log, message) {
  log(`[${nowStamp()}] ${message}`);
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
  'title', 'slug', 'lookup', 'videoMode', 'videoUrl', 'videoEmbed',
  'descriptionHtml', 'buckets', 'attribution', 'artist', 'year', 'season',
  'location', 'specialEventImage', 'artistLinks', 'manifestJson', 'authEnabled', 'confirm',
];

function TextStep({ label, value, hint }) {
  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Text, { color: '#8f98a8' }, label),
    React.createElement(Text, { color: '#d0d5df' }, value || ''),
    hint ? React.createElement(Text, { color: '#6e7688' }, hint) : null,
  );
}

function SelectStep({ label, choices, selected }) {
  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Text, { color: '#8f98a8' }, label),
    ...choices.map((c, idx) => React.createElement(Text, idx === selected ? { key: c.value, inverse: true } : { key: c.value, color: '#d0d5df' }, c.title)),
  );
}

export function InitWizard({ onCancel, onComplete, onLog, onRunInit }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    slugTouched: false,
    lookupNumber: '',
    videoMode: 'url',
    videoUrl: '',
    videoEmbed: '',
    descriptionHtml: '<p></p>',
    buckets: ['A'],
    attributionSentence: '',
    artistName: '',
    year: `${new Date().getUTCFullYear()}`,
    season: 'S1',
    location: '',
    specialEventImage: '',
    artistLinksRaw: '',
    manifestRaw: '{}',
    authEnabled: true,
  });

  const currentStep = STEPS[stepIdx];

  useEffect(() => {
    if (form.slugTouched) return;
    setForm((prev) => ({ ...prev, slug: slugify(prev.title || '') }));
  }, [form.title, form.slugTouched]);

  const canAdvance = useMemo(() => {
    if (currentStep === 'title') return !!form.title.trim();
    if (currentStep === 'slug') return !!form.slug.trim();
    if (currentStep === 'lookup') return !!form.lookupNumber.trim();
    if (currentStep === 'videoUrl' && form.videoMode === 'url') return !!form.videoUrl.trim();
    if (currentStep === 'videoEmbed' && form.videoMode === 'embed') return !!form.videoEmbed.trim();
    if (currentStep === 'attribution') return !!form.attributionSentence.trim();
    if (currentStep === 'artist') return !!form.artistName.trim();
    if (currentStep === 'year') return !!form.year.trim();
    if (currentStep === 'season') return !!form.season.trim();
    if (currentStep === 'location') return !!form.location.trim();
    return true;
  }, [currentStep, form]);

  const advance = () => {
    if (!canAdvance) return;
    if (currentStep === 'videoMode') {
      setStepIdx(stepIdx + 1);
      return;
    }
    if (currentStep === 'videoUrl' && form.videoMode === 'embed') {
      setStepIdx(stepIdx + 1);
      return;
    }
    if (currentStep === 'videoEmbed' && form.videoMode === 'url') {
      setStepIdx(stepIdx + 1);
      return;
    }
    setStepIdx((v) => Math.min(STEPS.length - 1, v + 1));
  };

  const goBack = () => setStepIdx((v) => Math.max(0, v - 1));

  const finish = async () => {
    let manifest;
    try {
      manifest = JSON.parse(form.manifestRaw || '{}');
    } catch (error) {
      pushLog(onLog, `Manifest JSON parse error: ${error.message}`);
      return;
    }

    const artistLinks = form.artistLinksRaw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((pair) => {
        const [label, href] = pair.split('|').map((v) => (v || '').trim());
        return { label, href };
      })
      .filter((item) => item.label && item.href);

    const sidebar = defaultSidebar();
    sidebar.lookupNumber = form.lookupNumber;
    sidebar.buckets = form.buckets;
    sidebar.attributionSentence = form.attributionSentence;
    sidebar.specialEventImage = form.specialEventImage || null;
    sidebar.credits.artist = { name: form.artistName, links: artistLinks };
    sidebar.credits.year = Number(form.year);
    sidebar.credits.season = form.season;
    sidebar.credits.location = form.location;

    const data = {
      slug: form.slug,
      title: form.title,
      video: form.videoMode === 'embed'
        ? { mode: 'embed', dataUrl: '', dataHtml: form.videoEmbed }
        : { mode: 'url', dataUrl: form.videoUrl, dataHtml: iframeFor(form.videoUrl) },
      descriptionHtml: form.descriptionHtml || '<p></p>',
      sidebar,
      manifest,
      authEnabled: form.authEnabled,
    };

    setBusy(true);
    try {
      const report = await onRunInit(data, (message) => pushLog(onLog, message));
      pushLog(onLog, 'Init finished (ok)');
      pushLog(onLog, `Output: ${report.html}`);
      pushLog(onLog, `Injection: video=${report.injectionStrategy.video}, desc=${report.injectionStrategy.description}, sidebar=${report.injectionStrategy.sidebar}`);
      onComplete();
    } catch (error) {
      pushLog(onLog, `Init failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  useInput((input, key) => {
    if (busy) return;
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.leftArrow) {
      goBack();
      return;
    }

    if (currentStep === 'videoMode') {
      if (key.upArrow || key.downArrow) {
        setForm((prev) => ({ ...prev, videoMode: prev.videoMode === 'url' ? 'embed' : 'url' }));
      } else if (key.return) advance();
      return;
    }

    if (currentStep === 'buckets') {
      if (key.upArrow) {
        setForm((prev) => {
          const idx = BUCKETS.indexOf(prev._cursor || 'A');
          const next = idx <= 0 ? BUCKETS.length - 1 : idx - 1;
          return { ...prev, _cursor: BUCKETS[next] };
        });
        return;
      }
      if (key.downArrow) {
        setForm((prev) => {
          const idx = BUCKETS.indexOf(prev._cursor || 'A');
          const next = (idx + 1) % BUCKETS.length;
          return { ...prev, _cursor: BUCKETS[next] };
        });
        return;
      }
      if (input === ' ') {
        setForm((prev) => {
          const cursor = prev._cursor || 'A';
          const set = new Set(prev.buckets);
          if (set.has(cursor)) set.delete(cursor);
          else set.add(cursor);
          if (set.size === 0) set.add('A');
          return { ...prev, buckets: BUCKETS.filter((b) => set.has(b)) };
        });
        return;
      }
      if (key.return) {
        advance();
      }
      return;
    }

    if (currentStep === 'authEnabled') {
      if (key.upArrow || key.downArrow || input === ' ') {
        setForm((prev) => ({ ...prev, authEnabled: !prev.authEnabled }));
        return;
      }
      if (key.return) advance();
      return;
    }

    if (currentStep === 'confirm') {
      if (key.return) finish();
      return;
    }

    if (key.return) {
      advance();
      return;
    }

    if (key.backspace || key.delete) {
      setForm((prev) => {
        const next = { ...prev };
        if (currentStep === 'slug') next.slugTouched = true;
        if (currentStep === 'lookup') next.lookupNumber = prev.lookupNumber.slice(0, -1);
        if (currentStep === 'title') next.title = prev.title.slice(0, -1);
        if (currentStep === 'slug') next.slug = prev.slug.slice(0, -1);
        if (currentStep === 'videoUrl') next.videoUrl = prev.videoUrl.slice(0, -1);
        if (currentStep === 'videoEmbed') next.videoEmbed = prev.videoEmbed.slice(0, -1);
        if (currentStep === 'descriptionHtml') next.descriptionHtml = prev.descriptionHtml.slice(0, -1);
        if (currentStep === 'attribution') next.attributionSentence = prev.attributionSentence.slice(0, -1);
        if (currentStep === 'artist') next.artistName = prev.artistName.slice(0, -1);
        if (currentStep === 'year') next.year = prev.year.slice(0, -1);
        if (currentStep === 'season') next.season = prev.season.slice(0, -1);
        if (currentStep === 'location') next.location = prev.location.slice(0, -1);
        if (currentStep === 'specialEventImage') next.specialEventImage = prev.specialEventImage.slice(0, -1);
        if (currentStep === 'artistLinks') next.artistLinksRaw = prev.artistLinksRaw.slice(0, -1);
        if (currentStep === 'manifestJson') next.manifestRaw = prev.manifestRaw.slice(0, -1);
        return next;
      });
      return;
    }

    if (!key.ctrl && !key.meta && input && input >= ' ' && input <= '~') {
      setForm((prev) => {
        const next = { ...prev };
        if (currentStep === 'title') next.title += input;
        if (currentStep === 'slug') { next.slugTouched = true; next.slug += input; }
        if (currentStep === 'lookup') next.lookupNumber += input;
        if (currentStep === 'videoUrl') next.videoUrl += input;
        if (currentStep === 'videoEmbed') next.videoEmbed += input;
        if (currentStep === 'descriptionHtml') next.descriptionHtml += input;
        if (currentStep === 'attribution') next.attributionSentence += input;
        if (currentStep === 'artist') next.artistName += input;
        if (currentStep === 'year') next.year += input;
        if (currentStep === 'season') next.season += input;
        if (currentStep === 'location') next.location += input;
        if (currentStep === 'specialEventImage') next.specialEventImage += input;
        if (currentStep === 'artistLinks') next.artistLinksRaw += input;
        if (currentStep === 'manifestJson') next.manifestRaw += input;
        return next;
      });
    }
  });

  const bucketCursor = form._cursor || 'A';

  let body = null;
  if (currentStep === 'videoMode') {
    body = React.createElement(SelectStep, {
      label: 'Video input mode',
      choices: [{ title: 'URL', value: 'url' }, { title: 'Raw embed HTML', value: 'embed' }],
      selected: form.videoMode === 'url' ? 0 : 1,
    });
  } else if (currentStep === 'buckets') {
    body = React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { color: '#8f98a8' }, 'Buckets (space toggle, enter confirm)'),
      ...BUCKETS.map((bucket) => {
        const prefix = form.buckets.includes(bucket) ? '[x]' : '[ ]';
        const line = `${prefix} ${bucket}`;
        return React.createElement(Text, bucket === bucketCursor ? { key: bucket, inverse: true } : { key: bucket, color: '#d0d5df' }, line);
      }),
    );
  } else if (currentStep === 'authEnabled') {
    body = React.createElement(SelectStep, {
      label: 'Ensure canonical auth snippet + strip legacy Auth0 blocks?',
      choices: [{ title: 'Enabled', value: 'yes' }, { title: 'Disabled', value: 'no' }],
      selected: form.authEnabled ? 0 : 1,
    });
  } else if (currentStep === 'confirm') {
    body = React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { color: '#8f98a8' }, 'Press Enter to run init. Esc cancels.'),
      React.createElement(Text, { color: '#d0d5df' }, `title=${form.title}`),
      React.createElement(Text, { color: '#d0d5df' }, `slug=${form.slug}`),
      React.createElement(Text, { color: '#d0d5df' }, `lookup=${form.lookupNumber}`),
      React.createElement(Text, { color: '#d0d5df' }, `video=${form.videoMode}`),
    );
  } else {
    const labels = {
      title: 'Title', slug: 'Slug', lookup: 'Lookup number', videoUrl: 'Video URL', videoEmbed: 'Raw embed HTML',
      descriptionHtml: 'Description HTML', attribution: 'Attribution sentence', artist: 'Artist name',
      year: 'Year', season: 'Season', location: 'Location', specialEventImage: 'Special event image URL (optional)',
      artistLinks: 'Artist links (label|href, comma-separated, optional)', manifestJson: 'Manifest JSON',
    };
    const values = {
      title: form.title, slug: form.slug, lookup: form.lookupNumber, videoUrl: form.videoUrl,
      videoEmbed: form.videoEmbed, descriptionHtml: form.descriptionHtml, attribution: form.attributionSentence,
      artist: form.artistName, year: form.year, season: form.season, location: form.location,
      specialEventImage: form.specialEventImage, artistLinks: form.artistLinksRaw, manifestJson: form.manifestRaw,
    };
    body = React.createElement(TextStep, { label: labels[currentStep], value: values[currentStep], hint: 'Enter next • Esc back to commands • ← previous step' });
  }

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Text, { color: '#8f98a8' }, `Init wizard (${stepIdx + 1}/${STEPS.length})`),
    busy ? React.createElement(Text, { color: '#ffcc00' }, 'Running init...') : null,
    body,
    React.createElement(Text, { color: '#6e7688' }, chalk.dim('Esc cancel   ← previous step   Enter next/confirm')),
  );
}
