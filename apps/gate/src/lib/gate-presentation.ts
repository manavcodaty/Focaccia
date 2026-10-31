import type { RevocationCacheState } from './gate-sync.ts';

export type Tone = 'default' | 'destructive' | 'success' | 'warning';
export type Status = { label: string; tone: Tone };

/** Door readiness in two words. */
export function gateReadiness(provisioned: boolean, cacheState: RevocationCacheState): Status {
  if (!provisioned) return { label: 'Needs setup', tone: 'warning' };
  if (cacheState === 'fresh') return { label: 'Offline ready', tone: 'success' };
  return { label: 'Refresh required', tone: cacheState === 'critical' ? 'destructive' : 'warning' };
}

export function syncStatus(pendingCount: number): Status {
  return pendingCount > 0
    ? { label: 'Sync pending', tone: 'warning' }
    : { label: 'Synced', tone: 'success' };
}

/** "Never", "Just now", "12 min", "3 h". */
export function shortAge(ageMs: number | null): string {
  if (ageMs === null) return 'Never';
  if (ageMs < 60_000) return 'Just now';
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h`;
}

export function decisionTitle(accepted: boolean): string {
  return accepted ? 'Entry accepted' : 'Entry rejected';
}
