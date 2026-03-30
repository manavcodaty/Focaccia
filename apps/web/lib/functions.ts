import { getPublicEnv } from "@/lib/env";

interface EdgeFunctionError {
  error: {
    code: string;
    message: string;
  };
  ok: false;
}

interface EdgeFunctionSuccess<T> {
  data: T;
  ok: true;
}

type EdgeFunctionResponse<T> = EdgeFunctionError | EdgeFunctionSuccess<T>;

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

  const payload = (await response.json()) as EdgeFunctionResponse<T>;

  if (!response.ok || !payload.ok) {
    throw new Error(
      payload.ok ? "Function invocation failed." : payload.error.message,
    );
  }

  return payload.data;
}
