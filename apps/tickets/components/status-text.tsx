import { statusCopy } from '@/lib/presentation';
import type { TicketStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

export function StatusText({ status }: { status: TicketStatus }) {
  const copy = statusCopy(status);
  return (
    <span className={cn('text-sm', copy.tone === 'danger' && 'text-destructive', copy.tone === 'neutral' && 'text-muted-foreground')}>
      {copy.label}
    </span>
  );
}
