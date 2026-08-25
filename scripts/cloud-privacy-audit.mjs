import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, open, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_SURFACE_BYTES = 8 * 1024 * 1024;
const SURFACES = [
  ['schema', 'schema.json'],
  ['rows', 'rows.json'],
  ['api_responses', 'api_responses.json'],
  ['server_logs', 'server_logs.log'],
  ['csv_exports', 'csv_exports.csv'],
  ['retained_evidence', 'retained_evidence.json'],
];

const FORBIDDEN_FIELDS = [
  {
    category: 'raw_face_image',
    pattern: /^(?:raw_face(?:_image)?|face_(?:image|photo)|camera_frame|source_face_image)$/i,
  },
  {
    category: 'reusable_embedding',
    pattern: /^(?:embedding|face_embedding|facial_embedding|facenet_embedding|reusable_embedding)$/i,
  },
  {
    category: 'searchable_biometric_index',
    pattern: /^(?:biometric_index|face_index|facial_index|searchable_face_index)$/i,
  },
  {
    category: 'decrypted_template',
    pattern: /^(?:decrypted_template|plaintext_template|plain_template)$/i,
  },
  {
    category: 'cross_event_reusable_template',
    pattern: /^(?:cross_event_template|reusable_template|global_face_template)$/i,
  },
];

function forbiddenCategory(field) {
  if (/^(?:enc_template|encrypted_template|encrypted_gate_bound_payload)$/i.test(field)) return null;
  return FORBIDDEN_FIELDS.find(({ pattern }) => pattern.test(field))?.category ?? null;
}

function collectJsonFindings(value, surface, findings, encryptedState) {
  if (Array.isArray(value)) {
    for (const entry of value) collectJsonFindings(entry, surface, findings, encryptedState);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [field, nested] of Object.entries(value)) {
    if (/^(?:enc_template|encrypted_template|encrypted_gate_bound_payload)$/i.test(field)) {
      encryptedState.observed = true;
    }
    const category = forbiddenCategory(field);
    if (category !== null) findings.push({ category, field, surface });
    collectJsonFindings(nested, surface, findings, encryptedState);
  }
}

function collectTextFindings(text, surface, findings, encryptedState) {
  if (/\b(?:enc_template|encrypted_template|encrypted[-_ ]gate[-_ ]bound)\b/i.test(text)) {
    encryptedState.observed = true;
  }
  const tokens = text.match(/[A-Za-z][A-Za-z0-9_]{2,80}/g) ?? [];
  for (const field of new Set(tokens)) {
    const category = forbiddenCategory(field);
    if (category !== null) findings.push({ category, field, surface });
  }
}

function compareFinding(left, right) {
  return `${left.surface}:${left.category}:${left.field}`.localeCompare(
    `${right.surface}:${right.category}:${right.field}`,
  );
}

async function readSurface(root, surface, filename) {
  const candidate = path.join(root, filename);
  const info = await lstat(candidate).catch(() => null);
  if (info === null) throw new Error(`Missing required privacy surface: ${surface}.`);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`Privacy surface ${surface} must be a regular non-symlink file.`);
  }
  if (info.size > MAX_SURFACE_BYTES) throw new Error(`Privacy surface ${surface} exceeds size limit.`);
  return readFile(candidate);
}

export async function auditPrivacySurfaces(inputDirectory, { sourceOnly = false } = {}) {
  const requestedRoot = path.resolve(inputDirectory);
  const rootInfo = await lstat(requestedRoot).catch(() => null);
  if (rootInfo === null || !rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error('Privacy audit input must be a regular directory.');
  }
  const root = await realpath(requestedRoot);
  const findings = [];
  const encryptedState = { observed: false };
  const surfaceRows = [];

  for (const [surface, filename] of SURFACES) {
    const bytes = await readSurface(root, surface, filename);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (filename.endsWith('.json')) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`Privacy surface ${surface} is not valid JSON.`);
      }
      collectJsonFindings(parsed, surface, findings, encryptedState);
    } else {
      collectTextFindings(text, surface, findings, encryptedState);
    }
    surfaceRows.push({
      bytes: bytes.length,
      scanned: true,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      surface,
    });
  }

  const uniqueFindings = [...new Map(
    findings.map((finding) => [`${finding.surface}:${finding.category}:${finding.field}`, finding]),
  ).values()].sort(compareFinding);
  const passed = uniqueFindings.length === 0;
  return {
    encrypted_gate_bound_payload_classification:
      'encrypted_event_specific_gate_bound_payload_not_central_searchable_biometric_storage',
    encrypted_gate_bound_payload_observed: encryptedState.observed,
    findings: uniqueFindings,
    forbidden_reusable_biometrics_count: uniqueFindings.length,
    reusable_biometrics_centrally_stored: !passed,
    source_only: sourceOnly,
    status: passed ? 'PASS' : 'FAIL',
    surfaces: surfaceRows,
  };
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || !value) throw new Error('Invalid command arguments.');
    values.set(flag, value);
  }
  const input = values.get('--input');
  const output = values.get('--output');
  const sourceOnly = values.has('--source-only');
  if (!input || !output || values.size !== (sourceOnly ? 3 : 2)
    || (sourceOnly && values.get('--source-only') !== 'true')) {
    throw new Error('Required arguments: --input, --output, and optional --source-only true.');
  }
  return { input: path.resolve(input), output: path.resolve(output), sourceOnly };
}

async function writePrivateJson(output, value) {
  const parent = path.dirname(output);
  const parentInfo = await lstat(parent).catch(() => null);
  if (parentInfo === null || !parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
    throw new Error('Privacy audit output parent must be a regular directory.');
  }
  const existing = await lstat(output).catch(() => null);
  if (existing !== null) throw new Error('Privacy audit output already exists.');
  const handle = await open(
    output,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function main() {
  const { input, output, sourceOnly } = parseArguments(process.argv.slice(2));
  const result = await auditPrivacySurfaces(input, { sourceOnly });
  await writePrivateJson(output, result);
  console.log(`Privacy audit completed with status ${result.status}.`);
  if (result.status !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
