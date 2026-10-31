import { FunctionApiError } from './function-errors.ts';
import type { PassProcessingPhase } from './pass-flow.ts';

/** One or two words per phase; shown only while a pass is being issued. */
export function phaseLabel(phase: PassProcessingPhase | null): string | null {
  switch (phase) {
    case 'generating-template': return 'Generating template';
    case 'encrypting-pass': return 'Encrypting';
    case 'requesting-signature': return 'Signing';
    case 'finalizing-pass': return 'Saving';
    default: return null;
  }
}

export function issuanceMessage(error: unknown): string {
  if (error instanceof FunctionApiError) {
    if (error.code === 'pass_generation_limit') return 'Generation limit reached.';
    if (error.code === 'ticket_state_conflict') return 'Ticket changed. Refresh My tickets.';
    if (error.code === 'ticket_not_found') return 'Ticket no longer available.';
    if (error.code === 'gate_not_provisioned') return 'Gate not set up yet.';
  }
  return error instanceof Error ? error.message : 'Pass not issued.';
}
