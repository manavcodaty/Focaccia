export type SliderRange = { max: number; min: number; step: number };

/** Clamp into [min, max] and snap to the nearest step from min. */
export function snapValue(value: number, { max, min, step }: SliderRange): number {
  if (!Number.isFinite(value)) return min;
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(6))));
}

/** Where a value sits along the track, 0..1. */
export function fractionForValue(value: number, range: SliderRange): number {
  if (range.max === range.min) return 0;
  return (snapValue(value, range) - range.min) / (range.max - range.min);
}

/** The value under a touch `x` points from the track's left edge. */
export function valueAtPosition(x: number, width: number, range: SliderRange): number {
  if (width <= 0) return range.min;
  return snapValue(range.min + (x / width) * (range.max - range.min), range);
}
