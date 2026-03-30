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

export async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new TypeError('Request body must be valid JSON.');
  }
}
