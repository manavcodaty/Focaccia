const POSTER_PALETTES = [
  { accent: '#5D2A1A', background: '#17191C', foreground: '#FFFFFF' },
  { accent: '#17191C', background: '#5D2A1A', foreground: '#FFFFFF' },
  { accent: '#D8CEC7', background: '#17191C', foreground: '#FFFFFF' },
] as const;

export interface EventPosterModel {
  accent: string;
  background: string;
  foreground: string;
  initials: string;
  motif: 'arc' | 'grid' | 'rays' | 'steps';
  serial: string;
}

function stableHash(value: string): number {
  return [...value].reduce(
    (hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16_777_619) >>> 0,
    2_166_136_261,
  );
}

export function createEventPoster(eventId: string, eventName: string): EventPosterModel {
  const hash = stableHash(`${eventId}:${eventName}`);
  const palette = POSTER_PALETTES[hash % POSTER_PALETTES.length];
  const initials = eventName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase('en-GB') ?? '')
    .join('') || 'FC';
  const motifs: EventPosterModel['motif'][] = ['arc', 'grid', 'rays', 'steps'];

  return {
    ...palette,
    initials,
    motif: motifs[hash % motifs.length],
    serial: String((hash % 900) + 100),
  };
}
