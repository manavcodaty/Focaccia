import test from "node:test";
import assert from "node:assert/strict";

import { ed25519Keypair, prepareCrypto, toBase64Url, x25519Keypair } from "@face-pass/shared";

import { prepareOfflineVerification } from "../src/lib/offline-verifier.ts";
import type { StoredGateConfig } from "../src/lib/types.ts";

async function createStoredGate(): Promise<StoredGateConfig> {
  const signingKeys = await ed25519Keypair();
  const gateKeys = await x25519Keypair();

  return {
    ends_at: "2030-05-01T22:00:00.000Z",
    event_id: "launch-2030",
    event_name: "Launch 2030",
    event_salt: await toBase64Url(Uint8Array.from({ length: 32 }, (_, index) => index + 1)),
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
  };
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
    throw new Error("Malformed token unexpectedly reached the liveness stage.");
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
    throw new Error("Oversized token unexpectedly reached the liveness stage.");
  }

  assert.equal(result.decision.reasonCode, "BAD_TOKEN");
});
