import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { chmod, lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRIVATE_KEY_PROTOCOL = 'focaccia-cloud-evidence-recipient-private-key-v1';
const PUBLIC_KEY_PROTOCOL = 'focaccia-cloud-evidence-recipient-public-key-v1';
const ENVELOPE_PROTOCOL = 'focaccia-cloud-evidence-envelope-v1';
const ALGORITHM = 'X25519-HKDF-SHA256-AES-256-GCM';
const AAD = Buffer.from('focaccia-cloud-evidence-envelope-v1', 'utf8');
const MAX_INPUT_BYTES = 16 * 1024 * 1024;

function toBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function fromCanonicalBase64(value, expectedBytes, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty base64 string.`);
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== expectedBytes || decoded.toString('base64') !== value) {
    throw new Error(`${label} has an invalid encoding or length.`);
  }
  return decoded;
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

async function assertRegularFile(filePath, label) {
  if (typeof filePath !== 'string' || path.isAbsolute(filePath) === false) {
    throw new Error(`${label} path must be absolute.`);
  }
  const info = await lstat(filePath).catch(() => null);
  if (info === null || !info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file.`);
  }
  if (info.size > MAX_INPUT_BYTES) throw new Error(`${label} exceeds the size limit.`);
}

async function readNoFollow(filePath, label) {
  await assertRegularFile(filePath, label);
  const handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_INPUT_BYTES) {
      throw new Error(`${label} is not a permitted regular file.`);
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function assertRegularParent(filePath, label) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error(`${label} path must be absolute.`);
  }
  const parent = path.dirname(filePath);
  const info = await lstat(parent).catch(() => null);
  if (info === null || !info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`${label} parent must be a regular directory.`);
  }
}

async function writeExclusive(filePath, bytes, mode, label) {
  await assertRegularParent(filePath, label);
  const existing = await lstat(filePath).catch(() => null);
  if (existing !== null) throw new Error(`${label} already exists.`);
  const handle = await open(
    filePath,
    fsConstants.O_CREAT
      | fsConstants.O_EXCL
      | fsConstants.O_WRONLY
      | fsConstants.O_NOFOLLOW,
    mode,
  );
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(filePath, mode);
}

function parseJson(bytes, label) {
  let value;
  try {
    value = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must contain a JSON object.`);
  }
  return value;
}

async function readJsonFile(filePath, label) {
  return parseJson(await readNoFollow(filePath, label), label);
}

function publicKeyFromRaw(raw) {
  return createPublicKey({
    key: {
      crv: 'X25519',
      kty: 'OKP',
      x: toBase64Url(raw),
    },
    format: 'jwk',
  });
}

function privateKeyFromRaw(raw, publicRaw) {
  return createPrivateKey({
    key: {
      crv: 'X25519',
      d: toBase64Url(raw),
      kty: 'OKP',
      x: toBase64Url(publicRaw),
    },
    format: 'jwk',
  });
}

function validatePublicKeyDocument(document) {
  if (
    document?.protocol !== PUBLIC_KEY_PROTOCOL
    || document.algorithm !== 'X25519'
    || Object.keys(document).sort().join(',') !== 'algorithm,protocol,publicKey'
  ) {
    throw new Error('Recipient public key document has an invalid schema.');
  }
  return fromCanonicalBase64(document.publicKey, 32, 'Recipient public key');
}

function validatePrivateKeyDocument(document) {
  if (
    document?.protocol !== PRIVATE_KEY_PROTOCOL
    || document.algorithm !== 'X25519'
    || Object.keys(document).sort().join(',') !== 'algorithm,privateKey,protocol,publicKey'
  ) {
    throw new Error('Recipient private key document has an invalid schema.');
  }
  const privateRaw = fromCanonicalBase64(document.privateKey, 32, 'Recipient private key');
  const publicRaw = fromCanonicalBase64(document.publicKey, 32, 'Recipient public key');
  return { privateRaw, publicRaw };
}

function deriveKey(privateKey, publicKey, salt) {
  const shared = diffieHellman({ privateKey, publicKey });
  try {
    return Buffer.from(hkdfSync('sha256', shared, salt, AAD, 32));
  } finally {
    shared.fill(0);
  }
}

function validateEnvelope(document) {
  const expectedKeys = 'algorithm,ciphertext,nonce,protocol,salt,senderPublicKey,tag';
  if (
    document?.protocol !== ENVELOPE_PROTOCOL
    || document.algorithm !== ALGORITHM
    || Object.keys(document).sort().join(',') !== expectedKeys
  ) {
    throw new Error('Evidence envelope has an invalid schema.');
  }
  const ciphertextBytes = Buffer.from(document.ciphertext, 'base64');
  return {
    ciphertext: fromCanonicalBase64(document.ciphertext, ciphertextBytes.length, 'Envelope ciphertext'),
    nonce: fromCanonicalBase64(document.nonce, 12, 'Envelope nonce'),
    salt: fromCanonicalBase64(document.salt, 32, 'Envelope salt'),
    senderPublicKey: fromCanonicalBase64(document.senderPublicKey, 32, 'Envelope sender public key'),
    tag: fromCanonicalBase64(document.tag, 16, 'Envelope authentication tag'),
  };
}

export async function generateRecipientKeyPair({ privateKeyPath, publicKeyPath }) {
  const { privateKey, publicKey } = generateKeyPairSync('x25519');
  const privateJwk = privateKey.export({ format: 'jwk' });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const privateRaw = Buffer.from(privateJwk.d, 'base64url');
  const publicRaw = Buffer.from(publicJwk.x, 'base64url');
  try {
    await writeExclusive(
      privateKeyPath,
      `${JSON.stringify({
        algorithm: 'X25519',
        privateKey: toBase64(privateRaw),
        protocol: PRIVATE_KEY_PROTOCOL,
        publicKey: toBase64(publicRaw),
      }, null, 2)}\n`,
      0o600,
      'Recipient private key',
    );
    await writeExclusive(
      publicKeyPath,
      `${JSON.stringify({
        algorithm: 'X25519',
        protocol: PUBLIC_KEY_PROTOCOL,
        publicKey: toBase64(publicRaw),
      }, null, 2)}\n`,
      0o600,
      'Recipient public key',
    );
  } finally {
    privateRaw.fill(0);
    publicRaw.fill(0);
  }
}

export async function encryptEvidenceEnvelope({
  contextPath,
  envelopePath,
  networkPath,
  publicKeyPath,
}) {
  const [contextBytes, networkBytes, publicDocument] = await Promise.all([
    readNoFollow(contextPath, 'Cloud context'),
    readNoFollow(networkPath, 'Cloud network'),
    readJsonFile(publicKeyPath, 'Recipient public key'),
  ]);
  parseJson(contextBytes, 'Cloud context');
  parseJson(networkBytes, 'Cloud network');
  const recipientRaw = validatePublicKeyDocument(publicDocument);
  const recipientPublicKey = publicKeyFromRaw(recipientRaw);
  const { privateKey: senderPrivateKey, publicKey: senderPublicKey } = generateKeyPairSync('x25519');
  const senderJwk = senderPublicKey.export({ format: 'jwk' });
  const senderRaw = Buffer.from(senderJwk.x, 'base64url');
  const salt = randomBytes(32);
  const nonce = randomBytes(12);
  const key = deriveKey(senderPrivateKey, recipientPublicKey, salt);
  const plaintext = Buffer.from(JSON.stringify({
    context: contextBytes.toString('base64'),
    network: networkBytes.toString('base64'),
    protocol: 'focaccia-cloud-evidence-plaintext-v1',
  }), 'utf8');
  try {
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(AAD);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope = {
      algorithm: ALGORITHM,
      ciphertext: toBase64(ciphertext),
      nonce: toBase64(nonce),
      protocol: ENVELOPE_PROTOCOL,
      salt: toBase64(salt),
      senderPublicKey: toBase64(senderRaw),
      tag: toBase64(cipher.getAuthTag()),
    };
    await writeExclusive(
      envelopePath,
      `${JSON.stringify(envelope, null, 2)}\n`,
      0o600,
      'Evidence envelope',
    );
  } finally {
    key.fill(0);
    plaintext.fill(0);
    salt.fill(0);
    nonce.fill(0);
    senderRaw.fill(0);
    recipientRaw.fill(0);
  }
}

export async function decryptEvidenceEnvelope({
  contextOutputPath,
  envelopePath,
  networkOutputPath,
  privateKeyPath,
}) {
  const [envelopeDocument, privateDocument] = await Promise.all([
    readJsonFile(envelopePath, 'Evidence envelope'),
    readJsonFile(privateKeyPath, 'Recipient private key'),
  ]);
  const envelope = validateEnvelope(envelopeDocument);
  const { privateRaw, publicRaw } = validatePrivateKeyDocument(privateDocument);
  const recipientPrivateKey = privateKeyFromRaw(privateRaw, publicRaw);
  const senderPublicKey = publicKeyFromRaw(envelope.senderPublicKey);
  const key = deriveKey(recipientPrivateKey, senderPublicKey, envelope.salt);
  const decipher = createDecipheriv('aes-256-gcm', key, envelope.nonce);
  decipher.setAAD(AAD);
  decipher.setAuthTag(envelope.tag);
  let plaintext;
  try {
    plaintext = Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
    const wrapper = parseJson(plaintext, 'Evidence envelope plaintext');
    if (
      wrapper.protocol !== 'focaccia-cloud-evidence-plaintext-v1'
      || Object.keys(wrapper).sort().join(',') !== 'context,network,protocol'
    ) {
      throw new Error('Evidence envelope plaintext has an invalid schema.');
    }
    const contextBytes = fromCanonicalBase64(
      wrapper.context,
      Buffer.from(wrapper.context, 'base64').length,
      'Decrypted context',
    );
    const networkBytes = fromCanonicalBase64(
      wrapper.network,
      Buffer.from(wrapper.network, 'base64').length,
      'Decrypted network',
    );
    parseJson(contextBytes, 'Decrypted context');
    parseJson(networkBytes, 'Decrypted network');
    await writeExclusive(contextOutputPath, contextBytes, 0o600, 'Decrypted context');
    await writeExclusive(networkOutputPath, networkBytes, 0o600, 'Decrypted network');
  } finally {
    key.fill(0);
    privateRaw.fill(0);
    publicRaw.fill(0);
    if (plaintext) plaintext.fill(0);
  }
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const values = new Map();
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!flag?.startsWith('--') || !value) throw new Error('Invalid command arguments.');
    values.set(flag, path.resolve(value));
  }
  return { command, values };
}

async function main() {
  const { command, values } = parseArguments(process.argv.slice(2));
  if (command === 'generate') {
    await generateRecipientKeyPair({
      privateKeyPath: values.get('--private-key'),
      publicKeyPath: values.get('--public-key'),
    });
    console.log('Generated ephemeral evidence handoff key pair.');
    return;
  }
  if (command === 'encrypt') {
    await encryptEvidenceEnvelope({
      contextPath: values.get('--context'),
      envelopePath: values.get('--envelope'),
      networkPath: values.get('--network'),
      publicKeyPath: values.get('--public-key'),
    });
    console.log('Encrypted cloud evidence handoff.');
    return;
  }
  if (command === 'decrypt') {
    await decryptEvidenceEnvelope({
      contextOutputPath: values.get('--context-out'),
      envelopePath: values.get('--envelope'),
      networkOutputPath: values.get('--network-out'),
      privateKeyPath: values.get('--private-key'),
    });
    console.log('Decrypted cloud evidence handoff locally.');
    return;
  }
  throw new Error('Command must be generate, encrypt, or decrypt.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
