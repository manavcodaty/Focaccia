import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalJsonBytes,
  ed25519Keypair,
  ed25519SignDetached,
  fromBase64Url,
  toBase64Url,
  x25519Keypair,
  x25519SealOpen,
  type EnrollmentBundle,
  type PassPayload,
} from '@face-pass/shared';

import { issueSignedPassFromEmbedding, tokenSnippet } from '../src/lib/pass-flow.ts';

function createFakeEmbedding(): Float32Array {
  return Float32Array.from({ length: 128 }, (_, index) => {
    const angle = (index + 1) * 0.173;
    return Math.sin(angle) * 0.7 + Math.cos(angle * 0.37) * 0.3;
  });
}

test('issueSignedPassFromEmbedding builds an encrypted, signed pass token', async () => {
  const signingKeys = await ed25519Keypair();
  const gateKeys = await x25519Keypair();
  const eventSalt = Uint8Array.from({ length: 32 }, (_, index) => (index * 29 + 7) & 0xff);
  const bundle: EnrollmentBundle = {
    ends_at: '2030-05-01T22:00:00.000Z',
    event_id: 'launch-2030',
    event_salt: await toBase64Url(eventSalt),
    pk_gate_event: await toBase64Url(gateKeys.publicKey),
    pk_sign_event: await toBase64Url(signingKeys.publicKey),
    starts_at: '2030-05-01T18:00:00.000Z',
  };

  const result = await issueSignedPassFromEmbedding({
    bundle,
    embedding: createFakeEmbedding(),
    issuePass: async (payload: PassPayload) => {
      const signature = await ed25519SignDetached(canonicalJsonBytes(payload), signingKeys.privateKey);
      return { queue_code: '12345678', signature: await toBase64Url(signature) };
    },
    now: new Date('2030-05-01T19:30:00.000Z'),
    randomBytes: (length) => Uint8Array.from({ length }, (_, index) => (index * 11 + 5) & 0xff),
  });

  const [payloadPart, signaturePart] = result.token.split('.');
  assert.ok(payloadPart);
  assert.ok(signaturePart);
  assert.equal(result.queueCode, '12345678');
  assert.equal(tokenSnippet(result.token), `${payloadPart.slice(0, 12)}...${signaturePart.slice(-12)}`);

  const payloadBytes = await fromBase64Url(payloadPart);
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as PassPayload;
  const signature = await fromBase64Url(signaturePart);

  assert.equal(payload.event_id, bundle.event_id);
  assert.equal(payload.single_use, true);
  assert.equal(payload.v, 1);
  assert.ok(payload.enc_template.length > 40);

  const templateCiphertext = await fromBase64Url(payload.enc_template);
  const decryptedTemplate = await x25519SealOpen(
    templateCiphertext,
    gateKeys.publicKey,
    gateKeys.privateKey,
  );

  assert.equal(decryptedTemplate.length, 32);
  assert.deepEqual(result.template, decryptedTemplate);
  assert.equal(signature.length > 0, true);
});
