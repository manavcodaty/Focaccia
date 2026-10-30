/** Mid-tone identity hues. Tints are mixed against the theme surface at render time. */
const POSTER_ACCENTS = ['#2563EB', '#0F8A6A', '#C2410C', '#BE185D', '#0E7490', '#A16207'] as const;

export interface EventPosterModel {
  accent: string;
  initials: string;
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
  const initials = eventName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase('en-GB') ?? '')
    .join('') || 'FC';

  return {
    accent: POSTER_ACCENTS[hash % POSTER_ACCENTS.length],
    initials,
    serial: String((hash % 900) + 100),
  };
}
