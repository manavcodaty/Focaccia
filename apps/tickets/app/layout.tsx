import type { Metadata, Viewport } from 'next';
import { Funnel_Sans, Geist, Inter } from 'next/font/google';

import { AuthProvider } from '@/components/auth-provider';
import { SiteHeader } from '@/components/site-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const inter = Inter({ subsets: ['latin'], variable: '--font-display' });
const funnelSans = Funnel_Sans({ subsets: ['latin'], variable: '--font-ledger' });

export const metadata: Metadata = {
  description: 'Browse listed Focaccia events, claim free tickets, and recover them across devices.',
  title: { default: 'Focaccia Tickets', template: '%s · Focaccia Tickets' },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#fffdfc',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={cn('font-sans', geist.variable, inter.variable, funnelSans.variable)} lang="en">
      <body>
        <TooltipProvider>
          <AuthProvider>
            <SiteHeader />
            {children}
          </AuthProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
