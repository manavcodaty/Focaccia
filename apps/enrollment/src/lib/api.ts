import type {
  EnrollmentBundle,
  IssuePassResult,
  PassPayload,
} from '@face-pass/shared';

import { getSupabasePublicEnv } from './env';
import { extractFunctionError, FunctionApiError } from './function-errors';
import { fetchWithTimeout } from './function-network';
import { buildFunctionHeaders } from './function-request';
import type { ApiErrorShape } from './types';

export { FunctionApiError } from './function-errors';

interface ErrorResponse {
  error: ApiErrorShape;
  ok: false;
}

interface SuccessResponse<T> {
  data: T;
  ok: true;
}

type FunctionResponse<T> = ErrorResponse | SuccessResponse<T>;

function isSuccessResponse<T>(payload: unknown): payload is SuccessResponse<T> {
  return Boolean(
    payload
      && typeof payload === 'object'
      && 'ok' in payload
      && payload.ok === true
      && 'data' in payload,
  );
}

async function invokeFunction<T>({
  body,
  method = 'POST',
  name,
}: {
  body?: unknown;
  method?: 'GET' | 'POST';
  name: string;
}): Promise<T> {
  const env = getSupabasePublicEnv();
  const requestInit: RequestInit = {
    headers: buildFunctionHeaders(env.anonKey),
    method,
  };

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetchWithTimeout({
    errorPrefix: 'Unable to reach the enrollment service.',
    init: requestInit,
    url: `${env.url}/functions/v1/${name}`,
  });
  const rawBody = await response.text();
  let payload: FunctionResponse<T> | Record<string, unknown> | null = null;

  if (rawBody.length > 0) {
    try {
      payload = JSON.parse(rawBody) as FunctionResponse<T> | Record<string, unknown>;
    } catch {
      if (!response.ok) {
        throw new FunctionApiError(response.status, undefined, rawBody);
      }

      throw new Error('Function response was not valid JSON.');
    }
  }

  if (!response.ok || !isSuccessResponse<T>(payload)) {
    throw new FunctionApiError(
      response.status,
      extractFunctionError({
        payload,
        status: response.status,
        statusText: response.statusText,
      }),
    );
  }

  return payload.data;
}

export async function fetchEnrollmentBundle(joinCode: string): Promise<EnrollmentBundle> {
  return invokeFunction<EnrollmentBundle>({
    body: {
      join_code: joinCode.trim().toUpperCase(),
    },
    name: 'get-enrollment-bundle',
  });
}

export async function requestPassSignature(
  joinCode: string,
  payload: PassPayload,
): Promise<IssuePassResult> {
  return invokeFunction<IssuePassResult>({
    body: {
      join_code: joinCode.trim().toUpperCase(),
      payload,
    },
    name: 'issue-pass',
  });
}
