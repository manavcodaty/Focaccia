import type { NextConfig } from 'next';
import path from 'node:path';

function selectedDevelopmentHost(): string[] {
  const selectedUrl = process.env.NEXT_PUBLIC_FOCACCIA_TICKETS_URL;
  if (!selectedUrl) return [];

  try {
    return [new URL(selectedUrl).hostname];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: selectedDevelopmentHost(),
  poweredByHeader: false,
  transpilePackages: ['@face-pass/shared'],
  turbopack: {
    root: path.resolve(import.meta.dirname, '../..'),
  },
};

export default nextConfig;
