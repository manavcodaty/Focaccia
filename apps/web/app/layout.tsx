import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const sentient = localFont({
  display: "swap",
  src: "../public/Sentient-Extralight.woff",
  variable: "--font-sentient",
  weight: "200",
});

export const metadata: Metadata = {
  description: "Create Focaccia events, monitor ticket state, and prepare trusted gates for privacy-preserving entry.",
  title: { default: "Focaccia Organizer", template: "%s · Focaccia Organizer" },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#fffdfc",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={cn(geist.variable, sentient.variable)} lang="en">
      <body>
        <TooltipProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-panel)",
                boxShadow: "var(--shadow-float)",
                color: "var(--foreground)",
                fontFamily: "var(--font-geist)",
              },
            }}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}
