import type { Metadata } from "next";
import { Toaster } from "sonner";

import "./globals.css";

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
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--color-canvas)",
              border: "1px solid rgba(0, 0, 0, 0.08)",
              borderRadius: "var(--radius-cards)",
              boxShadow: "var(--shadow-subtle)",
              color: "var(--color-ink)",
              fontFamily: "var(--font-sohne)",
            },
          }}
        />
      </body>
    </html>
  );
}
