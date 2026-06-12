import { existsSync } from 'node:fs';
import path from 'node:path';

import { loadNetworkEnvironment, printNetworkSummary, repoRoot } from './lib/network-environment.mjs';

const requestedMode = process.argv.find((value) => value === 'local' || value === 'tunnel')
  ?? process.env.FOCACCIA_NETWORK_MODE
  ?? (existsSync(path.join(repoRoot, '.env.local')) ? 'local' : undefined);

if (requestedMode !== 'local' && requestedMode !== 'tunnel') {
  throw new Error('Set FOCACCIA_NETWORK_MODE or run demo:status with -- local|tunnel.');
}

const { config, path: environmentPath } = loadNetworkEnvironment(requestedMode);
process.stdout.write(`Configuration: ${environmentPath}\n`);
printNetworkSummary(config);
process.stdout.write('Secrets: redacted by design\n');
