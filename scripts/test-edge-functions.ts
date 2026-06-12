const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, ['./scripts/test-phase2.mjs'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
