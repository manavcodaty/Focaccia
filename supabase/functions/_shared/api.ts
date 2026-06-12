import { buildCorsHeaders } from './cors.ts';

export interface ErrorBody {
  ok: false;
  error: {
    code: string;
    field_errors?: Record<string, string>;
    message: string;
  };
  request_id: string;
}

export interface SuccessBody<T> {
  ok: true;
  data: T;
  request_id: string;
}

const requestIds = new WeakMap<Request, string>();

export function getRequestId(req: Request): string {
  const existing = requestIds.get(req);

  if (existing) {
    return existing;
  }

  const requestId = crypto.randomUUID();
  requestIds.set(req, requestId);
  return requestId;
}

export class ApiError extends Error {
  readonly clientMessage: string;
  readonly code: string;
  readonly expose: boolean;
  readonly fieldErrors?: Record<string, string>;
  readonly status: number;

  constructor({
    clientMessage,
    code,
    expose,
    fieldErrors,
    message,
    status,
  }: {
    clientMessage?: string;
    code: string;
    expose: boolean;
    fieldErrors?: Record<string, string>;
    message: string;
    status: number;
  }) {
    super(message);
    this.clientMessage = clientMessage ?? message;
    this.code = code;
    this.expose = expose;
    this.fieldErrors = fieldErrors;
    this.name = 'ApiError';
    this.status = status;
  }
}

export function jsonSuccess<T>(req: Request, data: T, status = 200): Response {
  return new Response(JSON.stringify({
    ok: true,
    data,
    request_id: getRequestId(req),
  } satisfies SuccessBody<T>), {
    status,
    headers: {
      ...buildCorsHeaders(req.headers.get('Origin')),
      'Content-Type': 'application/json',
    },
  });
}

export function jsonError(
  req: Request,
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code,
        ...(fieldErrors ? { field_errors: fieldErrors } : {}),
        message,
      },
      request_id: getRequestId(req),
    } satisfies ErrorBody),
    {
      status,
      headers: {
        ...buildCorsHeaders(req.headers.get('Origin')),
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

export function validationApiError(fieldErrors: Record<string, string>): ApiError {
  return new ApiError({
    code: 'validation_error',
    expose: true,
    fieldErrors,
    message: 'Request validation failed.',
    status: 422,
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
  req: Request,
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

    return jsonError(req, error.status, error.code, error.clientMessage, error.fieldErrors);
  }

  logHiddenError(error);
  return jsonError(req, fallback.status ?? 500, fallback.code, fallback.message);
}

export async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw exposedApiError(422, 'invalid_json', 'Request body must be valid JSON.');
  }
}
