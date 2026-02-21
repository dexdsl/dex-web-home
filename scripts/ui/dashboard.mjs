import process from 'node:process';
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, render, useApp, useInput, useStdout } from 'ink';
import chalk from 'chalk';
import cliCursor from 'cli-cursor';
import { InitWizard } from './init-wizard.mjs';
import { UpdateWizard } from './update-wizard.mjs';
import { DoctorScreen } from './doctor-screen.mjs';
import { isBackspaceKey, shouldAppendWizardChar } from '../lib/input-guard.mjs';
import { computeWindow } from './rolodex.mjs';

const MENU_ITEMS = [{ id: 'init', label: 'Init', description: 'Create a new entry via wizard' }, { id: 'update', label: 'Update', description: 'Rehydrate and edit an existing entry' }, { id: 'doctor', label: 'Doctor', description: 'Health and drift checks with safe repair' }];
const PALETTE_ITEMS = ['init', 'update', 'doctor'];
const LOGO = [
  '██████╗ ███████╗██╗  ██╗',
  '██╔══██╗██╔════╝╚██╗██╔╝',
  '██║  ██║█████╗   ╚███╔╝ ',
  '██║  ██║██╔══╝   ██╔██╗ ',
  '██████╔╝███████╗██╔╝ ██╗',
  '╚═════╝ ╚══════╝╚═╝  ╚═╝',
];

function hsvToRgb(h, s, v) {
  const c = v * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0; let g = 0; let b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

function renderLogoLine(line, y, tick) {
  let out = '';
  for (let x = 0; x < line.length; x += 1) {
    const ch = line[x];
    if (ch === ' ') { out += ' '; continue; }
    const intensity = 0.55 + 0.45 * Math.sin(tick * 0.18 + x * 0.27 + y * 0.51);
    const hue = (210 + x * 5 + tick * 2.4 + y * 8) % 360;
    const { r, g, b } = hsvToRgb(hue, 0.7, Math.min(1, Math.max(0, 0.3 + intensity * 0.7)));
    out += chalk.rgb(r, g, b)(ch);
  }
  return out;
}

function badge(text, fg = '#d0d5df', bg = '#313745') {
  return chalk.hex(bg).bold(` ${chalk.hex(fg)(text)} `);
}

function DashboardApp({ initialPaletteOpen, initialMode = 'menu', version, noAnim }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({ cols: stdout?.columns || 80, rows: stdout?.rows || 24 });
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(initialPaletteOpen);
  const [query, setQuery] = useState('');
  const [paletteSelected, setPaletteSelected] = useState(0);
  const [mode, setMode] = useState(initialPaletteOpen ? 'palette' : initialMode);
  const [lastResult, setLastResult] = useState('');

  const cols = dimensions.cols;
  const rows = dimensions.rows;

  useEffect(() => {
    const onResize = () => setDimensions({ cols: stdout?.columns || 80, rows: stdout?.rows || 24 });
    stdout?.on('resize', onResize);
    return () => stdout?.off('resize', onResize);
  }, [stdout]);

  useEffect(() => {
    if (noAnim) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, [noAnim]);

  const logoLines = useMemo(() => LOGO.map((line, y) => renderLogoLine(line, y, noAnim ? 0 : tick)), [noAnim, tick]);
  const filteredPalette = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? PALETTE_ITEMS.filter((item) => item.includes(q)) : PALETTE_ITEMS;
  }, [query]);

  useEffect(() => {
    if (paletteSelected >= filteredPalette.length) setPaletteSelected(Math.max(0, filteredPalette.length - 1));
  }, [filteredPalette, paletteSelected]);

  useInput((input, key) => {
    if (key.ctrl && (input === 'q' || input === 'Q')) { exit(); return; }
    if (mode === 'init' || mode === 'update' || mode === 'doctor') return;

    if (input === '?') {
      setPaletteOpen((open) => !open);
      setMode((m) => (m === 'palette' ? 'menu' : 'palette'));
      return;
    }

    if (paletteOpen) {
      if (key.escape) { setPaletteOpen(false); setMode('menu'); return; }
      if (key.return) {
        const item = filteredPalette[paletteSelected];
        if (item === 'init' || item === 'update' || item === 'doctor') { setPaletteOpen(false); setMode(item); }
        return;
      }
      if (key.upArrow) { setPaletteSelected((idx) => (filteredPalette.length ? (idx - 1 + filteredPalette.length) % filteredPalette.length : 0)); return; }
      if (key.downArrow) { setPaletteSelected((idx) => (filteredPalette.length ? (idx + 1) % filteredPalette.length : 0)); return; }
      if (isBackspaceKey(input, key) || key.delete) { setQuery((q) => q.slice(0, -1)); return; }
      if (shouldAppendWizardChar(input, key)) setQuery((q) => q + input);
      return;
    }

    if (key.upArrow) { setSelected((idx) => (idx - 1 + MENU_ITEMS.length) % MENU_ITEMS.length); return; }
    if (key.downArrow) { setSelected((idx) => (idx + 1) % MENU_ITEMS.length); return; }
    if (key.return && MENU_ITEMS[selected]) setMode(MENU_ITEMS[selected].id);
  });

  const paletteWidth = Math.min(72, Math.max(24, cols - 4));
  const paletteHeight = Math.min(14, Math.max(8, rows - 4));
  const paletteLeft = Math.max(0, Math.floor((cols - paletteWidth) / 2));
  const paletteTop = Math.max(0, Math.floor((rows - paletteHeight) / 2));

  const headerHeight = 13;
  const footerHeight = 3;
  const workspaceHeight = Math.max(6, rows - headerHeight - footerHeight);
  const paletteListHeight = Math.max(3, paletteHeight - 4);
  const paletteWindow = computeWindow({ total: filteredPalette.length, cursor: paletteSelected, height: paletteListHeight });
  const menuWindow = computeWindow({ total: MENU_ITEMS.length, cursor: selected, height: Math.max(3, workspaceHeight - 3) });

  const headerTop = `entry creation tool   ${badge(version || 'dev')}`;

  return React.createElement(Box, { flexDirection: 'column', width: cols, height: rows },
    React.createElement(Box, { height: headerHeight, flexDirection: 'column', justifyContent: 'center', borderStyle: 'single', borderColor: '#343b4a', paddingX: 2 },
      React.createElement(Box, { width: '100%', justifyContent: 'center' },
        React.createElement(Box, { flexDirection: 'column', alignItems: 'center' },
          ...logoLines.map((line, i) => React.createElement(Text, { key: `logo-${i}` }, line)),
          React.createElement(Text, {}, chalk.hex('#8f98a8')(headerTop)),
          React.createElement(Text, {}, chalk.hex('#ffcc66')('DEX CO-OP CORP, FOR INTERNAL USE ONLY')),
          React.createElement(Text, {}, chalk.hex('#8f98a8')('Last updated: 2026-02-20')),
        )),
    ),
    React.createElement(Box, { height: workspaceHeight, flexDirection: 'column', borderStyle: 'single', borderColor: '#343b4a', paddingX: 2 },
      mode === 'init'
        ? React.createElement(InitWizard, {
          outDirDefault: './entries',
          onCancel: () => setMode('menu'),
          onDone: (report) => {
            setLastResult(`Last: ✓ Wrote entries/${report.slug}/index.html`);
            setMode('menu');
          },
        })
        : mode === 'update'
          ? React.createElement(UpdateWizard, {
            onCancel: () => setMode('menu'),
            onDone: (report) => {
              setLastResult(`Last: ✓ Updated entries/${report.slug}/index.html`);
              setMode('menu');
            },
          })
          : mode === 'doctor'
            ? React.createElement(DoctorScreen, {})
        : React.createElement(Box, { flexDirection: 'column' },
          React.createElement(Text, { color: '#8f98a8', dimColor: true }, 'Commands'),
          menuWindow.start > 0 ? React.createElement(Text, { key: 'menu-up', color: '#8f98a8' }, '…') : null,
          ...MENU_ITEMS.slice(menuWindow.start, menuWindow.end).map((item, localIdx) => {
            const idx = menuWindow.start + localIdx;
            return React.createElement(Box, { key: item.id, height: 1 },
            React.createElement(Text, idx === selected ? { inverse: true } : { color: '#d0d5df' }, `${item.label} — ${item.description}`),
            );
          }),
          menuWindow.end < MENU_ITEMS.length ? React.createElement(Text, { key: 'menu-down', color: '#8f98a8' }, '…') : null,
          lastResult ? React.createElement(Text, { color: '#a6e3a1' }, lastResult) : null,
        ),
    ),
    React.createElement(Box, { height: footerHeight, borderStyle: 'single', borderColor: '#343b4a', paddingX: 2, justifyContent: 'center' },
      React.createElement(Text, { color: '#6e7688' }, 'Enter run   ↑/↓ move   ? palette   Ctrl+Q quit'),
    ),
    paletteOpen && React.createElement(Box, {
      position: 'absolute', left: paletteLeft, top: paletteTop, width: paletteWidth, height: paletteHeight,
      borderStyle: 'round', borderColor: '#4a5367', flexDirection: 'column', paddingX: 1,
    },
    React.createElement(Text, { bold: true }, 'Command palette'),
    React.createElement(Text, { color: '#8f98a8' }, `> ${query}`),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      paletteWindow.start > 0 ? React.createElement(Text, { key: 'palette-up', color: '#8f98a8' }, '…') : null,
      ...(filteredPalette.length
        ? filteredPalette.slice(paletteWindow.start, paletteWindow.end).map((item, localIdx) => {
          const idx = paletteWindow.start + localIdx;
          return React.createElement(Text, idx === paletteSelected ? { key: item, inverse: true } : { key: item, color: '#d0d5df' }, item);
        })
        : [React.createElement(Text, { key: 'none', color: '#8f98a8' }, 'No commands')]),
      paletteWindow.end < filteredPalette.length ? React.createElement(Text, { key: 'palette-down', color: '#8f98a8' }, '…') : null,
    )),
  );
}

export async function runDashboard({ paletteOpen = false, initialMode = 'menu', version = 'dev' } = {}) {
  if (!process.stdout.isTTY || !process.stdin.isTTY) return { action: null };

  cliCursor.hide();
  try {
    const instance = render(React.createElement(DashboardApp, {
      initialPaletteOpen: paletteOpen,
      initialMode,
      version,
      noAnim: process.env.DEX_NO_ANIM === '1',
    }), { exitOnCtrlC: true });
    await instance.waitUntilExit();
    return { action: null };
  } finally {
    cliCursor.show();
  }
}
