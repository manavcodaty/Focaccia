import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';

import { AuthProvider } from '@/components/auth-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

import './globals.css';

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
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={sentient.variable} lang="en">
      <body>
        <AuthProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
