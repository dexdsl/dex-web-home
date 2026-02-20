export function shouldAppendWizardChar(input, key = {}) {
  if (key.ctrl || key.meta) return false;
  if (typeof input !== 'string' || input.length !== 1) return false;
  if (input.includes('\x1b')) return false;
  return !/\p{C}/u.test(input);
}

export function isBackspaceKey(input, key = {}) {
  return !!(key.backspace || input === '\x7f' || input === '\b' || input === '\x08');
}
