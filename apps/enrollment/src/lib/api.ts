import type { EnrollmentBundle, PassPayload } from '@face-pass/shared';

import { getSupabasePublicEnv, type SupabasePublicEnv } from './env.ts';
import { extractFunctionError, FunctionApiError } from './function-errors.ts';
import { fetchWithTimeout } from './function-network.ts';
import { buildFunctionHeaders } from './function-request.ts';
import type { EnrollmentTicket } from './ticket-state.ts';
import type { ApiErrorShape } from './types.ts';

export { FunctionApiError } from './function-errors.ts';

interface ErrorResponse {
  error: ApiErrorShape;
  ok: false;
}

interface SuccessResponse<T> {
  data: T;
  ok: true;
}

type FunctionResponse<T> = ErrorResponse | SuccessResponse<T>;

export interface EnrollmentBundleSelection {
  event: EnrollmentBundle;
  ticket: Pick<
    EnrollmentTicket,
    'current_pass_id' | 'event_id' | 'generation_count' | 'id' | 'status' | 'ticket_type_id'
  >;
}

export interface TicketListResponse {
  meta: { next_cursor: string | null };
  tickets: EnrollmentTicket[];
}

export interface IssuePassResponse {
  generation: number;
  idempotent_replay: boolean;
  queue_code?: string;
  signature: string;
}

interface EnrollmentApiDependencies {
  fetchImpl?: typeof fetch;
  getAccessToken(): Promise<string | null>;
  getEnvironment(): SupabasePublicEnv;
}

function isSuccessResponse<T>(payload: unknown): payload is SuccessResponse<T> {
  return Boolean(
    payload
      && typeof payload === 'object'
      && 'ok' in payload
      && payload.ok === true
      && 'data' in payload,
  );
}

export function createEnrollmentApi({
  fetchImpl,
  getAccessToken,
  getEnvironment,
}: EnrollmentApiDependencies) {
  async function invoke<T>({
    body,
    idempotencyKey,
    name,
  }: {
    body: unknown;
    idempotencyKey?: string;
    name: string;
  }): Promise<T> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Sign in before calling the enrollment service.');
    }

    const env = getEnvironment();
    const response = await fetchWithTimeout({
      errorPrefix: 'Unable to reach the enrollment service.',
      ...(fetchImpl ? { fetchImpl } : {}),
      init: {
        body: JSON.stringify(body),
        headers: buildFunctionHeaders({
          accessToken,
          anonKey: env.anonKey,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        }),
        method: 'POST',
      },
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

  return {
    ensureAttendee(fullName: string) {
      return invoke<{ email: string; full_name: string; user_id: string }>({
        body: { full_name: fullName.trim() },
        name: 'ensure-attendee',
      });
    },

    getEnrollmentBundle(selector: { claimCode: string } | { ticketId: string }) {
      const body = 'claimCode' in selector
        ? { claim_code: selector.claimCode.trim().toUpperCase() }
        : { ticket_id: selector.ticketId };
      return invoke<EnrollmentBundleSelection>({ body, name: 'get-enrollment-bundle' });
    },

    issuePass({
      idempotencyKey,
      payload,
      ticketId,
    }: {
      idempotencyKey: string;
      payload: PassPayload;
      ticketId: string;
    }) {
      return invoke<IssuePassResponse>({
        body: { payload, ticket_id: ticketId },
        idempotencyKey,
        name: 'issue-pass',
      });
    },

    listMyTickets() {
      return invoke<TicketListResponse>({ body: {}, name: 'list-my-tickets' });
    },
  };
}

async function currentAccessToken(): Promise<string | null> {
  const { supabase } = await import('./supabase.ts');
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export const enrollmentApi = createEnrollmentApi({
  getAccessToken: currentAccessToken,
  getEnvironment: getSupabasePublicEnv,
});
