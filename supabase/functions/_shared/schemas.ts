import { base64Url22Schema, base64Url32ByteSchema, idSchema, uuidSchema, z } from './validation.ts';

const isoTimestamp = z.string().datetime({ offset: true });

export const emptyBodySchema = z.strictObject({});

export const ensureAttendeeSchema = z.strictObject({
  full_name: z.string().trim().min(1).max(120),
});

export const createEventSchema = z.strictObject({
  capacity: z.number().int().positive().max(1_000_000),
  description: z.string().trim().max(4000).default(''),
  ends_at: isoTimestamp,
  event_id: idSchema.regex(/^[A-Za-z0-9_-]+$/),
  is_listed: z.boolean().default(false),
  location: z.string().trim().max(300).default(''),
  name: z.string().trim().min(1).max(200),
  starts_at: isoTimestamp,
}).refine((value) => new Date(value.starts_at) < new Date(value.ends_at), {
  message: 'starts_at must be earlier than ends_at',
  path: ['ends_at'],
});

export const publicEventSchema = z.strictObject({ event_id: idSchema });

export const publicEventsSchema = z.strictObject({
  cursor: isoTimestamp.optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const manageTicketTypeSchema = z.strictObject({
  capacity: z.number().int().positive().max(1_000_000).nullable(),
  description: z.string().trim().max(1000).default(''),
  event_id: idSchema,
  is_active: z.boolean().default(true),
  name: z.string().trim().min(1).max(120),
  price_pence: z.number().int().min(0).max(100_000_000),
  sort_order: z.number().int().min(0).max(100_000),
  ticket_type_id: uuidSchema.nullable().default(null),
});

export const claimTicketSchema = z.strictObject({
  event_id: idSchema,
  ticket_type_id: uuidSchema,
});

export const ticketActionSchema = z.strictObject({ ticket_id: uuidSchema });

export const revokeTicketSchema = z.strictObject({
  reason: z.string().trim().min(1).max(500),
  ticket_id: uuidSchema,
});

export const enrollmentSelectorSchema = z.strictObject({
  claim_code: z.string().trim().min(1).max(32).optional(),
  ticket_id: uuidSchema.optional(),
}).refine((value) => Number(Boolean(value.claim_code)) + Number(Boolean(value.ticket_id)) === 1, {
  message: 'Provide exactly one of ticket_id or claim_code.',
  path: ['ticket_id'],
});

export const passPayloadSchema = z.strictObject({
  enc_template: z.string().regex(/^[A-Za-z0-9_-]+$/).min(64).max(4096),
  event_id: idSchema,
  exp: z.number().int().positive(),
  iat: z.number().int().positive(),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  pass_id: base64Url22Schema,
  single_use: z.literal(true),
  v: z.literal(1),
});

export const issuePassSchema = z.strictObject({
  payload: passPayloadSchema,
  ticket_id: uuidSchema,
});

export const provisionGateSchema = z.strictObject({
  device_name: z.string().trim().min(1).max(120).optional(),
  event_id: idSchema,
  pk_gate_event: base64Url32ByteSchema,
  sync_public_key: base64Url32ByteSchema,
});

export const gateCheckinSchema = z.strictObject({
  decision: z.literal('ACCEPT'),
  event_id: idSchema,
  gate_timestamp: isoTimestamp,
  idempotency_key: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
  nonce: base64Url22Schema,
  pass_id: base64Url22Schema,
  signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
});
