const POSTER_PALETTES = [
  { accent: '#B86143', background: '#F1D8C9', foreground: '#3E2017' },
  { accent: '#2F6955', background: '#DCE9DF', foreground: '#183A30' },
  { accent: '#A46A18', background: '#F1E4C8', foreground: '#4A3210' },
  { accent: '#675167', background: '#E8DEE6', foreground: '#332733' },
  { accent: '#445F79', background: '#DCE5EC', foreground: '#223443' },
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
