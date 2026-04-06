const EDGE_RUNTIME_RESOLUTION_FAILURE = "name resolution failed";

export function normalizeEdgeFunctionErrorMessage(message: string): string {
  const trimmedMessage = message.trim();

  if (trimmedMessage.toLowerCase().includes(EDGE_RUNTIME_RESOLUTION_FAILURE)) {
    return "Supabase Edge Functions are unavailable. Restart the local Supabase stack and retry.";
  }

  return trimmedMessage;
}
