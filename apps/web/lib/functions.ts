import { getBrowserPublicEnv } from "@/lib/env";
import { parseEdgeFunctionResponse } from "@/lib/edge-function-response";
import { normalizeEdgeFunctionErrorMessage } from "@/lib/edge-function-invocation";

export async function invokeEdgeFunction<T>({
  accessToken,
  body,
  idempotencyKey,
  method = "POST",
  name,
}: {
  accessToken: string;
  body?: unknown;
  idempotencyKey?: string;
  method?: "GET" | "POST";
  name: string;
}) {
  try {
    const env = getBrowserPublicEnv();
    const headers: Record<string, string> = {
      apikey: env.anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    const response = await fetch(`${env.supabaseUrl}/functions/v1/${name}`, {
      body: body ? JSON.stringify(body) : undefined,
      headers,
      method,
    });
    return parseEdgeFunctionResponse<T>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Function invocation failed.";

    throw new Error(normalizeEdgeFunctionErrorMessage(message));
  }
}
