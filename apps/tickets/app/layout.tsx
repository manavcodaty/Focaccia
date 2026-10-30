import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { AuthProvider } from '@/components/auth-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import './globals.css';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  description: 'Browse listed PrivatePass events, claim free tickets, and recover them across devices.',
  title: { default: 'PrivatePass Tickets', template: '%s · PrivatePass Tickets' },
};

export const viewport: Viewport = {
  themeColor: [
    { color: '#ffffff', media: '(prefers-color-scheme: light)' },
    { color: '#0a0a0a', media: '(prefers-color-scheme: dark)' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={cn(geistSans.variable, geistMono.variable)} lang="en" suppressHydrationWarning>
      <body className="flex min-h-svh flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
          <TooltipProvider>
            <AuthProvider>
              <SiteHeader />
              <div className="flex flex-1 flex-col">{children}</div>
              <SiteFooter />
              <Toaster position="bottom-center" />
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
