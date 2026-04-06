export function buildFunctionHeaders(anonKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
    'Content-Type': 'application/json',
  };
}
