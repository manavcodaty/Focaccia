import test from "node:test";
import assert from "node:assert/strict";

import {
  cancelableTemplateV1,
  canonicalJsonBytes,
  ed25519Keypair,
  ed25519SignDetached,
  prepareCrypto,
  toBase64Url,
  x25519Keypair,
  x25519Seal,
} from "@face-pass/shared";

import {
  effectiveMatchThreshold,
  finalizeOfflineVerification,
  prepareOfflineVerification,
} from "../src/lib/offline-verifier.ts";
import type { StoredGateConfig } from "../src/lib/types.ts";

async function createStoredGate(): Promise<StoredGateConfig> {
  const signingKeys = await ed25519Keypair();
  const gateKeys = await x25519Keypair();

  return {
    ends_at: "2030-05-01T22:00:00.000Z",
    event_id: "launch-2030",
    event_name: "Launch 2030",
    event_salt: await toBase64Url(Uint8Array.from({ length: 32 }, (_, index) => index + 1)),
    gate_device_id: null,
    key_version: 1,
    last_revocation_sync_at: null,
    pk_gate_event: await toBase64Url(gateKeys.publicKey),
    pk_sign_event: await toBase64Url(signingKeys.publicKey),
    policy: {
      liveness_timeout_ms: 4000,
      match_threshold: 80,
      queue_code_enabled: true,
      queue_code_digits: 8,
      single_entry: true,
      typed_token_fallback: true,
    },
    provisioned_at: "2030-05-01T17:00:00.000Z",
    starts_at: "2030-05-01T18:00:00.000Z",
    sync_public_key: null,
  };
}

async function createSignedToken({
  event,
  gatePublicKey,
  signingPrivateKey,
  template,
}: {
  event: StoredGateConfig;
  gatePublicKey: Uint8Array;
  signingPrivateKey: Uint8Array;
  template: Uint8Array;
}): Promise<string> {
  const encryptedTemplate = await x25519Seal(template, gatePublicKey);

  try {
    const payload = {
      enc_template: await toBase64Url(encryptedTemplate),
      event_id: event.event_id,
      exp: 1_906_500_000,
      iat: 1_893_000_000,
      nonce: await toBase64Url(Uint8Array.from({ length: 12 }, (_value, index) => index + 1)),
      pass_id: "pass-with-short-template",
      single_use: true,
      v: 1,
    } as const;
    const payloadBytes = canonicalJsonBytes(payload);
    const signature = await ed25519SignDetached(payloadBytes, signingPrivateKey);

    try {
      return `${await toBase64Url(payloadBytes)}.${await toBase64Url(signature)}`;
    } finally {
      payloadBytes.fill(0);
      signature.fill(0);
    }
  } finally {
    encryptedTemplate.fill(0);
  }
}

test("prepareOfflineVerification rejects malformed tokens without throwing", async () => {
  await prepareCrypto();
  const event = await createStoredGate();
  const gateKeys = await x25519Keypair();

  const result = await prepareOfflineVerification({
    checkReplay: async () => false,
    checkRevoked: async () => false,
    event,
    gatePrivateKey: gateKeys.privateKey,
    token: "%%%not-base64url%%%",
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    throw new Error("Malformed token unexpectedly reached the face match stage.");
  }

  assert.equal(result.decision.reasonCode, "BAD_TOKEN");
});

test("prepareOfflineVerification rejects oversized tokens early", async () => {
  await prepareCrypto();
  const event = await createStoredGate();
  const gateKeys = await x25519Keypair();
  const oversizedToken = `${"a".repeat(5000)}.${"b".repeat(128)}`;

  const result = await prepareOfflineVerification({
    checkReplay: async () => false,
    checkRevoked: async () => false,
    event,
    gatePrivateKey: gateKeys.privateKey,
    token: oversizedToken,
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    throw new Error("Oversized token unexpectedly reached the face match stage.");
  }

  assert.equal(result.decision.reasonCode, "BAD_TOKEN");
});

test("prepareOfflineVerification rejects decrypted templates with an invalid byte length", async () => {
  await prepareCrypto();
  const signingKeys = await ed25519Keypair();
  const gateKeys = await x25519Keypair();
  const event = await createStoredGate();
  event.pk_sign_event = await toBase64Url(signingKeys.publicKey);
  event.pk_gate_event = await toBase64Url(gateKeys.publicKey);
  const token = await createSignedToken({
    event,
    gatePublicKey: gateKeys.publicKey,
    signingPrivateKey: signingKeys.privateKey,
    template: Uint8Array.of(1),
  });

  const result = await prepareOfflineVerification({
    checkReplay: async () => false,
    checkRevoked: async () => false,
    event,
    gatePrivateKey: gateKeys.privateKey,
    now: new Date("2030-05-01T19:00:00.000Z"),
    scanStartedAtMs: Date.parse("2030-05-01T19:00:00.000Z"),
    token,
  });

  assert.equal(result.ok, false);

  if (result.ok) {
    throw new Error("Invalid template unexpectedly reached the face match stage.");
  }

  assert.equal(result.decision.reasonCode, "DECRYPT_FAIL");
});

test("effective match threshold is field-tolerant for older provisioned gates", () => {
  assert.equal(effectiveMatchThreshold(50), 50);
  assert.equal(effectiveMatchThreshold(80), 80);
  assert.equal(effectiveMatchThreshold(82), 82);
  assert.equal(effectiveMatchThreshold(84), 82);
  assert.equal(effectiveMatchThreshold(112), 82);
});

test("finalizeOfflineVerification enforces the two-bit adjustment boundary and stricter event policies", async () => {
  await prepareCrypto();
  const eventSalt = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const event = await createStoredGate();
  event.event_salt = await toBase64Url(eventSalt);
  const liveEmbedding = Float32Array.from(
    { length: 128 },
    (_value, index) => Math.sin((index + 1) / 5) * 0.7 + Math.cos((index + 1) / 13) * 0.3,
  );
  const enrolledTemplate = await cancelableTemplateV1(liveEmbedding, eventSalt);

  for (const [threshold, distance, accepted] of [
    [112, 80, true], [112, 81, true], [112, 82, true],
    [112, 83, false], [112, 88, false], [80, 81, false],
  ] as const) {
    event.policy.match_threshold = threshold;
    const template = enrolledTemplate.slice();
    for (let bit = 0; bit < distance; bit += 1) {
      template[bit >> 3] ^= 1 << (bit & 7);
    }
    const decision = await finalizeOfflineVerification({
      liveEmbedding,
      faceCaptureMs: 250,
      pending: {
        decryptedTemplate: template,
        event,
        passRef: "false-accept-pass",
        payload: {
          enc_template: "unused",
          event_id: event.event_id,
          exp: 1_906_500_000,
          iat: 1_893_000_000,
          nonce: "unused",
          pass_id: "false-accept-pass",
          single_use: true,
          v: 1,
        },
        timings: {
          decode_ms: 1,
          decrypt_ms: 1,
          replay_ms: 1,
          revocation_ms: 1,
          scan_ms: 1,
          verify_ms: 1,
        },
        token: "unused",
      },
    });

    assert.equal(decision.hammingDistance, distance);
    assert.equal(decision.reasonCode, accepted ? "ACCEPT" : "MATCH_FAIL");
    assert.equal(decision.accepted, accepted);
  }
});
