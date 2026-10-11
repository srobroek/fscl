import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCliTestEnv, createLocalBudget, runCli, type CliTestEnv } from '../src/test-utils.js';

const fixture = fileURLToPath(new URL('./preference-fixture.mjs', import.meta.url));
const featureIds = [
  'flags.goalTemplatesEnabled', 'flags.goalTemplatesUIEnabled',
  'flags.actionTemplating', 'flags.formulaMode',
  'flags.budgetAnalysisReport', 'flags.crossoverReport', 'flags.customThemes',
];

describe('feature preferences survive CLI budget access', () => {
  let testEnv: CliTestEnv;
  beforeEach(() => { testEnv = createCliTestEnv('fscl-preferences-test-'); });
  afterEach(() => { testEnv.cleanup(); });

  function preferences(budgetId: string, values?: Record<string, string>) {
    const env = { ...process.env, ...testEnv.env };
    for (const key of Object.keys(env)) {
      if (key.startsWith('ACTUAL_') || key.startsWith('FISCAL_')) delete env[key];
    }
    const output = execFileSync(process.execPath,
      [fixture, testEnv.dataDir, budgetId, values ? 'seed' : 'read'],
      { env, encoding: 'utf8', input: JSON.stringify(values ?? {}), stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(output.trim()) as Record<string, unknown>;
  }

  it.each(['true', 'false', 'unset'] as const)(
    'preserves %s feature preferences and dashboard state on reads and writes', value => {
      const budget = createLocalBudget(testEnv, 'SyntheticPreferences');
      const seed: Record<string, string> = {
        'dashboard.syntheticSelection': JSON.stringify({ page: 'synthetic-page', layout: ['synthetic-widget'] }),
      };
      if (value !== 'unset') for (const id of featureIds) seed[id] = value;
      const before = preferences(budget.id, seed);
      if (value === 'unset') for (const id of featureIds) expect(before).not.toHaveProperty(id);
      for (const command of [['accounts', 'list'], ['accounts', 'create', 'Synthetic checking', '--balance', '0']]) {
        const result = runCli(['--offline', '--data-dir', testEnv.dataDir, '--json', ...command], undefined, testEnv.env);
        expect(result.exitCode, result.stderr).toBe(0);
        expect(preferences(budget.id)).toEqual(before);
      }
    },
  );
});
