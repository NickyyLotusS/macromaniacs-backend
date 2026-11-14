import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  [
    '--experimental-vm-modules',
    './node_modules/jest/bin/jest.js',
    '--runInBand',
    'tests/integration/database.spec.ts',
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, RUN_DATABASE_TESTS: 'true' },
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
