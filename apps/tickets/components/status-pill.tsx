import { statusCopy } from '@/lib/presentation';
import type { TicketStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export function StatusPill({ status }: { status: TicketStatus }) {
  const copy = statusCopy(status);
  return <Badge className={`ticket-status ticket-status-${copy.tone}`} variant="outline">{copy.label}</Badge>;
}
