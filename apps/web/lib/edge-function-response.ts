interface EdgeFunctionErrorPayload {
  error?: {
    code?: string;
    message?: string;
  } | string;
  message?: string;
  ok?: boolean;
  status?: number;
}

interface EdgeFunctionSuccessPayload<T> {
  data: T;
  ok: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (!isRecord(payload)) {
    return fallbackMessage;
  }

  if (typeof payload.message === "string" && payload.message.length > 0) {
    return payload.message;
  }

  if (typeof payload.error === "string" && payload.error.length > 0) {
    return payload.error;
  }

  if (isRecord(payload.error) && typeof payload.error.message === "string" && payload.error.message.length > 0) {
    return payload.error.message;
  }

  return fallbackMessage;
}

function isSuccessPayload<T>(payload: unknown): payload is EdgeFunctionSuccessPayload<T> {
  return isRecord(payload) && payload.ok === true && "data" in payload;
}

export async function parseEdgeFunctionResponse<T>(response: Response): Promise<T> {
  const rawBody = await response.text();
  const fallbackMessage = response.statusText || "Function invocation failed.";
  let payload: EdgeFunctionErrorPayload | EdgeFunctionSuccessPayload<T> | null = null;

  if (rawBody.length > 0) {
    try {
      payload = JSON.parse(rawBody) as EdgeFunctionErrorPayload | EdgeFunctionSuccessPayload<T>;
    } catch {
      if (!response.ok) {
        throw new Error(rawBody);
      }

      throw new Error("Function response was not valid JSON.");
    }
  }

  if (response.ok && isSuccessPayload<T>(payload)) {
    return payload.data;
  }

  if (!response.ok || !isSuccessPayload<T>(payload)) {
    throw new Error(extractErrorMessage(payload, fallbackMessage));
  }

  return payload.data;
}
