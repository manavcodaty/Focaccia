import path from "node:path";

import type { NextConfig } from "next";

function selectedDevelopmentHost(): string[] {
  const selectedUrl = process.env.NEXT_PUBLIC_FOCACCIA_WEB_URL;
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
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  transpilePackages: ["@face-pass/shared"],
};

export default nextConfig;
