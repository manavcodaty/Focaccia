import type { VerificationDecision } from './types';

export function snippet(value: string, edge = 10): string {
  if (value.length <= edge * 2) {
    return value;
  }

  return `${value.slice(0, edge)}...${value.slice(-edge)}`;
}

export function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Not recorded';
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

export function formatDuration(milliseconds: number): string {
  return `${Math.max(0, Math.round(milliseconds))} ms`;
}

export function decisionTone(
  decision: VerificationDecision | null,
): 'danger' | 'neutral' | 'success' {
  if (!decision) {
    return 'neutral';
  }

  return decision.accepted ? 'success' : 'danger';
}
