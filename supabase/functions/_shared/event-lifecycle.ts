export function hasEventEnded(
  event: Pick<{ ends_at: string }, "ends_at">,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= new Date(event.ends_at).getTime();
}
