// Synthetic local-budget fixture; no server or credentials are accepted.
import { init, loadBudget, shutdown } from '@actual-app/api';
import { readFileSync } from 'node:fs';
const [dataDir, budgetId, mode] = process.argv.slice(2);
const internal = await init({ dataDir, verbose: false });
try {
  await loadBudget(budgetId);
  if (mode === 'seed') {
    const preferences = JSON.parse(readFileSync(0, 'utf8'));
    for (const [id, value] of Object.entries(preferences)) {
      await internal.send('preferences/save', { id, value });
    }
  }
  console.log(JSON.stringify(await internal.send('preferences/get')));
} finally {
  await shutdown();
}
