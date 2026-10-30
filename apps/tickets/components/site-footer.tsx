import { cn } from '@/lib/utils';

import { Wordmark } from './brand';
import { pageContainer } from './page';

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className={cn(pageContainer, 'flex h-16 items-center')}>
        <Wordmark className="text-muted-foreground" label="Tickets" />
      </div>
    </footer>
  );
}
