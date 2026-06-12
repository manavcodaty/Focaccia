import { NextResponse } from 'next/server';

import { getPublicEnv } from '@/lib/env';

export function GET() {
  const env = getPublicEnv();
  return NextResponse.json({
    diagnostic_label: env.diagnosticLabel,
    mode: env.mode,
    ok: true,
  });
}
