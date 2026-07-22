import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import localFont from 'next/font/local';

import { AuthProvider } from '@/components/auth-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const sentient = localFont({
  display: 'swap',
  src: '../../web/public/Sentient-Extralight.woff',
  variable: '--font-sentient',
  weight: '200',
});

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
    <html className={cn('font-sans', geist.variable, sentient.variable)} lang="en">
      <body>
        <TooltipProvider>
          <AuthProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
          </AuthProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
