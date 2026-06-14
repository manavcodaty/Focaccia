import {
  cancelableTemplateV1,
  canonicalJsonBytes,
  fromBase64Url,
  toBase64Url,
  x25519Seal,
  randomBytes,
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

export type SignedPassToken = Omit<SignedPassResult, 'template'>;

export interface PassDraft {
  payload: PassPayload;
  template: Uint8Array;
}

export interface IssueSignedPassFromEmbeddingOptions {
  bundle: EnrollmentBundle;
  embedding: ArrayLike<number>;
  issuePass(payload: PassPayload): Promise<IssuePassResult>;
  now?: Date;
  onPhaseChange?(phase: PassProcessingPhase): void;
}

function unixSeconds(value: Date | string): number {
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error('Expected a valid timestamp.');
  }

  return Math.floor(milliseconds / 1000);
}



export function tokenSnippet(token: string, edgeLength = 12): string {
  if (token.length <= edgeLength * 2) {
    return token;
  }

  return `${token.slice(0, edgeLength)}...${token.slice(-edgeLength)}`;
}

export async function createPassDraftFromEmbedding({
  bundle,
  embedding,
  now = new Date(),
  onPhaseChange,
}: Omit<IssueSignedPassFromEmbeddingOptions, 'issuePass'>): Promise<PassDraft> {
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

  const [eventSalt, gatePublicKey, passIdBytes, nonceBytes] = await Promise.all([
    fromBase64Url(bundle.event_salt),
    fromBase64Url(bundle.pk_gate_event),
    randomBytes(16),
    randomBytes(12),
  ]);
  let encryptedTemplateBytes: Uint8Array | null = null;

  try {
    const passId = await toBase64Url(passIdBytes);
    const nonce = await toBase64Url(nonceBytes);

    onPhaseChange?.('generating-template');
    const template = await cancelableTemplateV1(embedding, eventSalt);

    onPhaseChange?.('encrypting-pass');
    encryptedTemplateBytes = await x25519Seal(template, gatePublicKey);
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

    return { payload, template };
  } finally {
    encryptedTemplateBytes?.fill(0);
    eventSalt.fill(0);
    gatePublicKey.fill(0);
    nonceBytes.fill(0);
    passIdBytes.fill(0);
  }
}

export async function finalizeSignedPass({
  issueResult,
  payload,
  template,
}: {
  issueResult: IssuePassResult;
  payload: PassPayload;
  template: Uint8Array;
}): Promise<SignedPassResult> {
  const signed = await assembleSignedPassToken({ issueResult, payload });
  return { ...signed, template };
}

export async function assembleSignedPassToken({
  issueResult,
  payload,
}: {
  issueResult: IssuePassResult;
  payload: PassPayload;
}): Promise<SignedPassToken> {
  if (!issueResult.signature) {
    throw new Error('The signing service returned an empty signature.');
  }

  const payloadBytes = canonicalJsonBytes(
    payload as unknown as Record<string, string | number | boolean>,
  );
  try {
    const token = `${await toBase64Url(payloadBytes)}.${issueResult.signature}`;
    return {
      payload,
      ...(issueResult.queue_code ? { queueCode: issueResult.queue_code } : {}),
      signature: issueResult.signature,
      token,
    };
  } finally {
    payloadBytes.fill(0);
  }
}

export async function issueSignedPassFromEmbedding({
  issuePass,
  onPhaseChange,
  ...draftOptions
}: IssueSignedPassFromEmbeddingOptions): Promise<SignedPassResult> {
  const draft = await createPassDraftFromEmbedding({
    ...draftOptions,
    ...(onPhaseChange ? { onPhaseChange } : {}),
  });
  onPhaseChange?.('requesting-signature');
  const issueResult = await issuePass(draft.payload);
  onPhaseChange?.('finalizing-pass');
  return finalizeSignedPass({ issueResult, payload: draft.payload, template: draft.template });
}
