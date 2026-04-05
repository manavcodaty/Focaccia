import type { Metadata } from "next";
import localFont from "next/font/local";
import { Cormorant_Garamond, IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display-app",
  weight: ["500", "600"],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body-app",
  weight: ["400", "500", "600"],
});

const sentientFont = localFont({
  src: [
    {
      path: "../public/Sentient-Extralight.woff",
      style: "normal",
      weight: "200",
    },
    {
      path: "../public/Sentient-LightItalic.woff",
      style: "italic",
      weight: "300",
    },
  ],
  variable: "--font-sentient-app",
});

export const metadata: Metadata = {
  description: "Privacy-preserving biometric event access verified offline and stored nowhere.",
  title: "Focaccia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${displayFont.variable} ${bodyFont.variable} ${sentientFont.variable}`}
      lang="en"
    >
      <body className="antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
