import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const moduleUrl = new URL('./cloud-evidence-envelope.mjs', import.meta.url);

function makeTemporaryDirectory() {
  return mkdtempSync(path.join(realpathSync(tmpdir()), 'focaccia-cloud-envelope-'));
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function assertCanonicalBase64Bytes(value, byteLength) {
  assert.equal(typeof value, 'string');
  const decoded = Buffer.from(value, 'base64');
  assert.equal(decoded.length, byteLength);
  assert.equal(decoded.toString('base64'), value);
}

function assertMode600(filePath) {
  assert.equal(statSync(filePath).mode & 0o777, 0o600);
}

test('recipient key generation writes exact X25519 schemas with private file permissions', async () => {
  const directory = makeTemporaryDirectory();
  const privateKeyPath = path.join(directory, 'recipient-private-key.json');
  const publicKeyPath = path.join(directory, 'recipient-public-key.json');

  try {
    const { generateRecipientKeyPair } = await import(moduleUrl);
    await generateRecipientKeyPair({ privateKeyPath, publicKeyPath });

    const privateKey = readJson(privateKeyPath);
    const publicKey = readJson(publicKeyPath);

    assert.deepEqual(Object.keys(privateKey).sort(), ['algorithm', 'privateKey', 'protocol', 'publicKey']);
    assert.deepEqual(Object.keys(publicKey).sort(), ['algorithm', 'protocol', 'publicKey']);
    assert.equal(privateKey.algorithm, 'X25519');
    assert.equal(publicKey.algorithm, 'X25519');
    assert.equal(privateKey.protocol, 'focaccia-cloud-evidence-recipient-private-key-v1');
    assert.equal(publicKey.protocol, 'focaccia-cloud-evidence-recipient-public-key-v1');
    assert.equal(privateKey.publicKey, publicKey.publicKey);
    assertCanonicalBase64Bytes(privateKey.privateKey, 32);
    assertCanonicalBase64Bytes(publicKey.publicKey, 32);
    assertMode600(privateKeyPath);
    assertMode600(publicKeyPath);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('authenticated envelope round-trips both JSON files without exposing plaintext', async () => {
  const directory = makeTemporaryDirectory();
  const privateKeyPath = path.join(directory, 'recipient-private-key.json');
  const publicKeyPath = path.join(directory, 'recipient-public-key.json');
  const contextPath = path.join(directory, 'context.json');
  const networkPath = path.join(directory, 'network.json');
  const envelopePath = path.join(directory, 'envelope.json');
  const contextOutputPath = path.join(directory, 'decrypted-context.json');
  const networkOutputPath = path.join(directory, 'decrypted-network.json');
  const contextBytes = Buffer.from('{"attendeePassword":"context-secret-marker"}\n');
  const networkBytes = Buffer.from('{"anonKey":"network-secret-marker"}\n');

  try {
    const {
      decryptEvidenceEnvelope,
      encryptEvidenceEnvelope,
      generateRecipientKeyPair,
    } = await import(moduleUrl);
    writeFileSync(contextPath, contextBytes, { mode: 0o600 });
    writeFileSync(networkPath, networkBytes, { mode: 0o600 });
    await generateRecipientKeyPair({ privateKeyPath, publicKeyPath });
    await encryptEvidenceEnvelope({
      contextPath,
      envelopePath,
      networkPath,
      publicKeyPath,
    });

    const envelopeText = readFileSync(envelopePath, 'utf8');
    const envelope = JSON.parse(envelopeText);
    assert.deepEqual(Object.keys(envelope).sort(), [
      'algorithm',
      'ciphertext',
      'nonce',
      'protocol',
      'salt',
      'senderPublicKey',
      'tag',
    ]);
    assert.equal(envelope.protocol, 'focaccia-cloud-evidence-envelope-v1');
    assert.equal(envelope.algorithm, 'X25519-HKDF-SHA256-AES-256-GCM');
    assertCanonicalBase64Bytes(envelope.senderPublicKey, 32);
    assertCanonicalBase64Bytes(envelope.salt, 32);
    assertCanonicalBase64Bytes(envelope.nonce, 12);
    assertCanonicalBase64Bytes(envelope.tag, 16);
    assert.ok(Buffer.from(envelope.ciphertext, 'base64').length > 0);
    assert.equal(Buffer.from(envelope.ciphertext, 'base64').toString('base64'), envelope.ciphertext);
    assert.equal(envelopeText.includes('context-secret-marker'), false);
    assert.equal(envelopeText.includes('network-secret-marker'), false);
    assertMode600(envelopePath);

    await decryptEvidenceEnvelope({
      contextOutputPath,
      envelopePath,
      networkOutputPath,
      privateKeyPath,
    });

    assert.deepEqual(readFileSync(contextOutputPath), contextBytes);
    assert.deepEqual(readFileSync(networkOutputPath), networkBytes);
    assertMode600(contextOutputPath);
    assertMode600(networkOutputPath);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test('authenticated envelope rejects tampering, the wrong recipient, and symlink inputs', async () => {
  const directory = makeTemporaryDirectory();
  const privateKeyPath = path.join(directory, 'recipient-private-key.json');
  const publicKeyPath = path.join(directory, 'recipient-public-key.json');
  const otherPrivateKeyPath = path.join(directory, 'other-recipient-private-key.json');
  const otherPublicKeyPath = path.join(directory, 'other-recipient-public-key.json');
  const contextPath = path.join(directory, 'context.json');
  const networkPath = path.join(directory, 'network.json');
  const networkSymlinkPath = path.join(directory, 'network-symlink.json');
  const envelopePath = path.join(directory, 'envelope.json');
  const tamperedEnvelopePath = path.join(directory, 'tampered-envelope.json');
  const outputContextPath = path.join(directory, 'output-context.json');
  const outputNetworkPath = path.join(directory, 'output-network.json');

  try {
    const {
      decryptEvidenceEnvelope,
      encryptEvidenceEnvelope,
      generateRecipientKeyPair,
    } = await import(moduleUrl);
    writeFileSync(contextPath, '{"fixture":"context"}\n', { mode: 0o600 });
    writeFileSync(networkPath, '{"fixture":"network"}\n', { mode: 0o600 });
    await generateRecipientKeyPair({ privateKeyPath, publicKeyPath });
    await generateRecipientKeyPair({
      privateKeyPath: otherPrivateKeyPath,
      publicKeyPath: otherPublicKeyPath,
    });
    await encryptEvidenceEnvelope({
      contextPath,
      envelopePath,
      networkPath,
      publicKeyPath,
    });

    const tamperedEnvelope = readJson(envelopePath);
    const tamperedTag = Buffer.from(tamperedEnvelope.tag, 'base64');
    tamperedTag[0] ^= 0xff;
    tamperedEnvelope.tag = tamperedTag.toString('base64');
    writeFileSync(tamperedEnvelopePath, `${JSON.stringify(tamperedEnvelope)}\n`, { mode: 0o600 });

    await assert.rejects(
      () => decryptEvidenceEnvelope({
        contextOutputPath: outputContextPath,
        envelopePath: tamperedEnvelopePath,
        networkOutputPath: outputNetworkPath,
        privateKeyPath,
      }),
      /authenticate|decrypt|state/i,
    );
    assert.equal(await import('node:fs/promises').then(({ access }) => access(outputContextPath).then(() => true).catch(() => false)), false);

    await assert.rejects(
      () => decryptEvidenceEnvelope({
        contextOutputPath: outputContextPath,
        envelopePath,
        networkOutputPath: outputNetworkPath,
        privateKeyPath: otherPrivateKeyPath,
      }),
      /authenticate|decrypt|state/i,
    );

    symlinkSync(networkPath, networkSymlinkPath);
    await assert.rejects(
      () => encryptEvidenceEnvelope({
        contextPath,
        envelopePath: path.join(directory, 'symlink-envelope.json'),
        networkPath: networkSymlinkPath,
        publicKeyPath,
      }),
      /regular non-symlink/i,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
