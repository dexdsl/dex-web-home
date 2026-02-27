import { animate } from 'framer-motion/dom';

(() => {
  if (typeof window === 'undefined') return;
  if (window.__dxSubmitSamplesRuntimeLoaded) {
    if (typeof window.__dxSubmitSamplesMount === 'function') {
      try {
        window.__dxSubmitSamplesMount({ force: true });
      } catch {}
    }
    return;
  }
  window.__dxSubmitSamplesRuntimeLoaded = true;

  const FETCH_STATE_LOADING = 'loading';
  const FETCH_STATE_READY = 'ready';
  const FETCH_STATE_ERROR = 'error';
  const DX_MIN_SHEEN_MS = 120;
  const AUTH_TIMEOUT_MS = 3200;
  const SUBMIT_TIMEOUT_MS = 15000;
  const DEFAULT_WEBAPP_URL =
    'https://script.google.com/macros/s/AKfycbyh5TPML3_y5-j1QoOKfju_MayO1_0JErwvVkH3Eba195q_EmWGCEu3CdFFeohWes3Qzw/exec';
  const DEFAULT_DAILY_LIMIT = 5;

  const STEPS = [
    { key: 'intro', title: 'Program Brief', short: 'Brief' },
    { key: 'metadata', title: 'Submission Metadata', short: 'Meta' },
    { key: 'license', title: 'License Agreement', short: 'License' },
    { key: 'upload', title: 'Upload Link + Services', short: 'Upload' },
    { key: 'done', title: 'Submission Complete', short: 'Done' },
  ];

  const CATEGORY_OPTIONS = [
    '',
    'V - Voice + Body',
    'K - Keyboards',
    'B - Brass',
    'E - Electronics',
    'S - Strings',
    'W - Winds',
    'P - Percussion',
    'X - Other',
  ];

  const COLLECTION_OPTIONS = [
    { value: 'V', label: 'Video' },
    { value: 'A', label: 'Audio' },
    { value: 'AV', label: 'Audio-visual' },
    { value: 'O', label: 'Other' },
  ];

  const OUTPUT_OPTIONS = [
    { value: '1080p', label: '1080p video' },
    { value: '4K', label: '4K video' },
    { value: 'ste', label: 'Stereo audio' },
    { value: '4ch', label: '4-channel audio' },
  ];

  const SERVICE_OPTIONS = [
    { value: 'chop', label: 'Bucket chop', locked: true },
    { value: 'credits', label: 'Dex credits roll', locked: true },
    { value: 'render', label: '1080p/MP3 copies', locked: true },
    { value: 'grade', label: 'Color grading' },
    { value: 'mix', label: 'Mixing' },
    { value: 'master', label: 'Mastering' },
    { value: 'extra', label: 'Other edits (notes)' },
  ];

  const LICENSE_OPTIONS = [
    {
      id: 'joint',
      label: 'Joint CC-BY 4.0',
      summary: 'Dex can transform a library-ready copy; you keep your original rights.',
      copy: `Joint CC-BY 4.0 License Agreement\n\nBy selecting Joint CC-BY 4.0, you grant Dex a perpetual, worldwide, non-exclusive license to transform, remix, and redistribute a library-ready copy of your submission under CC-BY 4.0. You retain full ownership of the original. Downstream users must attribute you as entered in Creator.\n\nFull legal code:\nhttps://creativecommons.org/licenses/by/4.0/legalcode`,
    },
    {
      id: 'cc-by',
      label: 'CC-BY 4.0 (submitter-only)',
      summary: 'Dex hosts the file as submitted, without transformations.',
      copy: `CC-BY 4.0 (Submitter-Only) License Agreement\n\nBy selecting CC-BY 4.0 (Submitter-Only), you license Dex to host your submission exactly as provided. You retain all rights. Downstream users may use and adapt under CC-BY with mandatory attribution.\n\nFull legal code:\nhttps://creativecommons.org/licenses/by/4.0/legalcode`,
    },
    {
      id: 'cc0',
      label: 'CC0 (Public Domain)',
      summary: 'Waives rights for unrestricted public-domain usage.',
      copy: `CC0 1.0 Universal Public Domain Dedication\n\nBy selecting CC0, you waive copyright and related rights worldwide. Dex and all users may use, modify, and distribute your file without attribution or restriction.\n\nFull text:\nhttps://creativecommons.org/publicdomain/zero/1.0/legalcode`,
    },
  ];

  const KEY_CENTER_OPTIONS = [
    'C',
    'C♯/D♭',
    'D',
    'D♯/E♭',
    'E',
    'F',
    'F♯/G♭',
    'G',
    'G♯/A♭',
    'A',
    'A♯/B♭',
    'B',
  ];

  const KEY_CENTER_24_TET_OPTIONS = [
    'C',
    'C quarter-sharp',
    'C♯/D♭',
    'D quarter-flat',
    'D',
    'D quarter-sharp',
    'D♯/E♭',
    'E quarter-flat',
    'E',
    'E quarter-sharp',
    'F',
    'F quarter-sharp',
    'F♯/G♭',
    'G quarter-flat',
    'G',
    'G quarter-sharp',
    'G♯/A♭',
    'A quarter-flat',
    'A',
    'A quarter-sharp',
    'A♯/B♭',
    'B quarter-flat',
    'B',
    'B quarter-sharp',
  ];

  const PITCH_SYSTEM_OPTIONS = [
    { value: '12-tet', label: '12-TET' },
    { value: '24-tet', label: '24-TET' },
    { value: 'ji', label: 'Just Intonation (JI)' },
    { value: 'atonal', label: 'Atonal' },
    { value: 'non-pitched', label: 'Non-pitched' },
  ];

  const PITCH_DESCRIPTOR_HINTS = {
    ji: 'Examples: 5/4 on C, 7/4 on D, 11-limit drone on A',
  };

  const TAG_HINT =
    'Met, Fre, Perc, Sus, Cle, Dis, Mono, Poly, Lou, Qui, Med, Bra, Exc, Sta, Sho, Lon, Oth, Ow, Mid, Hi, Spa';

  const STEP_GUIDANCE = {
    intro: 'Review the process and quality targets before you start.',
    metadata: 'Provide enough context for fast review and routing.',
    license: 'Choose your licensing mode before upload handoff.',
    upload: 'Paste a public link and select optional post-production.',
    done: 'Track status in your inbox submission timeline.',
  };

  function createInitialMeta() {
    return {
      title: '',
      creator: '',
      category: '',
      instrument: '',
      bpm: '',
      pitchSystem: '12-tet',
      pitchDescriptor: '',
      keyCenter: '',
      scaleQuality: '',
      tags: '',
      collectionType: '',
      outputTypes: [],
      services: ['chop', 'credits', 'render'],
      notes: '',
      link: '',
    };
  }

  function makeState(config) {
    return {
      step: 0,
      prevProgress: 1 / STEPS.length,
      quotaLeft: config.dailyLimit,
      webappUrl: config.webappUrl,
      auth0Sub: '',
      meta: createInitialMeta(),
      licenseType: 'joint',
      lastSubmissionRow: '000',
      lastSubmissionLookup: '',
      submitting: false,
      submitTicket: 0,
    };
  }

  let state = null;
  let liveRoot = null;

  function text(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizePitchSystem(value) {
    const normalized = text(value).toLowerCase();
    if (normalized === '24-tet') return '24-tet';
    if (normalized === 'ji') return 'ji';
    if (normalized === 'atonal') return 'atonal';
    if (normalized === 'non-pitched') return 'non-pitched';
    return '12-tet';
  }

  function serializePitchSelection(pitchSystem, pitchDescriptor) {
    const system = normalizePitchSystem(pitchSystem);
    const descriptor = text(pitchDescriptor);

    if (system === 'atonal') return 'Atonal';
    if (system === 'non-pitched') return 'Non-pitched';
    if (system === '24-tet') return descriptor ? `24-TET: ${descriptor}` : '24-TET';
    if (system === 'ji') return descriptor ? `JI: ${descriptor}` : 'JI';
    if (!descriptor) return '';
    return `12-TET: ${descriptor}`;
  }

  function isPitchRootDropdownSystem(pitchSystem) {
    return pitchSystem === '12-tet' || pitchSystem === '24-tet';
  }

  function getPitchRootOptions(pitchSystem) {
    if (pitchSystem === '24-tet') return KEY_CENTER_24_TET_OPTIONS;
    if (pitchSystem === '12-tet') return KEY_CENTER_OPTIONS;
    return [];
  }

  function normalizePitchDescriptorForSystem(pitchSystem, descriptor) {
    if (!isPitchRootDropdownSystem(pitchSystem)) return descriptor;
    const options = getPitchRootOptions(pitchSystem);
    const normalized = text(descriptor);
    return options.includes(normalized) ? normalized : '';
  }

  function syncLegacyPitchFields(meta) {
    if (!meta || typeof meta !== 'object') return '';
    meta.pitchSystem = normalizePitchSystem(meta.pitchSystem);
    if (meta.pitchSystem === 'atonal' || meta.pitchSystem === 'non-pitched') {
      meta.pitchDescriptor = '';
    }
    meta.keyCenter = serializePitchSelection(meta.pitchSystem, meta.pitchDescriptor);
    return meta.keyCenter;
  }

  function summarizePitch(meta) {
    if (!meta || typeof meta !== 'object') return 'Unspecified';
    const serialized = text(syncLegacyPitchFields(meta));
    return serialized || 'Unspecified';
  }

  function toLookupWord(value, length, fallback) {
    const letters = String(value || '').replace(/[^A-Za-z]/g, '');
    if (!letters) return fallback;
    const normalized = letters.slice(0, Math.max(1, length)).padEnd(length, 'X').slice(0, length);
    return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1).toLowerCase()}`;
  }

  function parseCollectionTypeCode(value) {
    const raw = text(value, '').toUpperCase();
    if (raw === 'AV') return 'AV';
    if (raw === 'A' || raw.includes('AUDIO')) return 'A';
    if (raw === 'V' || raw.includes('VIDEO')) return 'V';
    return 'O';
  }

  function parseInstrumentTypeCode(value) {
    const raw = text(value, '').toUpperCase();
    const first = raw.match(/[A-Z]/)?.[0] || '';
    return ['K', 'B', 'E', 'S', 'W', 'P', 'V', 'X'].includes(first) ? first : 'X';
  }

  function parseSurnameCandidate(value) {
    const raw = text(value, '');
    if (!raw) return '';
    if (raw.includes(',')) return text(raw.split(',')[0], '');
    const parts = raw.split(/\s+/).filter(Boolean);
    return text(parts[parts.length - 1], '');
  }

  function resolveAuthSurname() {
    const user = window.AUTH0_USER && typeof window.AUTH0_USER === 'object'
      ? window.AUTH0_USER
      : null;
    if (!user) return '';
    const direct = text(user.family_name || user.surname || user.last_name, '');
    if (direct) return direct;
    return parseSurnameCandidate(user.name || user.nickname || user.email || '');
  }

  function parsePerformerToken(creator) {
    const surname = resolveAuthSurname() || parseSurnameCandidate(creator);
    const letters = String(surname || '').replace(/[^A-Za-z]/g, '');
    if (!letters) return 'An';
    const token = letters.slice(0, 2).padEnd(2, 'X');
    return `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`;
  }

  function formatCounter(value) {
    const parsed = Number.parseInt(String(value || '0'), 10);
    const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    return String(safe).padStart(2, '0');
  }

  function buildGeneratedSubmissionLookup(counterValue) {
    const counter = formatCounter(counterValue);
    const instrumentType = parseInstrumentTypeCode(state?.meta?.category);
    const instrumentPrefix = toLookupWord(state?.meta?.instrument, 3, 'Unk');
    const performerToken = parsePerformerToken(state?.meta?.creator);
    const collectionType = parseCollectionTypeCode(state?.meta?.collectionType);
    const year = new Date().getFullYear();
    return `SUB${counter}-${instrumentType}.${instrumentPrefix} ${performerToken} ${collectionType}${year}`;
  }

  function resolveLookupFromSubmitResponse(response, rowNumber) {
    const value = response && typeof response === 'object' ? response : {};
    const lookup = text(
      value.effectiveLookupNumber
        || value.effective_lookup_number
        || value.finalLookupNumber
        || value.final_lookup_number
        || value.finalLookupBase
        || value.final_lookup_base
        || value.submissionLookupGenerated
        || value.submission_lookup_generated
        || value.lookup,
      '',
    );
    return lookup || buildGeneratedSubmissionLookup(rowNumber);
  }

  function create(tag, className = '', value = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value) el.textContent = value;
    return el;
  }

  function isReducedMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  function toConfig(root) {
    const runtime =
      typeof window.__DX_SUBMIT_SAMPLES_CONFIG === 'object' && window.__DX_SUBMIT_SAMPLES_CONFIG
        ? window.__DX_SUBMIT_SAMPLES_CONFIG
        : {};

    const webappUrl = text(runtime.webappUrl || root?.dataset?.webappUrl || DEFAULT_WEBAPP_URL, DEFAULT_WEBAPP_URL);
    const dailyLimitRaw = runtime.dailyLimit ?? root?.dataset?.dailyLimit ?? DEFAULT_DAILY_LIMIT;
    const dailyLimit = Math.max(1, Math.min(99, Math.floor(number(dailyLimitRaw, DEFAULT_DAILY_LIMIT))));

    return { webappUrl, dailyLimit };
  }

  function setFetchState(root, fetchState) {
    root.setAttribute('data-dx-fetch-state', fetchState);
    if (fetchState === FETCH_STATE_LOADING) {
      root.setAttribute('aria-busy', 'true');
    } else {
      root.removeAttribute('aria-busy');
    }
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
  }

  async function finalizeFetchState(root, startTs, fetchState = FETCH_STATE_READY) {
    const elapsed = performance.now() - startTs;
    if (elapsed < DX_MIN_SHEEN_MS) {
      await delay(DX_MIN_SHEEN_MS - elapsed);
    }
    setFetchState(root, fetchState);
  }

  function showToast(message, isError = false) {
    if (!(liveRoot instanceof HTMLElement)) return;
    const stack = liveRoot.querySelector('[data-dx-submit-toasts]');
    if (!(stack instanceof HTMLElement)) return;

    const item = create('p', 'dx-submit-toast', message);
    if (isError) item.classList.add('dx-submit-toast--error');
    stack.appendChild(item);

    if (!isReducedMotion()) {
      animate(
        item,
        { opacity: [0, 1], y: [10, 0] },
        { duration: 0.22, ease: 'easeOut' },
      );
    }

    window.setTimeout(() => {
      if (!item.isConnected) return;
      if (isReducedMotion()) {
        item.remove();
        return;
      }
      animate(item, { opacity: [1, 0], y: [0, -8] }, { duration: 0.18, ease: 'easeIn' }).finished.finally(() => {
        item.remove();
      });
    }, 2600);
  }

  function validateMeta() {
    const required = ['title', 'creator', 'instrument', 'category', 'collectionType'];
    for (const key of required) {
      const value = state.meta[key];
      if (Array.isArray(value) ? value.length === 0 : !text(value)) {
        showToast(`Missing ${key}`, true);
        return false;
      }
    }
    return true;
  }

  function toBadge(label, selected, onClick, disabled = false) {
    const button = create('button', 'dx-submit-badge', label);
    button.type = 'button';
    if (selected) button.classList.add('is-selected');
    if (disabled) {
      button.classList.add('is-disabled');
      button.disabled = true;
    }
    if (typeof onClick === 'function' && !disabled) {
      button.addEventListener('click', onClick);
    }
    return button;
  }

  function wrapField(labelText, required = false) {
    const field = create('label', 'dx-submit-field');
    const label = create('span', 'dx-submit-field-label', `${labelText}${required ? ' *' : ''}`);
    field.appendChild(label);
    return field;
  }

  function buildProgressHeader() {
    const wrap = create('div', 'dx-submit-progress-wrap');
    wrap.setAttribute('data-dx-submit-progress', String(state.step));

    const row = create('div', 'dx-submit-progress-row');
    STEPS.forEach((step, index) => {
      const chip = create('button', 'dx-submit-step-chip', `${index + 1}. ${step.short}`);
      chip.type = 'button';
      chip.disabled = index > state.step;
      chip.setAttribute('data-step-key', step.key);
      if (index < state.step) chip.classList.add('is-done');
      if (index === state.step) chip.classList.add('is-active');
      chip.addEventListener('click', () => {
        if (index > state.step) return;
        state.step = index;
        render();
      });
      row.appendChild(chip);
    });

    const bar = create('div', 'dx-submit-progress-bar');
    const fill = create('span', 'dx-submit-progress-fill');
    fill.style.transform = `scaleX(${(state.step + 1) / STEPS.length})`;
    bar.appendChild(fill);

    wrap.append(row, bar);
    return wrap;
  }

  function buildIntroStep() {
    const section = create('section', 'dx-submit-stage-card');
    section.setAttribute('data-dx-submit-step', 'intro');

    section.appendChild(create('p', 'dx-submit-kicker', 'Submission Program'));
    section.appendChild(create('h2', 'dx-submit-title', 'Share source media. We track the journey end-to-end.'));

    const lead = create(
      'p',
      'dx-submit-copy',
      'Upload a public master-link and metadata. Dex reviews within 7 days, then routes to revision, acceptance, or release.',
    );
    section.appendChild(lead);

    const list = create('ul', 'dx-submit-list');
    [
      'Sent: your source link + metadata received.',
      'Received/Reviewing: staff validates format and attribution.',
      'Accepted/Rejected: decision + note appears in your timeline.',
      'In library: final release links appear when published.',
    ].forEach((item) => list.appendChild(create('li', 'dx-submit-list-item', item)));
    section.appendChild(list);

    const specs = create('div', 'dx-submit-pill-group');
    ['4K/24fps preferred', '48kHz / 24-bit WAV preferred', 'Original work only', 'Lower-res accepted'].forEach((pill) => {
      specs.appendChild(create('span', 'dx-submit-pill', pill));
    });
    section.appendChild(specs);

    const footer = create('div', 'dx-submit-stage-actions');
    const quota = create('p', 'dx-submit-copy dx-submit-copy--compact', `Daily uploads available: ${state.quotaLeft} / ${DEFAULT_DAILY_LIMIT}`);
    const begin = create('button', 'cta-btn dx-button-element dx-button-size--md dx-button-element--primary', 'Begin');
    begin.type = 'button';
    begin.addEventListener('click', () => {
      state.step = 1;
      render();
    });
    footer.append(quota, begin);
    section.appendChild(footer);

    return section;
  }

  function buildMetadataStep() {
    const section = create('section', 'dx-submit-stage-card');
    section.setAttribute('data-dx-submit-step', 'metadata');

    section.appendChild(create('p', 'dx-submit-kicker', 'Step 2'));
    section.appendChild(create('h2', 'dx-submit-title', 'Metadata that powers discoverability and review speed'));

    const grid = create('div', 'dx-submit-grid');

    const titleField = wrapField('Proposed sample title', true);
    const titleInput = create('input', 'dx-submit-input');
    titleInput.type = 'text';
    titleInput.maxLength = 100;
    titleInput.placeholder = 'Ex: Prepared Trombone Long Tones';
    titleInput.value = state.meta.title;
    titleInput.addEventListener('input', (event) => {
      state.meta.title = event.target.value;
    });
    titleField.appendChild(titleInput);
    grid.appendChild(titleField);

    const creatorField = wrapField('Sample creator(s)', true);
    const creatorInput = create('input', 'dx-submit-input');
    creatorInput.type = 'text';
    creatorInput.maxLength = 2000;
    creatorInput.placeholder = 'Ex: Jane Doe, John Doe';
    creatorInput.value = state.meta.creator;
    creatorInput.addEventListener('input', (event) => {
      state.meta.creator = event.target.value;
    });
    creatorField.appendChild(creatorInput);
    grid.appendChild(creatorField);

    const categoryField = wrapField('Instrument category', true);
    const categorySelect = create('select', 'dx-submit-input');
    CATEGORY_OPTIONS.forEach((value) => {
      const option = create('option', '', value || 'Choose category');
      option.value = value;
      categorySelect.appendChild(option);
    });
    categorySelect.value = state.meta.category;
    categorySelect.addEventListener('change', (event) => {
      state.meta.category = event.target.value;
    });
    categoryField.appendChild(categorySelect);
    grid.appendChild(categoryField);

    const instrumentField = wrapField('Instrument', true);
    const instrumentInput = create('input', 'dx-submit-input');
    instrumentInput.type = 'text';
    instrumentInput.maxLength = 120;
    instrumentInput.placeholder = 'Ex: Prepared Trombone';
    instrumentInput.value = state.meta.instrument;
    instrumentInput.addEventListener('input', (event) => {
      state.meta.instrument = event.target.value;
    });
    instrumentField.appendChild(instrumentInput);
    grid.appendChild(instrumentField);

    const bpmField = wrapField('BPM');
    const bpmInput = create('input', 'dx-submit-input');
    bpmInput.type = 'number';
    bpmInput.placeholder = '120';
    bpmInput.value = state.meta.bpm;
    bpmInput.addEventListener('input', (event) => {
      state.meta.bpm = event.target.value;
    });
    bpmField.appendChild(bpmInput);
    grid.appendChild(bpmField);

    const currentPitchSystem = normalizePitchSystem(state.meta.pitchSystem);
    state.meta.pitchSystem = currentPitchSystem;
    state.meta.pitchDescriptor = normalizePitchDescriptorForSystem(currentPitchSystem, state.meta.pitchDescriptor);
    syncLegacyPitchFields(state.meta);

    const pitchSystemField = wrapField('Pitch system');
    const pitchSystemSelect = create('select', 'dx-submit-input');
    PITCH_SYSTEM_OPTIONS.forEach((entry) => {
      const option = create('option', '', entry.label);
      option.value = entry.value;
      pitchSystemSelect.appendChild(option);
    });
    pitchSystemSelect.value = currentPitchSystem;
    pitchSystemSelect.addEventListener('change', (event) => {
      state.meta.pitchSystem = normalizePitchSystem(event.target.value);
      state.meta.pitchDescriptor = normalizePitchDescriptorForSystem(state.meta.pitchSystem, state.meta.pitchDescriptor);
      if (state.meta.pitchSystem === 'atonal' || state.meta.pitchSystem === 'non-pitched') {
        state.meta.pitchDescriptor = '';
      }
      syncLegacyPitchFields(state.meta);
      render();
    });
    pitchSystemField.appendChild(pitchSystemSelect);
    grid.appendChild(pitchSystemField);

    if (isPitchRootDropdownSystem(currentPitchSystem)) {
      const keyField = wrapField('Pitch root');
      const keySelect = create('select', 'dx-submit-input');
      const emptyOption = create('option', '', 'Select pitch root');
      emptyOption.value = '';
      keySelect.appendChild(emptyOption);
      getPitchRootOptions(currentPitchSystem).forEach((value) => {
        const option = create('option', '', value);
        option.value = value;
        keySelect.appendChild(option);
      });
      keySelect.value = text(state.meta.pitchDescriptor);
      keySelect.addEventListener('change', (event) => {
        state.meta.pitchDescriptor = event.target.value;
        syncLegacyPitchFields(state.meta);
      });
      keyField.appendChild(keySelect);
      grid.appendChild(keyField);
    } else if (currentPitchSystem === 'ji') {
      const descriptorField = wrapField('JI pitch descriptor');
      const hint = create('p', 'dx-submit-copy dx-submit-copy--compact', PITCH_DESCRIPTOR_HINTS.ji);
      const descriptorInput = create('input', 'dx-submit-input');
      descriptorInput.type = 'text';
      descriptorInput.maxLength = 120;
      descriptorInput.placeholder = 'Ex: 5/4 on C';
      descriptorInput.value = text(state.meta.pitchDescriptor);
      descriptorInput.addEventListener('input', (event) => {
        state.meta.pitchDescriptor = event.target.value;
        syncLegacyPitchFields(state.meta);
      });
      descriptorField.append(hint, descriptorInput);
      grid.appendChild(descriptorField);
    } else {
      const quickField = wrapField('Pitch detail');
      quickField.appendChild(create('p', 'dx-submit-copy dx-submit-copy--compact', 'No key-center descriptor required for this pitch type.'));
      grid.appendChild(quickField);
    }

    const scaleField = wrapField('Scale quality');
    const scaleInput = create('input', 'dx-submit-input');
    scaleInput.type = 'text';
    scaleInput.maxLength = 50;
    scaleInput.placeholder = 'major, minor, modal, maqam, raga...';
    scaleInput.value = state.meta.scaleQuality;
    scaleInput.addEventListener('input', (event) => {
      state.meta.scaleQuality = event.target.value;
    });
    scaleField.appendChild(scaleInput);
    grid.appendChild(scaleField);

    const collectionField = wrapField('Collection type', true);
    const collectionGroup = create('div', 'dx-submit-badge-group');
    COLLECTION_OPTIONS.forEach((entry) => {
      collectionGroup.appendChild(
        toBadge(
          `${entry.value} - ${entry.label}`,
          state.meta.collectionType === entry.value,
          () => {
            state.meta.collectionType = entry.value;
            render();
          },
        ),
      );
    });
    collectionField.appendChild(collectionGroup);
    grid.appendChild(collectionField);

    const outputField = wrapField('Quality / output types');
    const outputGroup = create('div', 'dx-submit-badge-group');
    OUTPUT_OPTIONS.forEach((entry) => {
      const selected = state.meta.outputTypes.includes(entry.value);
      outputGroup.appendChild(
        toBadge(entry.label, selected, () => {
          if (selected) {
            state.meta.outputTypes = state.meta.outputTypes.filter((value) => value !== entry.value);
          } else {
            state.meta.outputTypes = [...state.meta.outputTypes, entry.value];
          }
          render();
        }),
      );
    });
    outputField.appendChild(outputGroup);
    grid.appendChild(outputField);

    const tagsField = wrapField('Tags');
    const tagsHint = create('p', 'dx-submit-copy dx-submit-copy--compact', `Tip: ${TAG_HINT}`);
    const tagsInput = create('input', 'dx-submit-input');
    tagsInput.type = 'text';
    tagsInput.placeholder = 'comma separated';
    tagsInput.value = state.meta.tags;
    tagsInput.addEventListener('input', (event) => {
      state.meta.tags = event.target.value;
    });
    tagsField.append(tagsHint, tagsInput);
    grid.appendChild(tagsField);

    section.appendChild(grid);

    const actions = create('div', 'dx-submit-stage-actions');
    const back = create('button', 'cta-btn dx-button-element dx-button-size--sm dx-button-element--secondary', 'Back');
    back.type = 'button';
    back.addEventListener('click', () => {
      state.step = 0;
      render();
    });

    const next = create('button', 'cta-btn dx-button-element dx-button-size--md dx-button-element--primary', 'Continue to license');
    next.type = 'button';
    next.addEventListener('click', () => {
      if (!validateMeta()) return;
      state.step = 2;
      render();
    });

    actions.append(back, next);
    section.appendChild(actions);

    return section;
  }

  function buildLicenseStep() {
    const section = create('section', 'dx-submit-stage-card');
    section.setAttribute('data-dx-submit-step', 'license');

    section.appendChild(create('p', 'dx-submit-kicker', 'Step 3'));
    section.appendChild(create('h2', 'dx-submit-title', 'Choose rights model for publication and downstream usage'));

    const selected = LICENSE_OPTIONS.find((entry) => entry.id === state.licenseType) || LICENSE_OPTIONS[0];

    const optionGrid = create('div', 'dx-submit-license-options');
    LICENSE_OPTIONS.forEach((entry) => {
      const selectedOption = entry.id === state.licenseType;
      optionGrid.appendChild(
        toBadge(entry.label, selectedOption, () => {
          state.licenseType = entry.id;
          render();
        }),
      );
    });
    section.appendChild(optionGrid);

    const summary = create('p', 'dx-submit-copy', selected.summary);
    section.appendChild(summary);

    const licenseCard = create('article', 'dx-submit-license-card');
    const pre = create('pre', 'dx-submit-license-pre', selected.copy);
    licenseCard.appendChild(pre);
    section.appendChild(licenseCard);

    const agree = create('label', 'dx-submit-checkbox');
    const checkbox = create('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.addEventListener('change', () => {
      state.licenseConfirmed = checkbox.checked;
    });
    const agreeText = create('span', '', 'I reviewed and accept this license selection.');
    agree.append(checkbox, agreeText);
    section.appendChild(agree);

    state.licenseConfirmed = checkbox.checked;

    const actions = create('div', 'dx-submit-stage-actions');
    const back = create('button', 'cta-btn dx-button-element dx-button-size--sm dx-button-element--secondary', 'Back');
    back.type = 'button';
    back.addEventListener('click', () => {
      state.step = 1;
      render();
    });

    const next = create('button', 'cta-btn dx-button-element dx-button-size--md dx-button-element--primary', 'Continue to upload');
    next.type = 'button';
    next.addEventListener('click', () => {
      if (!state.licenseConfirmed) {
        showToast('Please confirm license acceptance.', true);
        return;
      }
      state.step = 3;
      render();
    });

    actions.append(back, next);
    section.appendChild(actions);

    return section;
  }

  function buildUploadStep() {
    const section = create('section', 'dx-submit-stage-card');
    section.setAttribute('data-dx-submit-step', 'upload');

    section.appendChild(create('p', 'dx-submit-kicker', 'Step 4'));
    section.appendChild(create('h2', 'dx-submit-title', 'Submit source link and optional post-production requests'));

    const linkField = wrapField('Public source link', true);
    const linkInput = create('input', 'dx-submit-input');
    linkInput.type = 'url';
    linkInput.placeholder = 'https://drive.google.com/...';
    linkInput.value = state.meta.link;
    linkInput.addEventListener('input', (event) => {
      state.meta.link = event.target.value;
    });
    linkField.appendChild(linkInput);
    section.appendChild(linkField);

    const serviceField = wrapField('Dex services');
    const services = create('div', 'dx-submit-badge-group');
    SERVICE_OPTIONS.forEach((entry) => {
      const selected = state.meta.services.includes(entry.value);
      services.appendChild(
        toBadge(entry.label, selected, () => {
          if (selected) {
            state.meta.services = state.meta.services.filter((value) => value !== entry.value);
          } else {
            state.meta.services = [...state.meta.services, entry.value];
          }
          render();
        }, entry.locked),
      );
    });
    serviceField.appendChild(services);
    section.appendChild(serviceField);

    const notesField = wrapField('Notes for Dex team');
    const notesInput = create('textarea', 'dx-submit-input dx-submit-notes');
    notesInput.rows = 5;
    notesInput.placeholder = 'Any delivery constraints, context, or edit notes';
    notesInput.value = state.meta.notes;
    notesInput.addEventListener('input', (event) => {
      state.meta.notes = event.target.value;
    });
    notesField.appendChild(notesInput);
    section.appendChild(notesField);

    const actions = create('div', 'dx-submit-stage-actions');
    const back = create('button', 'cta-btn dx-button-element dx-button-size--sm dx-button-element--secondary', 'Back');
    back.type = 'button';
    back.addEventListener('click', () => {
      state.step = 2;
      render();
    });

    const submit = create('button', 'cta-btn dx-button-element dx-button-size--md dx-button-element--primary', state.submitting ? 'Submitting…' : 'Submit sample');
    submit.type = 'button';
    submit.disabled = state.submitting;
    submit.addEventListener('click', () => {
      submitPayload();
    });

    actions.append(back, submit);
    section.appendChild(actions);

    return section;
  }

  function buildDoneStep() {
    const section = create('section', 'dx-submit-stage-card');
    section.setAttribute('data-dx-submit-step', 'done');

    section.appendChild(create('p', 'dx-submit-kicker', 'Submission sent'));
    section.appendChild(create('h2', 'dx-submit-title', 'Submission received. Timeline is now active.'));

    const lookup = text(state.lastSubmissionLookup, buildGeneratedSubmissionLookup(state.lastSubmissionRow));

    const badgeRow = create('div', 'dx-submit-pill-group');
    badgeRow.append(
      create('span', 'dx-submit-pill dx-submit-pill--accent', lookup),
      create('span', 'dx-submit-pill', 'Pending review'),
    );
    section.appendChild(badgeRow);

    section.appendChild(
      create(
        'p',
        'dx-submit-copy',
        'Open Messages to follow sent/received/reviewing/accepted states, timeline notes, and publish links when released.',
      ),
    );

    const actions = create('div', 'dx-submit-stage-actions');
    const inbox = create('a', 'cta-btn dx-button-element dx-button-size--md dx-button-element--primary', 'Open submission messages');
    inbox.href = '/entry/messages/';

    const restart = create('button', 'cta-btn dx-button-element dx-button-size--sm dx-button-element--secondary', 'Start another submission');
    restart.type = 'button';
    restart.addEventListener('click', () => {
      state.step = 0;
      state.meta = createInitialMeta();
      state.licenseType = 'joint';
      state.licenseConfirmed = true;
      state.lastSubmissionLookup = '';
      render();
    });

    actions.append(inbox, restart);
    section.appendChild(actions);

    return section;
  }

  function buildStepContent() {
    if (state.step === 0) return buildIntroStep();
    if (state.step === 1) return buildMetadataStep();
    if (state.step === 2) return buildLicenseStep();
    if (state.step === 3) return buildUploadStep();
    return buildDoneStep();
  }

  function buildChecklist() {
    const list = create('ul', 'dx-submit-checklist');
    const checks = [
      ['Title', text(state.meta.title).length > 0],
      ['Creator', text(state.meta.creator).length > 0],
      ['Category', text(state.meta.category).length > 0],
      ['Instrument', text(state.meta.instrument).length > 0],
      ['Collection type', text(state.meta.collectionType).length > 0],
    ];

    checks.forEach(([label, ok]) => {
      const item = create('li', 'dx-submit-check-item', label);
      item.classList.add(ok ? 'is-done' : 'is-pending');
      list.appendChild(item);
    });

    return list;
  }

  function buildCommandPanel() {
    const aside = create('aside', 'dx-submit-command dx-submit-surface');

    const cycle = create('section', 'dx-submit-command-card');
    cycle.append(
      create('p', 'dx-submit-kicker', 'Review SLA'),
      create('h3', 'dx-submit-command-title', 'Typical review within 7 days'),
      create('p', 'dx-submit-copy dx-submit-copy--compact', 'Status updates post to your inbox timeline with timestamps and notes.'),
    );

    const license = LICENSE_OPTIONS.find((entry) => entry.id === state.licenseType) || LICENSE_OPTIONS[0];
    const licenseCard = create('section', 'dx-submit-command-card');
    licenseCard.append(
      create('p', 'dx-submit-kicker', 'License summary'),
      create('h3', 'dx-submit-command-title', license.label),
      create('p', 'dx-submit-copy dx-submit-copy--compact', license.summary),
    );

    const pitchCard = create('section', 'dx-submit-command-card');
    pitchCard.append(
      create('p', 'dx-submit-kicker', 'Pitch profile'),
      create('h3', 'dx-submit-command-title', summarizePitch(state.meta)),
      create(
        'p',
        'dx-submit-copy dx-submit-copy--compact',
        'Use the pitch-root dropdown for 12-TET and 24-TET, or describe JI context. Atonal and non-pitched are first-class options.',
      ),
    );

    const checklist = create('section', 'dx-submit-command-card');
    checklist.append(
      create('p', 'dx-submit-kicker', 'Required fields'),
      buildChecklist(),
    );

    const quality = create('section', 'dx-submit-command-card');
    quality.append(
      create('p', 'dx-submit-kicker', 'Capture targets'),
      create('p', 'dx-submit-copy dx-submit-copy--compact', 'Video: 3840×2160, H.265, 24fps. Audio: 48kHz, 24-bit WAV. Lower-res accepted.'),
    );

    const guide = create('section', 'dx-submit-command-card');
    const stepKey = STEPS[state.step]?.key || 'intro';
    guide.append(
      create('p', 'dx-submit-kicker', 'Current step guidance'),
      create('h3', 'dx-submit-command-title', STEPS[state.step]?.title || 'Submission'),
      create('p', 'dx-submit-copy dx-submit-copy--compact', STEP_GUIDANCE[stepKey] || ''),
    );

    aside.append(cycle, licenseCard, pitchCard, checklist, quality, guide);
    return aside;
  }

  function buildLayout() {
    const shell = create('div', 'dx-submit-shell');
    shell.setAttribute('data-dx-submit-shell', 'true');
    shell.setAttribute('data-dx-submit-current-step', STEPS[state.step]?.key || 'intro');

    const main = create('section', 'dx-submit-main dx-submit-surface');
    const heading = create('header', 'dx-submit-heading');
    heading.append(
      create('p', 'dx-submit-kicker', 'Submit Samples'),
      create('h1', 'dx-submit-heading-title', 'Intake + Tracker'),
      create('p', 'dx-submit-copy dx-submit-copy--compact', 'Upload once. Follow status from sent to in-library in Messages.'),
    );

    const progress = buildProgressHeader();
    const stageWrap = create('div', 'dx-submit-stage');
    stageWrap.setAttribute('data-dx-submit-stage', STEPS[state.step]?.key || 'intro');
    stageWrap.appendChild(buildStepContent());

    main.append(heading, progress, stageWrap);

    shell.append(main, buildCommandPanel());
    return shell;
  }

  function applyMotion(root) {
    if (isReducedMotion()) return;

    const stageCard = root.querySelector('.dx-submit-stage-card');
    if (stageCard instanceof HTMLElement) {
      animate(stageCard, { opacity: [0, 1], y: [16, 0] }, { duration: 0.32, ease: 'easeOut' });
    }

    const commandCards = Array.from(root.querySelectorAll('.dx-submit-command-card'));
    commandCards.forEach((card, index) => {
      animate(card, { opacity: [0, 1], y: [10, 0] }, { duration: 0.24, delay: index * 0.03, ease: 'easeOut' });
    });

    const fill = root.querySelector('.dx-submit-progress-fill');
    if (fill instanceof HTMLElement) {
      const nextProgress = (state.step + 1) / STEPS.length;
      animate(
        fill,
        { transform: [`scaleX(${state.prevProgress})`, `scaleX(${nextProgress})`] },
        { duration: 0.28, ease: 'easeOut' },
      );
      state.prevProgress = nextProgress;
    }
  }

  function buildPayload() {
    syncLegacyPitchFields(state.meta);
    return {
      auth0Sub: text(state.auth0Sub),
      title: text(state.meta.title),
      creator: text(state.meta.creator),
      category: text(state.meta.category),
      instrument: text(state.meta.instrument),
      bpm: text(state.meta.bpm),
      pitchSystem: text(state.meta.pitchSystem),
      pitchDescriptor: text(state.meta.pitchDescriptor),
      keyCenter: text(state.meta.keyCenter),
      scaleQuality: text(state.meta.scaleQuality),
      tags: text(state.meta.tags),
      collectionType: text(state.meta.collectionType),
      outputTypes: (Array.isArray(state.meta.outputTypes) ? state.meta.outputTypes : []).join(','),
      services: (Array.isArray(state.meta.services) ? state.meta.services : []).join(','),
      license: text(state.licenseType, 'joint'),
      link: text(state.meta.link),
      notes: text(state.meta.notes),
      submissionYear: String(new Date().getFullYear()),
      performerToken: parsePerformerToken(state.meta.creator),
      status: 'pending',
    };
  }

  function submitPayload() {
    if (state.submitting) return;
    if (!text(state.meta.link)) {
      showToast('Missing link', true);
      return;
    }

    state.submitting = true;
    render();

    const payload = buildPayload();
    const callbackName = `dxSubmitCallback_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    const script = document.createElement('script');
    const ticket = Date.now();
    state.submitTicket = ticket;
    let settled = false;

    function cleanup() {
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
      if (script.isConnected) script.remove();
    }

    function onResolved(success, responsePayload = null) {
      if (settled) return;
      settled = true;
      cleanup();

      if (state.submitTicket !== ticket) return;
      state.submitting = false;

      if (success) {
        const rowNumber = responsePayload && typeof responsePayload === 'object'
          ? (responsePayload.row ?? responsePayload.sourceRow ?? '')
          : '';
        state.lastSubmissionRow = String(rowNumber || '').padStart(3, '0') || '000';
        state.lastSubmissionLookup = resolveLookupFromSubmitResponse(responsePayload, rowNumber || state.lastSubmissionRow);
        state.step = 4;
        render();
        showToast('Submitted');
      } else {
        render();
        showToast('Error submitting', true);
      }
    }

    window[callbackName] = (response) => {
      if (response && response.status === 'ok') {
        onResolved(true, response);
      } else {
        onResolved(false);
      }
    };

    script.async = true;
    script.src = `${state.webappUrl}?callback=${encodeURIComponent(callbackName)}&${new URLSearchParams(payload).toString()}`;
    script.addEventListener('error', () => onResolved(false));
    document.body.appendChild(script);

    window.setTimeout(() => {
      if (!settled) onResolved(false);
    }, SUBMIT_TIMEOUT_MS);
  }

  function render() {
    if (!(liveRoot instanceof HTMLElement) || !state) return;

    liveRoot.innerHTML = '';
    liveRoot.appendChild(buildLayout());
    const toastStack = create('div', 'dx-submit-toast-stack');
    toastStack.setAttribute('data-dx-submit-toasts', 'true');
    liveRoot.appendChild(toastStack);

    applyMotion(liveRoot);
  }

  async function resolveAuth0Sub(timeoutMs = AUTH_TIMEOUT_MS) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (text(window.auth0Sub)) return text(window.auth0Sub);

      if (window.auth0 && typeof window.auth0.getUser === 'function') {
        try {
          const candidate = window.auth0.getUser();
          const user = candidate && typeof candidate.then === 'function' ? await candidate : candidate;
          if (user && text(user.sub)) return text(user.sub);
        } catch {}
      }

      if (window.AUTH0_USER && text(window.AUTH0_USER.sub)) {
        return text(window.AUTH0_USER.sub);
      }

      await delay(100);
    }
    return '';
  }

  async function mount(options = {}) {
    const root = document.getElementById('dex-submit');
    if (!(root instanceof HTMLElement)) return false;

    const force = !!options.force;
    if (root.getAttribute('data-dx-submit-booting') === 'true') return false;
    if (!force && root.getAttribute('data-dx-submit-mounted') === 'true') return true;

    root.setAttribute('data-dx-submit-booting', 'true');
    const startTs = performance.now();

    try {
      liveRoot = root;
      setFetchState(root, FETCH_STATE_LOADING);
      const config = toConfig(root);
      state = makeState(config);
      state.auth0Sub = await resolveAuth0Sub(AUTH_TIMEOUT_MS);
      window.auth0Sub = state.auth0Sub || window.auth0Sub || '';
      render();
      await finalizeFetchState(root, startTs, FETCH_STATE_READY);
      root.setAttribute('data-dx-submit-mounted', 'true');
      return true;
    } catch (error) {
      root.innerHTML = '';
      const pane = create('section', 'dx-submit-main dx-submit-surface');
      pane.appendChild(create('h2', 'dx-submit-title', 'Submit page failed to load'));
      pane.appendChild(create('p', 'dx-submit-copy', text(error?.message, 'Unknown error')));
      root.appendChild(pane);
      await finalizeFetchState(root, startTs, FETCH_STATE_ERROR);
      return false;
    } finally {
      root.removeAttribute('data-dx-submit-booting');
    }
  }

  window.__dxSubmitSamplesMount = mount;

  document.addEventListener('dx:slotready', () => {
    mount({ force: true }).catch(() => {});
  });

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        mount().catch(() => {});
      },
      { once: true },
    );
  } else {
    mount().catch(() => {});
  }
})();
