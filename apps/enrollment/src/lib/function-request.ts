export function buildFunctionHeaders({
  accessToken,
  anonKey,
  idempotencyKey,
}: {
  accessToken: string;
  anonKey: string;
  idempotencyKey?: string;
}): Record<string, string> {
  if (!accessToken.trim()) {
    throw new Error('Sign in before calling the enrollment service.');
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    apikey: anonKey,
    'Content-Type': 'application/json',
  };
}
