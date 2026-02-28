function toText(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

function inferFamily(file = {}) {
  const type = toText(file.type).toLowerCase();
  const mime = toText(file.mime).toLowerCase();
  const r2Key = toText(file.r2Key || file.rawUrl).toLowerCase();
  const label = `${toText(file.label).toLowerCase()} ${toText(file.fileId).toLowerCase()}`;
  if (type === 'audio' || mime.startsWith('audio/') || /\.(wav|aif|aiff|mp3|flac|m4a)(\?|$)/.test(r2Key) || /\b(wav|aif|aiff|mp3|flac|m4a|audio|ste|stereo)\b/.test(label)) return 'audio';
  if (type === 'video' || mime.startsWith('video/') || /\.(mov|mp4|mxf|mkv)(\?|$)/.test(r2Key) || /(4k|1080|720|prores|h264|h265|video)/.test(label)) return 'video';
  if (mime.includes('pdf') || /\.pdf(\?|$)/.test(r2Key) || /\b(pdf|recording index)\b/.test(label)) return 'pdf';
  return 'unknown';
}

function inferSubtype(file = {}) {
  const mime = toText(file.mime).toLowerCase();
  const type = toText(file.type).toLowerCase();
  const r2Key = toText(file.r2Key || file.rawUrl).toLowerCase();
  const label = `${toText(file.label).toLowerCase()} ${toText(file.fileId).toLowerCase()}`;
  const extensionMatch = r2Key.match(/\.([a-z0-9]{2,6})(?:\?|$)/);
  const extension = extensionMatch ? extensionMatch[1] : '';
  if (/(^|\W)4k(\W|$)|2160/.test(label) || /2160|4k/.test(r2Key)) return '4k';
  if (/1080/.test(label) || /1080/.test(r2Key)) return '1080p';
  if (/720/.test(label) || /720/.test(r2Key)) return '720p';
  if (extension) return extension;
  if (mime.includes('pdf')) return 'pdf';
  if (type) return type;
  if (mime.startsWith('audio/')) return mime.slice('audio/'.length);
  if (mime.startsWith('video/')) return mime.slice('video/'.length);
  return 'unknown';
}

function groupByBucket(files = []) {
  const map = new Map();
  for (const file of files) {
    const bucket = toText(file.bucket || file.bucketCode || '').toUpperCase()
      || String(toText(file.bucketNumber).split('.')[0] || '').toUpperCase();
    if (!bucket) continue;
    if (!map.has(bucket)) {
      map.set(bucket, {
        bucket,
        fileCount: 0,
        audioCount: 0,
        videoCount: 0,
        pdfCount: 0,
        unknownCount: 0,
        folderLinkOk: true,
      });
    }
    const row = map.get(bucket);
    row.fileCount += 1;
    const family = inferFamily(file);
    if (family === 'audio') row.audioCount += 1;
    else if (family === 'video') row.videoCount += 1;
    else if (family === 'pdf') row.pdfCount += 1;
    else row.unknownCount += 1;
  }
  return Array.from(map.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
}

function buildTypeRows(files = []) {
  const familyCounts = new Map();
  const subtypeCounts = new Map();
  for (const file of files) {
    const family = inferFamily(file);
    familyCounts.set(family, normalizeCount(familyCounts.get(family)) + 1);
    const subtype = inferSubtype(file);
    subtypeCounts.set(subtype, normalizeCount(subtypeCounts.get(subtype)) + 1);
  }
  const families = ['audio', 'video', 'pdf', 'unknown'].map((family) => ({
    key: family,
    label: family,
    count: normalizeCount(familyCounts.get(family)),
  })).filter((row) => row.count > 0 || row.key === 'unknown');

  const subtypes = Array.from(subtypeCounts.entries())
    .map(([key, count]) => ({ key, label: key, count: normalizeCount(count) }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 8);

  return { families, subtypes };
}

function buildBundleRowsFromHealth(health = {}) {
  const rows = Array.isArray(health.bundles) ? health.bundles : [];
  const byBucket = new Map();
  for (const row of rows) {
    if (!row?.hasSegments) continue;
    const bucket = toText(row.bucket).toUpperCase();
    if (!bucket) continue;
    if (!byBucket.has(bucket)) {
      byBucket.set(bucket, {
        bucket,
        audio: { present: false, ok: true },
        video: { present: false, ok: true },
        pdf: { present: false, ok: true },
      });
    }
    const target = byBucket.get(bucket);
    const type = toText(row.type).toLowerCase();
    if (!target[type]) continue;
    target[type] = { present: true, ok: Boolean(row.ok) };
  }
  return Array.from(byBucket.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
}

function mergeFolderStatus(bucketRows = [], linkRows = []) {
  const linkMap = new Map((Array.isArray(linkRows) ? linkRows : []).map((row) => [toText(row.bucket).toUpperCase(), Boolean(row.ok)]));
  return bucketRows.map((row) => ({
    ...row,
    folderLinkOk: linkMap.has(row.bucket) ? linkMap.get(row.bucket) : row.folderLinkOk,
  }));
}

function buildBundleRowsFromInventory(tree = {}, files = []) {
  if (Array.isArray(tree.bundleRows) && tree.bundleRows.length) return tree.bundleRows;
  const bucketRows = groupByBucket(files);
  return bucketRows.map((row) => ({
    bucket: row.bucket,
    audio: { present: row.audioCount > 0, ok: row.audioCount > 0 },
    video: { present: row.videoCount > 0, ok: row.videoCount > 0 },
    pdf: { present: row.pdfCount > 0, ok: row.pdfCount > 0 },
  }));
}

export function buildDownloadTreePlotModelFromHealth(health = {}, { title = 'Download tree' } = {}) {
  const files = Array.isArray(health.files) ? health.files : [];
  const bucketRows = mergeFolderStatus(
    Array.isArray(health.buckets) ? health.buckets : [],
    Array.isArray(health.bucketFolderLinks) ? health.bucketFolderLinks : [],
  );
  const typeRows = buildTypeRows(files);
  return {
    title,
    summary: {
      criticalCount: normalizeCount(health?.summary?.criticalCount),
      warnCount: normalizeCount(health?.summary?.warnCount),
      totalFiles: normalizeCount(health?.summary?.totalFiles || files.length),
      enabledFiles: normalizeCount(health?.summary?.enabledFiles || files.length),
      bucketCount: normalizeCount(health?.summary?.bucketCount || bucketRows.length),
    },
    root: {
      ok: Boolean(health?.root?.ok),
      label: 'A1 root folder',
    },
    buckets: bucketRows,
    associatedTypes: typeRows,
    bundleRows: buildBundleRowsFromHealth(health),
    recording: {
      pdf: {
        ok: Boolean(health?.recordingIndex?.pdf?.ok),
        label: toText(health?.recordingIndex?.pdf?.raw),
      },
      bundle: {
        ok: Boolean(health?.recordingIndex?.bundle?.ok),
        label: toText(health?.recordingIndex?.bundle?.raw),
      },
    },
    criticalIssues: Array.isArray(health?.criticalIssues) ? health.criticalIssues : [],
    warnIssues: Array.isArray(health?.warnIssues) ? health.warnIssues : [],
  };
}

export function buildDownloadTreePlotModelFromInventory(row = {}, { title = 'Download tree' } = {}) {
  const tree = row?.downloadTree || {};
  const files = Array.isArray(tree.files)
    ? tree.files
    : (Array.isArray(row?.assets?.lookupFiles?.[tree.lookupNumber])
      ? row.assets.lookupFiles[tree.lookupNumber]
      : (Array.isArray(row?.assets?.files) ? row.assets.files : []));

  const bucketRows = mergeFolderStatus(
    groupByBucket(files),
    Array.isArray(tree.bucketFolderLinks) ? tree.bucketFolderLinks : [],
  );
  const types = buildTypeRows(files);

  const recordingPdfOk = toText(tree.pdfCoverage).toLowerCase() === 'ok';
  const recordingBundleOk = toText(tree.bundleCoverage).toLowerCase() === 'ok';

  return {
    title,
    summary: {
      criticalCount: normalizeCount(tree.criticalCount),
      warnCount: normalizeCount(tree.warnCount),
      totalFiles: normalizeCount(tree.fileCount || files.length),
      enabledFiles: normalizeCount(tree.fileCount || files.length),
      bucketCount: normalizeCount(bucketRows.length),
    },
    root: {
      ok: Boolean(tree.rootFolderUrl),
      label: 'A1 root folder',
    },
    buckets: bucketRows,
    associatedTypes: types,
    bundleRows: buildBundleRowsFromInventory(tree, files),
    recording: {
      pdf: {
        ok: recordingPdfOk,
        label: toText(row?.recordingIndex?.pdfTokenRaw || tree.pdfCoverage),
      },
      bundle: {
        ok: recordingBundleOk,
        label: toText(row?.recordingIndex?.bundleTokenRaw || tree.bundleCoverage),
      },
    },
    criticalIssues: Array.isArray(tree.criticalIssues) ? tree.criticalIssues : [],
    warnIssues: Array.isArray(tree.warnIssues) ? tree.warnIssues : [],
  };
}
