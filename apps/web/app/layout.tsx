import type { Metadata } from "next";
import { Cormorant_Garamond, IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600"],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  description: "Organizer dashboard for event-scoped biometric provisioning.",
  title: "One-Time Face Pass",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${displayFont.variable} ${bodyFont.variable}`} lang="en">
      <body>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
