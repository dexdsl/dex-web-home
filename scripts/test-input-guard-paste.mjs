import assert from 'node:assert/strict';
import { sanitizePastedInputChunk } from './lib/input-guard.mjs';

assert.equal(sanitizePastedInputChunk('hello', { allowMultiline: false }), 'hello');
assert.equal(sanitizePastedInputChunk('hello\nworld', { allowMultiline: false }), 'hello world');
assert.equal(sanitizePastedInputChunk('hello\nworld', { allowMultiline: true }), 'hello\nworld');
assert.equal(sanitizePastedInputChunk('\x1b[200~hello\nworld\x1b[201~', { allowMultiline: true }), 'hello\nworld');
assert.equal(sanitizePastedInputChunk('\x1b[31mhello\x1b[0m', { allowMultiline: false }), 'hello');
assert.equal(sanitizePastedInputChunk('A\tB', { allowMultiline: false }), 'A B');
assert.equal(sanitizePastedInputChunk('A\tB', { allowMultiline: true }), 'A\tB');

console.log('ok input-guard paste');
