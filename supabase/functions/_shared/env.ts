const SECRET_WRAPPING_KEY_BYTES = 32;

export interface RuntimeConfig {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly supabaseServiceRoleKey: string;
  readonly secretWrappingKeyBase64Url: string;
  readonly matchThreshold: number;
  readonly livenessTimeoutMs: number;
  readonly queueCodeDigits: number;
}

let cachedConfig: RuntimeConfig | undefined;

function requireEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }

  return value;
}

function parsePositiveInteger(name: string, fallback: number): number {
  const raw = Deno.env.get(name);

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (!cachedConfig) {
    const secretWrappingKeyBase64Url = requireEnv('FACE_PASS_SECRET_WRAPPING_KEY_B64URL');

    if (secretWrappingKeyBase64Url.length !== 43) {
      throw new Error(
        `FACE_PASS_SECRET_WRAPPING_KEY_B64URL must encode ${SECRET_WRAPPING_KEY_BYTES} bytes.`,
      );
    }

    cachedConfig = {
      supabaseUrl: requireEnv('SUPABASE_URL'),
      supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),
      supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      secretWrappingKeyBase64Url,
      matchThreshold: parsePositiveInteger('FACE_PASS_MATCH_THRESHOLD', 80),
      livenessTimeoutMs: parsePositiveInteger('FACE_PASS_LIVENESS_TIMEOUT_MS', 4000),
      queueCodeDigits: parsePositiveInteger('FACE_PASS_QUEUE_CODE_DIGITS', 8),
    };
  }

  return cachedConfig;
}
