import {
  cancelableTemplateV1,
  canonicalJsonBytes,
  fromBase64Url,
  toBase64Url,
  x25519Seal,
  type EnrollmentBundle,
  type IssuePassResult,
  type PassPayload,
} from '@face-pass/shared';

export type PassProcessingPhase =
  | 'generating-template'
  | 'encrypting-pass'
  | 'requesting-signature'
  | 'finalizing-pass';

export interface SignedPassResult {
  payload: PassPayload;
  queueCode?: string;
  signature: string;
  template: Uint8Array;
  token: string;
}

export interface IssueSignedPassFromEmbeddingOptions {
  bundle: EnrollmentBundle;
  embedding: ArrayLike<number>;
  issuePass(payload: PassPayload): Promise<IssuePassResult>;
  now?: Date;
  onPhaseChange?(phase: PassProcessingPhase): void;
  randomBytes?(length: number): Uint8Array;
}

function unixSeconds(value: Date | string): number {
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error('Expected a valid timestamp.');
  }

  return Math.floor(milliseconds / 1000);
}

function secureRandomBytes(length: number): Uint8Array {
  const random = globalThis.crypto;

  if (!random?.getRandomValues) {
    throw new Error('Secure random bytes are unavailable in this runtime.');
  }

  const bytes = new Uint8Array(length);
  random.getRandomValues(bytes);
  return bytes;
}

export function tokenSnippet(token: string, edgeLength = 12): string {
  if (token.length <= edgeLength * 2) {
    return token;
  }

  return `${token.slice(0, edgeLength)}...${token.slice(-edgeLength)}`;
}

export async function issueSignedPassFromEmbedding({
  bundle,
  embedding,
  issuePass,
  now = new Date(),
  onPhaseChange,
  randomBytes = secureRandomBytes,
}: IssueSignedPassFromEmbeddingOptions): Promise<SignedPassResult> {
  const eventStartsAt = unixSeconds(bundle.starts_at);
  const eventEndsAt = unixSeconds(bundle.ends_at);
  const nowUnix = unixSeconds(now);

  if (eventEndsAt <= nowUnix) {
    throw new Error('This event is no longer accepting enrollments.');
  }

  const issuedAt = Math.max(nowUnix, eventStartsAt);

  if (issuedAt > eventEndsAt) {
    throw new Error('The event window is invalid for pass issuance.');
  }

  const eventSalt = await fromBase64Url(bundle.event_salt);
  const gatePublicKey = await fromBase64Url(bundle.pk_gate_event);
  const passId = await toBase64Url(randomBytes(16));
  const nonce = await toBase64Url(randomBytes(12));

  onPhaseChange?.('generating-template');
  const template = await cancelableTemplateV1(embedding, eventSalt);

  onPhaseChange?.('encrypting-pass');
  const encryptedTemplateBytes = await x25519Seal(template, gatePublicKey);
  const encryptedTemplate = await toBase64Url(encryptedTemplateBytes);

  const payload: PassPayload = {
    enc_template: encryptedTemplate,
    event_id: bundle.event_id,
    exp: eventEndsAt,
    iat: issuedAt,
    nonce,
    pass_id: passId,
    single_use: true,
    v: 1,
  };

  onPhaseChange?.('requesting-signature');
  const { queue_code: queueCode, signature } = await issuePass(payload);

  if (!signature) {
    throw new Error('The signing service returned an empty signature.');
  }

  onPhaseChange?.('finalizing-pass');
  const payloadBytes = canonicalJsonBytes(
    payload as unknown as Record<string, string | number | boolean>,
  );
  const token = `${await toBase64Url(payloadBytes)}.${signature}`;
  const result: SignedPassResult = {
    payload,
    signature,
    template,
    token,
  };

  if (queueCode) {
    result.queueCode = queueCode;
  }

  return result;
}
