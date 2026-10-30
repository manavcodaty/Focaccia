export function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  const iso = date.toISOString();
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()];
  // Keep SSR and hydration independent of runtime locale data and host timezone.
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}, ${iso.slice(11, 16)} UTC`;
}
