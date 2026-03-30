import type {
  EnrollmentBundle,
  IssuePassResult,
  PassPayload,
} from '@face-pass/shared';

import { getSupabasePublicEnv } from './env';
import type { ApiErrorShape } from './types';

interface ErrorResponse {
  error: ApiErrorShape;
  ok: false;
}

interface SuccessResponse<T> {
  data: T;
  ok: true;
}

type FunctionResponse<T> = ErrorResponse | SuccessResponse<T>;

export class FunctionApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, error: ApiErrorShape) {
    super(error.message);
    this.code = error.code;
    this.status = status;
  }
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
    headers: {
      apikey: env.anonKey,
      'Content-Type': 'application/json',
    },
    method,
  };

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetch(`${env.url}/functions/v1/${name}`, requestInit);
  const payload = (await response.json()) as FunctionResponse<T>;

  if (!response.ok || !payload.ok) {
    const error = payload.ok
      ? { code: 'unknown_error', message: 'Unexpected function response.' }
      : payload.error;

    throw new FunctionApiError(response.status, error);
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

export async function requestPassSignature(payload: PassPayload): Promise<IssuePassResult> {
  return invokeFunction<IssuePassResult>({
    body: {
      payload,
    },
    name: 'issue-pass',
  });
}
