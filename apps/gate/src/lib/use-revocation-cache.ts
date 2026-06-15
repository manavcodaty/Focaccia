import { useEffect, useState } from 'react';

import { cacheFreshness } from './gate-sync';

export function useRevocationCache(lastSyncAt: string | null) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  return cacheFreshness(lastSyncAt, nowMs);
}
