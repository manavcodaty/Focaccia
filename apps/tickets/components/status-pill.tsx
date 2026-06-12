import { statusCopy } from '@/lib/presentation';
import type { TicketStatus } from '@/lib/types';

export function StatusPill({ status }: { status: TicketStatus }) {
  const copy = statusCopy(status);
  return <span className={`status-pill status-${copy.tone}`}>{copy.label}</span>;
}
