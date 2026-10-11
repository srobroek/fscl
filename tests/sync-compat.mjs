// Synthetic-only integration proof. Never supply a production server here.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const server = process.env.FSCL_SYNTHETIC_SERVER_URL;
assert(server, 'Explicit synthetic server URL required');
const url = new URL(server);
assert(['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '15007', 'Only dedicated loopback test port 15007 allowed');
const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = mkdtempSync(join(tmpdir(), 'fscl-synthetic-sync-'));
const clients = ['writer', 'reader'].map(name => {
  const configRoot = join(root, name, 'config');
  const data = join(root, name, 'data');
  mkdirSync(join(configRoot, 'fiscal'), { recursive: true });
  mkdirSync(data, { recursive: true });
  return { configRoot, data, configFile: join(configRoot, 'fiscal', 'config.json') };
});
function run(client, args) {
  const env = { ...process.env, XDG_CONFIG_HOME: client.configRoot, XDG_DATA_HOME: join(root, 'xdg') };
  delete env.FISCAL_SERVER_URL;
  const output = execFileSync(process.execPath, [join(repo, 'dist', 'index.js'), '--data-dir', client.data, '--json', ...args], {
    cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
  const lines = output.trim().split('\n');
  return JSON.parse(lines.at(-1));
}
function preferenceSnapshot(client, seed) {
  const config = JSON.parse(readFileSync(client.configFile, 'utf8'));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(ACTUAL|FISCAL)_/.test(key)) delete env[key];
  return JSON.parse(execFileSync(process.execPath,
    [join(repo, 'tests', 'preference-fixture.mjs'), client.data, config.activeBudgetId, seed ? 'seed' : 'read'],
    { cwd: repo, env, encoding: 'utf8', input: JSON.stringify(seed ?? {}), stdio: ['pipe', 'pipe', 'pipe'] }));
}
async function request(path, body) {
  const r = await fetch(new URL(path, server), body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  assert(r.ok, `Synthetic endpoint ${path} failed with HTTP ${r.status}`);
  return r.json();
}
try {
  const state = await request('/account/needs-bootstrap');
  assert.equal(state.data.bootstrapped, false, 'Refuse any initialized server');
  const password = randomBytes(32).toString('base64url');
  await request('/account/bootstrap', { password });
  const login = await request('/account/login', { password });
  assert.equal(login.status, 'ok');
  const token = login.data.token;
  assert(token);
  const [writer, reader] = clients;
  const created = run(writer, ['--offline', 'budgets', 'create', 'Synthetic fscl compatibility']);
  const expectedPreferences = preferenceSnapshot(writer, {
    'flags.budgetAnalysisReport': 'true', 'flags.formulaMode': 'true',
    'flags.actionTemplating': 'true', 'flags.customThemes': 'true',
    'flags.goalTemplatesEnabled': 'false', 'flags.goalTemplatesUIEnabled': 'false',
    'flags.crossoverReport': 'true',
    'dashboard.syntheticSelection': '{"page":"synthetic-page","layout":["synthetic-widget"]}',
  });
  const config = JSON.parse(readFileSync(writer.configFile, 'utf8'));
  writeFileSync(writer.configFile, JSON.stringify({ ...config, serverURL: server, token }), { mode: 0o600 });
  writeFileSync(reader.configFile, JSON.stringify({ dataDir: reader.data, serverURL: server, token }), { mode: 0o600 });
  const pushed = run(writer, ['budgets', 'push']);
  assert(pushed.group_id);
  const account = run(writer, ['accounts', 'create', 'Synthetic checking', '--balance', '0']);
  run(writer, ['transactions', 'add', account.id, '--date', '2026-10-01', '--amount', '-12.34', '--payee', 'Synthetic merchant', '--notes', 'Synthetic-only sync proof']);
  run(reader, ['budgets', 'pull', pushed.group_id]);
  const rows = run(reader, ['--fresh', 'transactions', 'list', account.id, '--start', '2026-10-01', '--end', '2026-10-31']);
  assert.equal(rows.count, 1);
  assert.equal(rows.data[0].amount, -1234);
  assert.equal(rows.data[0].notes, 'Synthetic-only sync proof');
  run(writer, ['transactions', 'add', account.id, '--date', '2026-10-02', '--amount', '3.21', '--notes', 'Second synthetic write']);
  const refreshed = run(reader, ['--fresh', 'transactions', 'list', account.id, '--start', '2026-10-01', '--end', '2026-10-31']);
  assert.equal(refreshed.count, 2);
  assert.deepEqual(refreshed.data.map(r => r.amount).sort((a,b) => a-b), [-1234,321]);
  assert.deepEqual(preferenceSnapshot(writer), expectedPreferences, 'Writer preferences changed');
  assert.deepEqual(preferenceSnapshot(reader), expectedPreferences, 'Synced reader preferences changed');
  const receipt = { preferencesPreserved: true, passed: true, scope: 'synthetic only', apiVersion: '26.10.0', upstreamRevision: '69206dd8a8b9621939b653bc9c3e735fdfcdb13a', budgetCreated: !!created.id, uploadPassed: true, cliWritesPassed: true, independentClientPullPassed: true, incrementalSyncPassed: true, privateFinancialDataUsed: false, productionTouched: false, temporaryCredentialsRemoved: true };
  const output = process.env.FSCL_COMPAT_RECEIPT;
  if (output) writeFileSync(output, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} catch (error) {
  // Do not print subprocess output: test authentication must remain private.
  let reason;
  try { reason = JSON.parse(String(error.stdout).trim().split('\n').at(-1)).message; } catch {}
  console.error(JSON.stringify({ passed: false, error: error instanceof assert.AssertionError ? error.message : String(error.message).split('\n')[0], reason }));
  process.exitCode = 1;
} finally {
  const target = resolve(root);
  assert(target.startsWith(resolve(tmpdir()) + '\\') || target.startsWith(resolve(tmpdir()) + '/'));
  assert(target.split(/[\\/]/).at(-1).startsWith('fscl-synthetic-sync-'));
  rmSync(target, { recursive: true, force: true });
}
