import type { PassVault } from './pass-vault';
import type { PendingPassIssuance, StoredEnrollmentPass } from './ticket-state';

interface IssueOptions<TResult> {
  createPending(): Promise<PendingPassIssuance>;
  finalize(pending: PendingPassIssuance, result: TResult): Promise<StoredEnrollmentPass>;
  submit(pending: PendingPassIssuance): Promise<TResult>;
  ticketId: string;
  userId: string;
}

export function createIssuanceCoordinator(vault: PassVault) {
  const inFlight = new Map<string, Promise<StoredEnrollmentPass>>();

  function issue<TResult>(options: IssueOptions<TResult>): Promise<StoredEnrollmentPass> {
    const requestKey = `${options.userId}:${options.ticketId}`;
    const existing = inFlight.get(requestKey);
    if (existing) return existing;

    const request = (async () => {
      let pending = await vault.loadPending(options.userId, options.ticketId);
      if (!pending) {
        pending = await options.createPending();
        await vault.savePending(pending);
      }

      const result = await options.submit(pending);
      const pass = await options.finalize(pending, result);
      await vault.savePass(pass);
      await vault.removePending(options.userId, options.ticketId);
      return pass;
    })().finally(() => {
      inFlight.delete(requestKey);
    });

    inFlight.set(requestKey, request);
    return request;
  }

  return { issue };
}

export type IssuanceCoordinator = ReturnType<typeof createIssuanceCoordinator>;
