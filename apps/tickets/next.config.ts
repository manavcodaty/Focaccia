import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@face-pass/shared'],
  turbopack: {
    root: path.resolve(import.meta.dirname, '../..'),
  },
};

export default nextConfig;
