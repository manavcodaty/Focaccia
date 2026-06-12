import { getEdgeNetworkConfig } from './network-runtime.ts';

const BASE_HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
} as const;

export interface CorsDecision {
  readonly allowed: boolean;
  readonly isNative: boolean;
  readonly origin?: string;
}

export function evaluateCorsRequest(
  req: Request,
  allowedOrigins: readonly string[],
): CorsDecision {
  const origin = req.headers.get('Origin');

  if (!origin) {
    return { allowed: true, isNative: true };
  }

  return {
    allowed: allowedOrigins.includes(origin),
    isNative: false,
    origin,
  };
}

export function buildCorsHeaders(
  origin: string | null,
  allowedOrigins = getEdgeNetworkConfig().browserOrigins,
): Record<string, string> {
  return origin && allowedOrigins.includes(origin)
    ? { ...BASE_HEADERS, 'Access-Control-Allow-Origin': origin }
    : { ...BASE_HEADERS };
}

export function handleCors(
  req: Request,
  allowedOrigins = getEdgeNetworkConfig().browserOrigins,
): Response | null {
  const decision = evaluateCorsRequest(req, allowedOrigins);

  if (!decision.allowed) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: 'origin_not_allowed',
          message: 'This browser origin is not allowed.',
        },
        request_id: crypto.randomUUID(),
      }),
      {
        status: 403,
        headers: {
          ...buildCorsHeaders(null, allowedOrigins),
          'Content-Type': 'application/json',
        },
      },
    );
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(decision.origin ?? null, allowedOrigins),
    });
  }

  return null;
}
