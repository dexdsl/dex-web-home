import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { auditEntryRuntime } from '../lib/entry-runtime-audit.mjs';

function safeMessage(error) {
  return error?.message || String(error || 'Unknown error');
}

export function EntryAuditManager({ onExit, width = 100, height = 24 }) {
  const [busy, setBusy] = useState(true);
  const [statusLine, setStatusLine] = useState('Running entry runtime audit…');
  const [reports, setReports] = useState([]);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showTreeDetails, setShowTreeDetails] = useState(false);
  const [inventoryCounts, setInventoryCounts] = useState({
    total: 0,
    linked: 0,
    entryOnly: 0,
    catalogOnly: 0,
    withAssets: 0,
  });

  const runAudit = async () => {
    setBusy(true);
    try {
      const result = await auditEntryRuntime({
        entriesDir: './entries',
        all: true,
        includeLegacy: false,
      });
      setReports(result.reports);
      const rows = Array.isArray(result?.inventory?.rows) ? result.inventory.rows : [];
      setInventoryRows(rows);
      setSelectedIndex((current) => Math.max(0, Math.min(current, Math.max(0, rows.length - 1))));
      setInventoryCounts(result?.inventory?.counts || {
        total: rows.length,
        linked: 0,
        entryOnly: 0,
        catalogOnly: 0,
        withAssets: 0,
      });
      if (result.failures > 0) {
        setStatusLine(`Audit failed for ${result.failures}/${result.reports.length} entries. Inventory rows=${rows.length}.`);
      } else {
        setStatusLine(`Audit passed (${result.reports.length} entries, skipped=${result.skipped}, inventory=${rows.length}).`);
      }
    } catch (error) {
      setStatusLine(`Audit failed: ${safeMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void runAudit();
  }, []);

  useInput((input, key) => {
    if (key.escape) {
      if (typeof onExit === 'function') onExit();
      return;
    }
    if (busy) return;
    const lower = String(input || '').toLowerCase();
    if (lower === 'r') {
      void runAudit();
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((current) => Math.min(Math.max(0, inventoryRows.length - 1), current + 1));
      return;
    }
    if (lower === 't') {
      setShowTreeDetails((prev) => !prev);
    }
  }, { isActive: true });

  const selectedRow = inventoryRows[Math.max(0, Math.min(selectedIndex, Math.max(0, inventoryRows.length - 1)))] || null;
  const inventoryLimit = Math.max(5, Math.min(10, height - 14));
  const listStart = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(inventoryLimit / 2),
      Math.max(0, inventoryRows.length - inventoryLimit),
    ),
  );
  const listEnd = Math.min(inventoryRows.length, listStart + inventoryLimit);

  return React.createElement(Box, { flexDirection: 'column', width, height, minHeight: height },
    React.createElement(Text, { bold: true, color: '#d0d5df' }, 'Entry Runtime Audit'),
    React.createElement(Text, { color: '#8f98a8' }, 'Checks entry runtime contracts, auth trio, and lookup-only download payloads.'),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      ...reports.slice(0, Math.max(6, height - 8)).map((report) => {
        if (report.skippedLegacy) {
          return React.createElement(Text, { key: `skip-${report.slug}`, color: '#8f98a8' }, `SKIP ${report.slug} (legacy exemption)`);
        }
        if (report.ok) {
          return React.createElement(Text, { key: `ok-${report.slug}`, color: '#a6e3a1' }, `PASS ${report.slug}`);
        }
        return React.createElement(Text, { key: `fail-${report.slug}`, color: '#ff6b6b' }, `FAIL ${report.slug}: ${report.issues.join(' | ')}`);
      }),
      !reports.length && !busy ? React.createElement(Text, { color: '#8f98a8' }, 'No entries audited.') : null,
    ),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      React.createElement(Text, { color: '#8f98a8' }, `Inventory linked=${inventoryCounts.linked} entryOnly=${inventoryCounts.entryOnly} catalogOnly=${inventoryCounts.catalogOnly} withAssets=${inventoryCounts.withAssets}`),
      listStart > 0 ? React.createElement(Text, { color: '#8f98a8', key: 'inv-up' }, '…') : null,
      ...inventoryRows.slice(listStart, listEnd).map((row, localIndex) => React.createElement(
        Text,
        {
          key: `inv-${row.entryId}`,
          color: row.state === 'linked' ? '#a6e3a1' : '#d0d5df',
          inverse: (listStart + localIndex) === selectedIndex,
        },
        `${row.entryId} · ${row.state} · lookup=${row.lookups?.[0] || '-'} · files=${(row.assets?.fileIds || []).length || 0} · health=${row.downloadTree?.criticalCount ?? '-'}c/${row.downloadTree?.warnCount ?? '-'}w`,
      )),
      listEnd < inventoryRows.length ? React.createElement(Text, { color: '#8f98a8', key: 'inv-down' }, '…') : null,
      showTreeDetails && selectedRow ? React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
        React.createElement(Text, { color: '#8f98a8' }, `Tree ${selectedRow.entryId} · root=${selectedRow.downloadTree?.rootFolderUrl ? 'ok' : 'missing'} · bundle=${selectedRow.downloadTree?.bundleCoverage || '-'} · pdf=${selectedRow.downloadTree?.pdfCoverage || '-'}`),
        React.createElement(Text, { color: '#8f98a8' }, `Buckets: ${(selectedRow.downloadTree?.activeBuckets || []).join(',') || '-'} · Files: ${selectedRow.downloadTree?.fileCount || 0}`),
        ...(Array.isArray(selectedRow.downloadTree?.criticalIssues) ? selectedRow.downloadTree.criticalIssues.slice(0, 3).map((issue) => React.createElement(Text, { key: `tree-critical-${selectedRow.entryId}-${issue}`, color: '#ff6b6b' }, `critical: ${issue}`)) : []),
        ...(Array.isArray(selectedRow.downloadTree?.warnIssues) ? selectedRow.downloadTree.warnIssues.slice(0, 2).map((issue) => React.createElement(Text, { key: `tree-warn-${selectedRow.entryId}-${issue}`, color: '#ffcc66' }, `warn: ${issue}`)) : []),
      ) : null,
    ),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      React.createElement(Text, { color: busy ? '#ffcc66' : '#d0d5df' }, busy ? 'Working…' : statusLine),
      React.createElement(Text, { color: '#8f98a8' }, '↑/↓ select  t tree details  r rerun  Esc back'),
    ),
  );
}
