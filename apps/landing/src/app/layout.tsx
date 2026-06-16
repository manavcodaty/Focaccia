import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { MotionProvider } from "@/components/motion-provider";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Instrument_Serif({ subsets: ["latin"], variable: "--font-display", weight: "400", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://focaccia.events"),
  title: "Focaccia — Privacy-first event access",
  description: "Claim a real event ticket, enroll privately on iOS, and enter through an offline-capable gate without central biometric storage.",
  openGraph: {
    title: "Focaccia — Your face is your ticket",
    description: "Privacy-first biometric event access with local processing and offline-capable gates.",
    type: "website",
  },
  twitter: { card: "summary", title: "Focaccia — Your face is your ticket", description: "Privacy-first biometric event access." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body><MotionProvider>{children}</MotionProvider></body>
    </html>
  );
}
