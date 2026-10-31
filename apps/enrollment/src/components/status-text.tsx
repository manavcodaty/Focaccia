import { Text } from '@/components/ui/text';
import { ticketStatusPresentation, type EnrollmentTicket } from '@/lib/ticket-state';
import { cn } from '@/lib/utils';

/** Status as coloured text, never a pill — the same treatment as the tickets app. */
export function StatusText({ className, status }: { className?: string; status: EnrollmentTicket['status'] }) {
  const { label, tone } = ticketStatusPresentation(status);

  return (
    <Text
      className={cn(
        'text-sm',
        tone === 'success' && 'text-success',
        tone === 'danger' && 'text-destructive',
        tone === 'neutral' && 'text-muted-foreground',
        className,
      )}
    >
      {label}
    </Text>
  );
}
