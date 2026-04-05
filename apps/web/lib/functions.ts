import { getPublicEnv } from "@/lib/env";
import { parseEdgeFunctionResponse } from "@/lib/edge-function-response";

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
  const env = getPublicEnv();
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
}
