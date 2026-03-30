import sodium from 'npm:libsodium-wrappers@0.8.2';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.100.0';
import { fromBase64Url, prepareCrypto, toBase64Url } from './face-pass-shared.ts';

import { getRuntimeConfig } from './env.ts';
import type { SecretRecord } from './types.ts';

const SECRET_BOX_SEPARATOR = '.';

const cryptoReady = (async () => {
  await prepareCrypto();
  await sodium.ready;
})();

let wrappingKeyPromise: Promise<Uint8Array> | undefined;

async function getWrappingKey(): Promise<Uint8Array> {
  if (!wrappingKeyPromise) {
    wrappingKeyPromise = (async () => {
      await cryptoReady;

      const key = await fromBase64Url(getRuntimeConfig().secretWrappingKeyBase64Url);

      if (key.length !== sodium.crypto_secretbox_KEYBYTES) {
        throw new Error(
          `FACE_PASS_SECRET_WRAPPING_KEY_B64URL must decode to ${sodium.crypto_secretbox_KEYBYTES} bytes.`,
        );
      }

      return key;
    })();
  }

  return wrappingKeyPromise;
}

async function encryptSecret(secret: Uint8Array): Promise<string> {
  await cryptoReady;

  const wrappingKey = await getWrappingKey();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(secret, nonce, wrappingKey);

  return `${await toBase64Url(nonce)}${SECRET_BOX_SEPARATOR}${await toBase64Url(ciphertext)}`;
}

async function decryptSecret(ciphertextEnvelope: string): Promise<Uint8Array> {
  await cryptoReady;

  const [nonceBase64Url, ciphertextBase64Url, extra] = ciphertextEnvelope.split(
    SECRET_BOX_SEPARATOR,
  );

  if (!nonceBase64Url || !ciphertextBase64Url || extra !== undefined) {
    throw new Error('Secret ciphertext envelope is malformed.');
  }

  const wrappingKey = await getWrappingKey();
  const nonce = await fromBase64Url(nonceBase64Url);
  const ciphertext = await fromBase64Url(ciphertextBase64Url);

  return sodium.crypto_secretbox_open_easy(ciphertext, nonce, wrappingKey);
}

async function getSecretRecord(
  adminClient: SupabaseClient,
  eventId: string,
): Promise<SecretRecord> {
  const { data, error } = await adminClient
    .from('edge_event_secrets')
    .select('event_id, sk_sign_event_ciphertext, k_code_event_ciphertext')
    .eq('event_id', eventId)
    .single();

  if (error || !data) {
    throw new Error(`Missing server-side secret record for event ${eventId}.`);
  }

  return data as SecretRecord;
}

export async function createEventSecretRecord(
  adminClient: SupabaseClient,
  eventId: string,
  signingSecret: Uint8Array,
): Promise<void> {
  const encryptedSigningSecret = await encryptSecret(signingSecret);

  const { error } = await adminClient.from('edge_event_secrets').insert({
    event_id: eventId,
    sk_sign_event_ciphertext: encryptedSigningSecret,
  });

  if (error) {
    throw new Error(`Failed to persist event secret for ${eventId}: ${error.message}`);
  }
}

export async function getSigningSecret(
  adminClient: SupabaseClient,
  eventId: string,
): Promise<Uint8Array> {
  const record = await getSecretRecord(adminClient, eventId);
  return decryptSecret(record.sk_sign_event_ciphertext);
}

export async function setQueueCodeSecret(
  adminClient: SupabaseClient,
  eventId: string,
  queueCodeSecret: Uint8Array,
): Promise<void> {
  const encryptedQueueCodeSecret = await encryptSecret(queueCodeSecret);

  const { error } = await adminClient
    .from('edge_event_secrets')
    .update({
      k_code_event_ciphertext: encryptedQueueCodeSecret,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);

  if (error) {
    throw new Error(`Failed to persist queue code secret for ${eventId}: ${error.message}`);
  }
}

export async function getQueueCodeSecret(
  adminClient: SupabaseClient,
  eventId: string,
): Promise<Uint8Array | null> {
  const record = await getSecretRecord(adminClient, eventId);

  if (!record.k_code_event_ciphertext) {
    return null;
  }

  return decryptSecret(record.k_code_event_ciphertext);
}
