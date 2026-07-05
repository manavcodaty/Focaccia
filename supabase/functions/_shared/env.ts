import { hiddenApiError } from './api.ts';

const SECRET_WRAPPING_KEY_BYTES = 32;

export interface RuntimeConfig {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly supabaseServiceRoleKey: string;
  readonly secretWrappingKeyBase64Url: string;
  readonly matchThreshold: number;
  readonly livenessTimeoutMs: number;
  readonly queueCodeDigits: number;
  readonly claimCodePepperBase64Url: string;
  readonly organizerEmailAllowlist: readonly string[];
}

let cachedConfig: RuntimeConfig | undefined;

function requireEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw hiddenApiError({
      clientMessage: 'The Face Pass service is not configured correctly.',
      code: 'service_misconfigured',
      message: `Missing required environment variable ${name}.`,
    });
  }

  return value;
}

function requireAnyEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);

    if (value) {
      return value;
    }
  }

  throw hiddenApiError({
    clientMessage: 'The Face Pass service is not configured correctly.',
    code: 'service_misconfigured',
    message: `Missing required environment variable ${names.join(' or ')}.`,
  });
}

function parsePositiveInteger(name: string, fallback: number): number {
  const raw = Deno.env.get(name);

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw hiddenApiError({
      clientMessage: 'The Face Pass service is not configured correctly.',
      code: 'service_misconfigured',
      message: `${name} must be a positive integer.`,
    });
  }

  return parsed;
}

function parseOrganizerAllowlist(): readonly string[] {
  const raw = requireEnv('FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST');
  const emails = raw.split(',').map((value) => value.trim().toLowerCase());
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    emails.length === 0
    || emails.some((email) => !email || email.includes('*') || !emailPattern.test(email))
    || new Set(emails).size !== emails.length
  ) {
    throw hiddenApiError({
      clientMessage: 'The Face Pass service is not configured correctly.',
      code: 'organizer_allowlist_invalid',
      message: 'FOCACCIA_ORGANIZER_EMAIL_ALLOWLIST must contain unique exact email addresses.',
    });
  }

  return emails;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (!cachedConfig) {
    const secretWrappingKeyBase64Url = requireEnv('FACE_PASS_SECRET_WRAPPING_KEY_B64URL');

    if (secretWrappingKeyBase64Url.length !== 43) {
      throw hiddenApiError({
        clientMessage: 'The Face Pass service is not configured correctly.',
        code: 'service_misconfigured',
        message:
          `FACE_PASS_SECRET_WRAPPING_KEY_B64URL must encode ${SECRET_WRAPPING_KEY_BYTES} bytes.`,
      });
    }

    const claimCodePepperBase64Url = requireEnv('FOCACCIA_CLAIM_CODE_PEPPER');

    if (claimCodePepperBase64Url.length !== 43) {
      throw hiddenApiError({
        clientMessage: 'The Face Pass service is not configured correctly.',
        code: 'claim_code_pepper_invalid',
        message: 'FOCACCIA_CLAIM_CODE_PEPPER must encode 32 bytes.',
      });
    }

    cachedConfig = {
      supabaseUrl: requireAnyEnv('SUPABASE_URL', 'FACE_PASS_SUPABASE_URL'),
      supabaseAnonKey: requireAnyEnv('SUPABASE_ANON_KEY', 'FACE_PASS_SUPABASE_ANON_KEY'),
      supabaseServiceRoleKey: requireAnyEnv(
        'SUPABASE_SERVICE_ROLE_KEY',
        'FACE_PASS_SUPABASE_SERVICE_ROLE_KEY',
      ),
      secretWrappingKeyBase64Url,
      matchThreshold: parsePositiveInteger('FACE_PASS_MATCH_THRESHOLD', 112),
      livenessTimeoutMs: parsePositiveInteger('FACE_PASS_LIVENESS_TIMEOUT_MS', 20_000),
      queueCodeDigits: parsePositiveInteger('FACE_PASS_QUEUE_CODE_DIGITS', 8),
      claimCodePepperBase64Url,
      organizerEmailAllowlist: parseOrganizerAllowlist(),
    };
  }

  return cachedConfig;
}
