import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL_SUPABASE_PROXY_PORT = '54331';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envLocalPath = path.join(repoRoot, '.env.local');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function activeIpv4Addresses(interfaces) {
  const activeIps = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] ?? []) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        activeIps.push(net.address);
      }
    }
  }

  return activeIps;
}

function preferredLocalIp(activeIps) {
  return activeIps.find((ip) =>
    ip.startsWith('192.168.')
    || ip.startsWith('10.')
    || ip.startsWith('172.'),
  ) || activeIps[0];
}

export function updateLocalEnvText(envText, interfaces = networkInterfaces()) {
  const hostMatch = envText.match(/^FOCACCIA_LOCAL_HOST\s*=\s*(.+)$/m);

  if (!hostMatch) {
    return { changed: false, text: envText };
  }

  const configuredIp = hostMatch[1].trim();
  const activeIps = activeIpv4Addresses(interfaces);
  const selectedIp = activeIps.includes(configuredIp) ? configuredIp : preferredLocalIp(activeIps);

  if (!selectedIp) {
    return { changed: false, text: envText };
  }

  const withSelectedIp = selectedIp === configuredIp
    ? envText
    : envText.replace(new RegExp(escapeRegExp(configuredIp), 'g'), selectedIp);
  const expectedSupabaseUrl = `FOCACCIA_LOCAL_SUPABASE_URL=http://${selectedIp}:${LOCAL_SUPABASE_PROXY_PORT}`;
  const withProxyPort = /^FOCACCIA_LOCAL_SUPABASE_URL\s*=.*$/m.test(withSelectedIp)
    ? withSelectedIp.replace(/^FOCACCIA_LOCAL_SUPABASE_URL\s*=.*$/m, expectedSupabaseUrl)
    : `${withSelectedIp.trimEnd()}\n${expectedSupabaseUrl}\n`;

  return {
    changed: withProxyPort !== envText,
    newIp: selectedIp === configuredIp ? undefined : selectedIp,
    oldIp: selectedIp === configuredIp ? undefined : configuredIp,
    text: withProxyPort,
  };
}

export function autoUpdateIp({
  envPath = envLocalPath,
  getNetworkInterfaces = networkInterfaces,
  logger = console,
} = {}) {
  if (!existsSync(envPath)) {
    return { changed: false };
  }

  const envText = readFileSync(envPath, 'utf8');
  const result = updateLocalEnvText(envText, getNetworkInterfaces());

  if (!result.changed) {
    return result;
  }

  if (result.oldIp && result.newIp) {
    logger.log(`[Auto-IP] Active host IP changed. Updating .env.local: ${result.oldIp} -> ${result.newIp}`);
  } else {
    logger.log(`[Auto-IP] Normalized .env.local Supabase URL to port ${LOCAL_SUPABASE_PROXY_PORT}.`);
  }

  writeFileSync(envPath, result.text, { encoding: 'utf8', mode: 0o600 });
  chmodSync(envPath, 0o600);
  return result;
}

if (process.argv[1] === __filename) {
  autoUpdateIp();
}
