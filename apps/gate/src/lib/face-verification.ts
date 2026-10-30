import type { GateRepository } from './gate-db.ts';
import { createSignedCheckin } from './gate-sync.ts';
import { decisionToLogEntry, finalizeOfflineVerification } from './offline-verifier.ts';
import type { PendingVerification, VerificationDecision } from './types.ts';

export const REPLAY_CONFLICT_HINT = 'This pass has already been accepted on this gate.';

type DecisionRecorder = Pick<GateRepository, 'insertLog' | 'recordAcceptedDecision'>;

export interface VerifyFaceInput {
  faceCaptureMs: number;
  liveEmbedding: ArrayLike<number>;
  loadSyncPrivateKey(eventId: string): Promise<Uint8Array | null>;
  now?: () => Date;
  pending: PendingVerification;
  repository: DecisionRecorder;
}

/**
 * Compares one gate face capture with the template sealed in the scanned pass and records the
 * final decision. A match queues a signed check-in and consumes the pass; a mismatch is logged as
 * a rejection and leaves the pass unused so its real holder can still be admitted.
 */
export async function verifyFaceAndRecord({
  faceCaptureMs,
  liveEmbedding,
  loadSyncPrivateKey,
  now = () => new Date(),
  pending,
  repository,
}: VerifyFaceInput): Promise<VerificationDecision> {
  const decision = await finalizeOfflineVerification({ faceCaptureMs, liveEmbedding, pending });

  if (!decision.accepted || !decision.pass_id) {
    await repository.insertLog(decisionToLogEntry(decision));
    return decision;
  }

  const gateTimestamp = now().toISOString();
  const syncPrivateKey = await loadSyncPrivateKey(decision.event_id);
  if (!syncPrivateKey) {
    throw new Error('The gate synchronization key is missing from secure storage.');
  }
  let signedCheckin;
  try {
    signedCheckin = await createSignedCheckin({
      eventId: decision.event_id,
      gateTimestamp,
      passId: decision.pass_id,
      privateKey: syncPrivateKey,
    });
  } finally {
    syncPrivateKey.fill(0);
  }

  const wasRecorded = await repository.recordAcceptedDecision(
    decisionToLogEntry(decision, gateTimestamp),
    {
      ...signedCheckin,
      attempt_count: 0,
      last_error_code: null,
      next_attempt_at: gateTimestamp,
      status: 'pending',
      synced_at: null,
    },
  );
  if (wasRecorded) {
    return decision;
  }

  const replayed: VerificationDecision = {
    ...decision,
    accepted: false,
    hint: REPLAY_CONFLICT_HINT,
    outcome: 'REJECT',
    reasonCode: 'REPLAY_USED',
  };
  await repository.insertLog(decisionToLogEntry(replayed, gateTimestamp));
  return replayed;
}
