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
    }
  });

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
      ...inventoryRows.slice(0, 5).map((row) => React.createElement(
        Text,
        { key: `inv-${row.entryId}`, color: row.state === 'linked' ? '#a6e3a1' : '#d0d5df' },
        `${row.entryId} · ${row.state} · catalog=${row.catalog?.source || '-'} · lookup=${row.lookups?.[0] || '-'} · buckets=${(row.assets?.buckets || []).join(',') || '-'} · files=${(row.assets?.fileIds || []).join(',') || '-'}`,
      )),
    ),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      React.createElement(Text, { color: busy ? '#ffcc66' : '#d0d5df' }, busy ? 'Working…' : statusLine),
      React.createElement(Text, { color: '#8f98a8' }, 'r rerun  Esc back'),
    ),
  );
}
