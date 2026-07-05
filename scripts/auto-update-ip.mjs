import { chmodSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envLocalPath = path.join(repoRoot, '.env.local');

if (!existsSync(envLocalPath)) {
  process.exit(0);
}

const envText = readFileSync(envLocalPath, 'utf8');

// Find FOCACCIA_LOCAL_HOST value
const hostMatch = envText.match(/^FOCACCIA_LOCAL_HOST\s*=\s*(.+)$/m);
if (!hostMatch) {
  process.exit(0);
}

const configuredIp = hostMatch[1].trim();

// Get active IPv4 addresses
const nets = networkInterfaces();
const activeIps = [];

for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    if (net.family === 'IPv4' && !net.internal) {
      activeIps.push(net.address);
    }
  }
}

if (activeIps.includes(configuredIp)) {
  // Configured IP is still active and valid.
  process.exit(0);
}

// Find a suitable new IP (private network preferred)
const newIp = activeIps.find(ip => 
  ip.startsWith('192.168.') || 
  ip.startsWith('10.') || 
  ip.startsWith('172.')
) || activeIps[0];

if (newIp && newIp !== configuredIp) {
  console.log(`[Auto-IP] Active host IP changed. Updating .env.local: ${configuredIp} -> ${newIp}`);
  
  // Replace configured IP in .env.local
  const updatedText = envText
    .replace(new RegExp(configuredIp.replace(/\./g, '\\.'), 'g'), newIp);
    
  writeFileSync(envLocalPath, updatedText, { encoding: 'utf8', mode: 0o600 });
  chmodSync(envLocalPath, 0o600);
}
