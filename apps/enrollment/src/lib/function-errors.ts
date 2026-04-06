import type { ApiErrorShape } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractFunctionError({
  payload,
  status,
  statusText,
}: {
  payload: unknown;
  status: number;
  statusText?: string;
}): ApiErrorShape {
  if (isRecord(payload) && isRecord(payload.error)) {
    const code = typeof payload.error.code === "string" ? payload.error.code : "unknown_error";
    const message =
      typeof payload.error.message === "string" && payload.error.message.length > 0
        ? payload.error.message
        : statusText || `Function request failed with status ${status}.`;

    return { code, message };
  }

  if (isRecord(payload) && typeof payload.msg === "string" && payload.msg.length > 0) {
    return {
      code: "unknown_error",
      message: payload.msg,
    };
  }

  if (isRecord(payload) && typeof payload.message === "string" && payload.message.length > 0) {
    return {
      code: "unknown_error",
      message: payload.message,
    };
  }

  return {
    code: "unknown_error",
    message: statusText || `Function request failed with status ${status}.`,
  };
}

export class FunctionApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, error?: ApiErrorShape, fallbackMessage?: string) {
    super(error?.message ?? fallbackMessage ?? `Function request failed with status ${status}.`);
    this.code = error?.code ?? "unknown_error";
    this.status = status;
  }
}
