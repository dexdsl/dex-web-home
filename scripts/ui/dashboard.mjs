import process from 'node:process';
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, render, useApp, useInput, useStdout } from 'ink';
import chalk from 'chalk';
import cliCursor from 'cli-cursor';

const MENU_ITEMS = ['Init'];
const PALETTE_ITEMS = ['init'];
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
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function renderLogoLine(line, y, tick) {
  let out = '';
  for (let x = 0; x < line.length; x += 1) {
    const ch = line[x];
    if (ch === ' ') {
      out += ' ';
      continue;
    }
    const intensity = 0.55 + 0.45 * Math.sin(tick * 0.18 + x * 0.27 + y * 0.51);
    const hue = (210 + x * 5 + tick * 2.4 + y * 8) % 360;
    const sat = 0.7;
    const val = Math.min(1, Math.max(0, 0.3 + intensity * 0.7));
    const { r, g, b } = hsvToRgb(hue, sat, val);
    out += chalk.rgb(r, g, b)(ch);
  }
  return out;
}

function DashboardApp({ initialPaletteOpen, version, onResolve, noAnim }) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    cols: stdout?.columns || 80,
    rows: stdout?.rows || 24,
  });
  const cols = dimensions.cols;
  const rows = dimensions.rows;

  useEffect(() => {
    const onResize = () => {
      setDimensions({ cols: stdout?.columns || 80, rows: stdout?.rows || 24 });
    };
    stdout?.on('resize', onResize);
    return () => stdout?.off('resize', onResize);
  }, [stdout]);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(initialPaletteOpen);
  const [query, setQuery] = useState('');
  const [paletteSelected, setPaletteSelected] = useState(0);

  useEffect(() => {
    if (noAnim) return undefined;
    const id = setInterval(() => {
      setTick((t) => t + 1);
    }, 50);
    return () => clearInterval(id);
  }, [noAnim]);

  const logoLines = useMemo(() => {
    const t = noAnim ? 0 : tick;
    return LOGO.map((line, y) => renderLogoLine(line, y, t));
  }, [noAnim, tick]);

  const filteredPalette = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PALETTE_ITEMS;
    return PALETTE_ITEMS.filter((item) => item.includes(q));
  }, [query]);

  useEffect(() => {
    if (paletteSelected >= filteredPalette.length) {
      setPaletteSelected(Math.max(0, filteredPalette.length - 1));
    }
  }, [filteredPalette, paletteSelected]);

  const finish = (action) => {
    onResolve(action);
    exit();
  };

  useInput((input, key) => {
    if (input === 'q') {
      finish(null);
      return;
    }

    if (input === '?') {
      setPaletteOpen((open) => !open);
      return;
    }

    if (paletteOpen) {
      if (key.escape) {
        setPaletteOpen(false);
        return;
      }
      if (key.return) {
        if (filteredPalette.length > 0) finish(filteredPalette[paletteSelected]);
        return;
      }
      if (key.upArrow) {
        setPaletteSelected((idx) => (filteredPalette.length ? (idx - 1 + filteredPalette.length) % filteredPalette.length : 0));
        return;
      }
      if (key.downArrow) {
        setPaletteSelected((idx) => (filteredPalette.length ? (idx + 1) % filteredPalette.length : 0));
        return;
      }
      if (key.backspace || key.delete) {
        setQuery((q) => q.slice(0, -1));
        return;
      }
      if (!key.ctrl && !key.meta && input && input >= ' ' && input <= '~') {
        setQuery((q) => q + input);
      }
      return;
    }

    if (key.upArrow || key.downArrow) {
      setSelected(0);
      return;
    }

    if (key.return) {
      if (MENU_ITEMS[selected] === 'Init') finish('init');
    }
  });

  const divider = chalk.hex('#2f3543')('─'.repeat(Math.max(12, Math.min(cols - 4, 96))));
  const paletteWidth = Math.min(72, Math.max(24, cols - 4));
  const paletteHeight = Math.min(14, Math.max(8, rows - 4));
  const paletteLeft = Math.max(0, Math.floor((cols - paletteWidth) / 2));
  const paletteTop = Math.max(0, Math.floor((rows - paletteHeight) / 2));

  return React.createElement(
    Box,
    { flexDirection: 'column', width: cols, height: rows },
    React.createElement(
      Box,
      { flexDirection: 'column', paddingX: 2, paddingTop: 1 },
      ...logoLines.map((line, i) => React.createElement(Text, { key: `logo-${i}` }, line)),
      React.createElement(Text, { color: '#6e7688' }, `v${version}`),
      React.createElement(Text, {}, divider),
    ),
    React.createElement(Box, { flexGrow: 1 }),
    React.createElement(
      Box,
      { flexDirection: 'column', alignItems: 'center' },
      MENU_ITEMS.map((item, idx) => React.createElement(
        Box,
        { key: item, marginBottom: 1 },
        React.createElement(Text, idx === selected ? { inverse: true } : { color: '#d0d5df' }, item),
      )),
    ),
    React.createElement(Box, { flexGrow: 1 }),
    React.createElement(
      Box,
      { paddingX: 2, paddingBottom: 1 },
      React.createElement(Text, { color: '#6e7688' }, 'Enter run   ↑/↓ move   ? help/palette   q quit'),
    ),
    paletteOpen && React.createElement(
      Box,
      {
        position: 'absolute',
        left: paletteLeft,
        top: paletteTop,
        width: paletteWidth,
        height: paletteHeight,
        borderStyle: 'round',
        borderColor: '#4a5367',
        flexDirection: 'column',
        paddingX: 1,
      },
      React.createElement(Text, { bold: true }, 'Command palette'),
      React.createElement(Text, { color: '#8f98a8' }, `> ${query}`),
      React.createElement(
        Box,
        { marginTop: 1, flexDirection: 'column' },
        ...(filteredPalette.length
          ? filteredPalette.map((item, idx) => React.createElement(Text, idx === paletteSelected ? { key: item, inverse: true } : { key: item, color: '#d0d5df' }, item))
          : [React.createElement(Text, { key: 'none', color: '#8f98a8' }, 'No commands')]),
      ),
    ),
  );
}

export async function runDashboard({ paletteOpen = false, version = '0.0.0' } = {}) {
  if (!process.stdout.isTTY || !process.stdin.isTTY) return { action: null };

  let resolvedAction = null;
  cliCursor.hide();
  try {
    const instance = render(React.createElement(DashboardApp, {
      initialPaletteOpen: paletteOpen,
      version,
      onResolve: (action) => {
        resolvedAction = action;
      },
      noAnim: process.env.DEX_NO_ANIM === '1',
    }), {
      exitOnCtrlC: true,
    });
    await instance.waitUntilExit();
    return { action: resolvedAction };
  } finally {
    cliCursor.show();
  }
}
