'use client';

import { getPublicEnv } from '@/lib/env';

export function NetworkLabel() {
  const env = getPublicEnv();
  return <span className="network-label"><span aria-hidden="true" />{env.diagnosticLabel}</span>;
}
