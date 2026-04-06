import { getBrowserPublicEnv } from "@/lib/env";
import { parseEdgeFunctionResponse } from "@/lib/edge-function-response";
import { normalizeEdgeFunctionErrorMessage } from "@/lib/edge-function-invocation";

export async function invokeEdgeFunction<T>({
  accessToken,
  body,
  method = "POST",
  name,
}: {
  accessToken: string;
  body?: unknown;
  method?: "GET" | "POST";
  name: string;
}) {
  try {
    const env = getBrowserPublicEnv();
    const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method,
    });
    return parseEdgeFunctionResponse<T>(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Function invocation failed.";

    throw new Error(normalizeEdgeFunctionErrorMessage(message));
  }
}
