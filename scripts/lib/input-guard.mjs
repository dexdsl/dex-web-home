export function shouldAppendWizardChar(input, key = {}) {
  if (key.ctrl || key.meta) return false;
  if (typeof input !== 'string' || input.length !== 1) return false;
  if (input.includes('\x1b')) return false;
  return !/\p{C}/u.test(input);
}

export function isBackspaceKey(input, key = {}) {
  return !!(key.backspace || input === '\x7f' || input === '\b' || input === '\x08');
}

function stripAnsiSequences(value) {
  const source = String(value || '');
  return source
    .replace(/\x1b\]([^\x07]|\x07(?!\x1b\\))*\x07/g, '')
    .replace(/\x1b\][^\x1b]*\x1b\\/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[@-_]/g, '');
}

function removeBracketedPasteMarkers(value) {
  return String(value || '')
    .replace(/\x1b\[200~/g, '')
    .replace(/\x1b\[201~/g, '');
}

export function sanitizePastedInputChunk(input, { allowMultiline = false } = {}) {
  if (typeof input !== 'string' || !input) return '';

  let text = removeBracketedPasteMarkers(input);
  text = stripAnsiSequences(text);
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  let out = '';
  for (const ch of text) {
    if (ch === '\n') {
      out += allowMultiline ? '\n' : ' ';
      continue;
    }
    if (ch === '\t') {
      out += allowMultiline ? '\t' : ' ';
      continue;
    }
    if (/\p{C}/u.test(ch)) continue;
    out += ch;
  }

  return allowMultiline
    ? out
    : out.replace(/[ \t]+/g, ' ');
}
