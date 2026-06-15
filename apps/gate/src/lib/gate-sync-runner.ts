import type { GateRepository } from './gate-db.ts';
import { nextRetryDelayMs, syncFailureDisposition } from './gate-sync.ts';
import type { PendingCheckinSync } from './types.ts';

export interface QueueFlushResult {
  blocked: number;
  pending: number;
  synced: number;
}

function syncError(error: unknown): { code: string; status: number } {
  if (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
    && 'status' in error
    && typeof error.status === 'number'
  ) {
    return { code: error.code, status: error.status };
  }
  return { code: 'network_error', status: 0 };
}

function transportPayload(item: PendingCheckinSync) {
  return {
    decision: item.decision,
    event_id: item.event_id,
    gate_timestamp: item.gate_timestamp,
    idempotency_key: item.idempotency_key,
    nonce: item.nonce,
    pass_id: item.pass_id,
    signature: item.signature,
  } as const;
}

export async function flushCheckinQueue({
  jitter,
  now = new Date(),
  repository,
  send,
}: {
  jitter?: number;
  now?: Date;
  repository: GateRepository;
  send: (item: ReturnType<typeof transportPayload>) => Promise<unknown>;
}): Promise<QueueFlushResult> {
  const due = await repository.listDueSyncItems(now.toISOString());
  const result: QueueFlushResult = { blocked: 0, pending: 0, synced: 0 };

  for (const item of due) {
    try {
      await send(transportPayload(item));
      await repository.markSyncSucceeded(item.idempotency_key, new Date().toISOString());
      result.synced += 1;
    } catch (error) {
      const normalized = syncError(error);
      if (syncFailureDisposition(normalized) === 'blocked') {
        await repository.markSyncBlocked(item.idempotency_key, normalized.code);
        result.blocked += 1;
        continue;
      }

      const attemptCount = item.attempt_count + 1;
      const nextAttemptAt = new Date(
        now.getTime() + nextRetryDelayMs(item.attempt_count, jitter),
      ).toISOString();
      await repository.markSyncRetry(
        item.idempotency_key,
        attemptCount,
        nextAttemptAt,
        normalized.code,
      );
      result.pending += 1;
    }
  }

  return result;
}
