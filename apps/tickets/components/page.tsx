import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** One container, one padding scale and one heading style for every ticket page. */
export const pageContainer = 'mx-auto w-full max-w-5xl px-5 md:px-8';

export function Page({ actions, children, className, title, titleId }: { actions?: ReactNode; children?: ReactNode; className?: string; title?: ReactNode; titleId?: string }) {
  return (
    <main className={cn(pageContainer, 'flex flex-1 flex-col gap-8 py-10 md:py-14', className)} id="main-content">
      {title ? (
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight" id={titleId}>{title}</h1>
          {actions}
        </div>
      ) : null}
      {children}
    </main>
  );
}

export function SectionHeading({ children, id }: { children: ReactNode; id?: string }) {
  return <h2 className="text-sm font-medium text-muted-foreground" id={id}>{children}</h2>;
}
