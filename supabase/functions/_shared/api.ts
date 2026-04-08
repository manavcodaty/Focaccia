import { corsHeaders } from './cors.ts';

export interface ErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export interface SuccessBody<T> {
  ok: true;
  data: T;
}

export class ApiError extends Error {
  readonly clientMessage: string;
  readonly code: string;
  readonly expose: boolean;
  readonly status: number;

  constructor({
    clientMessage,
    code,
    expose,
    message,
    status,
  }: {
    clientMessage?: string;
    code: string;
    expose: boolean;
    message: string;
    status: number;
  }) {
    super(message);
    this.clientMessage = clientMessage ?? message;
    this.code = code;
    this.expose = expose;
    this.name = 'ApiError';
    this.status = status;
  }
}

export function jsonSuccess<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data } satisfies SuccessBody<T>), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code,
        message,
      },
    } satisfies ErrorBody),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    },
  );
}

export function exposedApiError(status: number, code: string, message: string): ApiError {
  return new ApiError({
    code,
    expose: true,
    message,
    status,
  });
}

export function hiddenApiError({
  clientMessage = 'An unexpected server error occurred.',
  code,
  message,
  status = 500,
}: {
  clientMessage?: string;
  code: string;
  message: string;
  status?: number;
}): ApiError {
  return new ApiError({
    clientMessage,
    code,
    expose: false,
    message,
    status,
  });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function logHiddenError(error: unknown): void {
  if (error instanceof Error) {
    console.error(error.stack ?? `${error.name}: ${error.message}`);
    return;
  }

  console.error(error);
}

export function respondWithError(
  error: unknown,
  fallback: {
    code: string;
    message: string;
    status?: number;
  },
): Response {
  if (isApiError(error)) {
    if (!error.expose) {
      logHiddenError(error);
    }

    return jsonError(error.status, error.code, error.clientMessage);
  }

  if (error instanceof Error) {
    return jsonError(fallback.status ?? 400, fallback.code, error.message);
  }

  logHiddenError(error);
  return jsonError(500, fallback.code, fallback.message);
}

export async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new TypeError('Request body must be valid JSON.');
  }
}
