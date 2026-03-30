import { canonicalJsonStringify } from '@face-pass/shared';

import type { ProvisioningQrPayload } from './types';

const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

function assertIsoDate(value: string, fieldName: string): void {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`${fieldName} must be a valid ISO timestamp.`);
  }
}

function isProvisioningShape(value: unknown): value is ProvisioningQrPayload {
  return typeof value === 'object' && value !== null;
}

export function parseProvisioningQrPayload(rawValue: string): ProvisioningQrPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue) as unknown;
  } catch {
    throw new Error('Provisioning QR was not valid JSON.');
  }

  if (!isProvisioningShape(parsed)) {
    throw new Error('Provisioning QR is missing its payload object.');
  }

  const payload = parsed as Partial<ProvisioningQrPayload>;

  if (payload.v !== 1 || payload.kind !== 'gate-provisioning') {
    throw new Error('Provisioning QR version is unsupported.');
  }

  if (!payload.event_id?.trim() || !payload.name?.trim()) {
    throw new Error('Provisioning QR must include event_id and name.');
  }

  if (!payload.pk_sign_event || !BASE64URL_32_BYTES.test(payload.pk_sign_event)) {
    throw new Error('Provisioning QR contained an invalid signing public key.');
  }

  if (!payload.event_salt || !BASE64URL_32_BYTES.test(payload.event_salt)) {
    throw new Error('Provisioning QR contained an invalid event salt.');
  }

  if (payload.pk_gate_event && !BASE64URL_32_BYTES.test(payload.pk_gate_event)) {
    throw new Error('Provisioning QR contained an invalid gate public key.');
  }

  assertIsoDate(payload.starts_at ?? '', 'starts_at');
  assertIsoDate(payload.ends_at ?? '', 'ends_at');
  assertIsoDate(payload.issued_at ?? '', 'issued_at');
  const startsAt = payload.starts_at;
  const endsAt = payload.ends_at;
  const issuedAt = payload.issued_at;

  if (!startsAt || !endsAt || !issuedAt) {
    throw new Error('Provisioning QR timestamps were incomplete.');
  }

  const result: ProvisioningQrPayload = {
    ends_at: endsAt,
    event_id: payload.event_id.trim(),
    event_salt: payload.event_salt,
    issued_at: issuedAt,
    kind: 'gate-provisioning',
    name: payload.name.trim(),
    pk_sign_event: payload.pk_sign_event,
    starts_at: startsAt,
    v: 1,
  };

  if (payload.pk_gate_event) {
    result.pk_gate_event = payload.pk_gate_event;
  }

  return result;
}

export function provisioningPayloadPreview(payload: ProvisioningQrPayload): string {
  return canonicalJsonStringify(
    payload as unknown as Record<string, boolean | number | string>,
  );
}
