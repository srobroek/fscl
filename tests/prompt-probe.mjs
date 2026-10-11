import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { password } from '@clack/prompts';
import { requirePassword } from '../src/password.ts';
for (const [name, value, bracketed] of [
  ['ascii-specials', 'Ab!@#$%^&*()_+{}|:"<>?`~[]\\;', false],
  ['unicode', 'Caf\u00e9\u{1f511}e\u0301', false],
  ['whitespace', ' boundary spaces ', false],
  ['paste-specials', 'Ab!@#$%^&*()\u{1f511}', true],
]) {
  const input = new PassThrough();
  input.isTTY = true;
  input.setRawMode = () => input;
  const output = new Writable({ write(_chunk, _enc, cb) { cb(); } });
  output.isTTY = true; output.columns = 80; output.rows = 24;
  const result = password({ message: 'Synthetic password', input, output });
  input.write(bracketed ? '\x1b[200~' + value + '\x1b[201~' : value);
  input.write('\r');
  const actual = await result;
  assert.equal(requirePassword(actual), value, name);
  console.log(JSON.stringify({ name, passed: true }));
  input.destroy(); output.destroy();
}
